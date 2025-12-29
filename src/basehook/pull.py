from ast import Raise
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from sqlalchemy import select, true, update

from basehook.core import get_engine
from basehook.models import ThreadUpdateStatus, thread_table, thread_update_table


@asynccontextmanager
async def last_revision(buffer_in_seconds: int = 0) -> AsyncGenerator[Any, None]:
    """
    Pull the last revision of a given thread from the database.
    Logic is:
    1. Pickup up one thread update that is old enough to be processed. If no such update is found,
    yield None, there is no work to do.
    2. Lock the thread to ensure it is not processed by another process. If it is already locked,
    try and pickup another thread.
    3. At this point, we know we're the only ones working on this thread.
    Fetch all updates for this thread.
    4. If all updates are older than the last revision number, set updates to skipped
    and look for some other thread to process.
    5. Otherwise, yield the update with the highest revision number. Mark other updates as skipped.

    Args:
        buffer_in_seconds: only pickup threads that have updates older than this value.

    Returns:
        The last revision of the thread.
    """
    async with get_engine().begin() as conn:
        while True:
            # pickup one update that is old enough to be processed
            result = await conn.execute(
                select(thread_update_table.c.thread_id, thread_update_table.c.webhook_name)
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

        try:
            yield latest_update.content
        except Exception:
            # error processing the updates, mark the thread as error
            status = ThreadUpdateStatus.ERROR
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
            status = ThreadUpdateStatus.SUCCESS
        finally:
            await conn.execute(
                update(thread_update_table)
                .where(thread_update_table.c.id == latest_update.id)
                .values(status=status)
            )
            await conn.commit()
