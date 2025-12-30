import os
import time
import traceback
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import MetaData, select, true, update
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from basehook.models import ThreadUpdateStatus, thread_table, thread_update_table


@dataclass
class Basehook:
    """
    Main Basehook class that manages database connections and provides
    methods to interact with webhook threads and updates.
    """

    database_url: str | None = field(default=None)
    engine: AsyncEngine = field(init=False)

    def __post_init__(self):
        database_url = self.database_url or os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://chiefskiss:chiefskiss@localhost:5445/chiefskiss",
        )

        # Railway provides postgresql:// but we need postgresql+asyncpg://
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

        self._database_url = database_url
        self.engine = create_async_engine(
            self._database_url,
            pool_pre_ping=True,
        )

    async def create_tables(self, metadata: MetaData):
        """Create database tables from SQLAlchemy metadata."""
        async with self.engine.begin() as conn:
            await conn.run_sync(metadata.create_all)

    @asynccontextmanager
    async def last_revision(self, buffer_in_seconds: int = 0) -> AsyncGenerator[Any, None]:
        """
        Pull the last revision of a given thread from the database.
        Logic is:
        1. Pick up one thread update that is old enough to be processed. If no such update is found,
           yield None, there is no work to do.
        2. Lock the thread to ensure it is not processed by another process.
        If it is already locked, try and pick up another thread.
        3. At this point, we know we're the only ones working on this thread.
           Fetch all updates for this thread.
        4. If all updates are older than the last revision number, set updates to skipped
           and look for some other thread to process.
        5. Otherwise, yield the update with the highest revision number.
        Mark other updates as skipped.

        Args:
            buffer_in_seconds: only pick up threads that have updates older than this value.

        Yields:
            The content of the last revision of the thread, or None if no work to do.
        """
        async with self.engine.begin() as conn:
            while True:
                # pickup one update that is old enough to be processed
                result = await conn.execute(
                    select(
                        thread_update_table.c.thread_id,
                        thread_update_table.c.webhook_name,
                    )
                    .where(
                        thread_update_table.c.status == ThreadUpdateStatus.PENDING,
                        thread_update_table.c.timestamp <= time.time() - buffer_in_seconds,
                    )
                    .with_for_update(skip_locked=True)
                    .limit(1)
                )
                first_update = result.first()
                if not first_update:
                    # no updates to process
                    yield None
                    return
                thread_id, webhook_name = first_update

                # lock the thread to ensure it is not processed by another process
                result = await conn.execute(
                    select(thread_table)
                    .where(
                        thread_table.c.thread_id == thread_id,
                        thread_table.c.webhook_name == webhook_name,
                    )
                    .with_for_update(skip_locked=True)
                )
                thread_row = result.first()
                if not thread_row:
                    # thread already locked by another process, try again
                    continue

                # get latest update
                result = await conn.execute(
                    select(thread_update_table)
                    .where(
                        thread_update_table.c.webhook_name == webhook_name,
                        thread_update_table.c.thread_id == thread_id,
                        thread_update_table.c.status == ThreadUpdateStatus.PENDING,
                        thread_update_table.c.revision_number > thread_row.last_revision_number
                        if thread_row.last_revision_number is not None
                        else true(),
                    )
                    .order_by(thread_update_table.c.revision_number.desc())
                    .limit(1)
                )
                latest_update = result.first()
                last_revision_number = (
                    latest_update.revision_number
                    if latest_update is not None
                    else thread_row.last_revision_number
                )

                # update old updates to skipped
                if last_revision_number is not None:
                    await conn.execute(
                        update(thread_update_table)
                        .where(
                            thread_update_table.c.webhook_name == webhook_name,
                            thread_update_table.c.thread_id == thread_id,
                            thread_update_table.c.status == ThreadUpdateStatus.PENDING,
                            thread_update_table.c.revision_number <= last_revision_number,
                        )
                        .values(status=ThreadUpdateStatus.SKIPPED)
                    )

                if latest_update is not None:
                    # we have something to process, break
                    break

            status = ThreadUpdateStatus.SUCCESS
            error_traceback = None
            try:
                yield latest_update.content
            except Exception:
                # error processing the updates, mark the thread as error
                status = ThreadUpdateStatus.ERROR
                error_traceback = traceback.format_exc()
                raise
            else:
                await conn.execute(
                    update(thread_table)
                    .where(
                        thread_table.c.thread_id == thread_id,
                        thread_table.c.webhook_name == webhook_name,
                    )
                    .values(last_revision_number=latest_update.revision_number)
                )
            finally:
                await conn.execute(
                    update(thread_update_table)
                    .where(thread_update_table.c.id == latest_update.id)
                    .values(status=status, traceback=error_traceback)
                )
                await conn.commit()
