import os
import time
from collections.abc import AsyncGenerator
from typing import Any

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

from basehook import Basehook
from basehook.api import app
from basehook.models import (
    ThreadUpdateStatus,
    metadata,
    thread_table,
    thread_update_table,
    webhook_table,
)


@pytest.fixture
async def basehook() -> AsyncGenerator[Basehook, None]:
    """Create a test basehook."""
    basehook = Basehook()
    yield basehook


@pytest.fixture
async def test_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Create a test database engine."""
    test_db_url = os.getenv(
        "TEST_DATABASE_URL", "postgresql+asyncpg://chiefskiss:chiefskiss@localhost:5445/chiefskiss"
    )
    engine = create_async_engine(test_db_url, echo=True)

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(metadata.drop_all)
        await conn.run_sync(metadata.create_all)

    yield engine

    # Cleanup
    async with engine.begin() as conn:
        await conn.run_sync(metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def test_app():
    async with LifespanManager(app) as manager:
        yield manager.app


@pytest.fixture
async def client(test_engine: AsyncEngine, test_app: Any) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with initialized database."""

    # Insert test webhook
    async with test_engine.begin() as conn:
        await conn.execute(
            webhook_table.insert().values(
                name="test",
                thread_id_path=["thread_id"],
                revision_number_path=["revision"],
            )
        )

    async with AsyncClient(transport=ASGITransport(app=test_app), base_url="http://test") as ac:
        yield ac


async def get_thread_updates(basehook: Basehook, webhook_name: str, thread_id: str) -> list[Any]:
    """Helper to get all thread updates."""
    async with basehook.engine.begin() as conn:
        result = await conn.execute(
            select(thread_update_table)
            .where(
                thread_update_table.c.webhook_name == webhook_name,
                thread_update_table.c.thread_id == thread_id,
            )
            .order_by(thread_update_table.c.revision_number)
        )
        return list(result.all())


async def get_thread(basehook: Basehook, webhook_name: str, thread_id: str) -> Any:
    """Helper to get thread."""
    async with basehook.engine.begin() as conn:
        result = await conn.execute(
            select(thread_table).where(
                thread_table.c.webhook_name == webhook_name,
                thread_table.c.thread_id == thread_id,
            )
        )
        return result.first()


@pytest.mark.asyncio
async def test_basic_webhook_post_and_last_revision(
    client: AsyncClient, basehook: Basehook
) -> None:
    """
    Test basic flow:
    - Push to /test
    - Call last_revision
    - Ensure database is updated accordingly
    """
    # Push a webhook event
    response = await client.post(
        "/test",
        json={"thread_id": "thread-1", "revision": 1.0, "data": "first update"},
    )
    assert response.status_code == 200

    # Wait a bit to ensure timestamp is old enough
    time.sleep(0.1)

    # Pull the last revision
    async with basehook.last_revision(buffer_in_seconds=0) as update:
        assert update is not None
        assert update["thread_id"] == "thread-1"
        assert update["revision"] == 1.0
        assert update["data"] == "first update"

    # Check database state
    updates = await get_thread_updates(basehook, "test", "thread-1")
    assert len(updates) == 1
    assert updates[0].status == ThreadUpdateStatus.SUCCESS

    thread = await get_thread(basehook, "test", "thread-1")
    assert thread is not None
    assert thread.last_revision_number == 1.0


@pytest.mark.asyncio
async def test_old_revision_skipped(client: AsyncClient, basehook: Basehook) -> None:
    """
    Test old revision handling:
    - Push to /test
    - Process it with last_revision
    - Push to /test with old revision
    - Make sure last_revision returns None and database updated item as skipped
    """
    # Push first update with revision 2.0
    response = await client.post(
        "/test",
        json={"thread_id": "thread-2", "revision": 2.0, "data": "newer update"},
    )
    assert response.status_code == 200

    time.sleep(0.1)

    # Process it
    async with basehook.last_revision(buffer_in_seconds=0) as update:
        assert update is not None
        assert update["revision"] == 2.0

    # Now push an older revision
    response = await client.post(
        "/test",
        json={"thread_id": "thread-2", "revision": 1.0, "data": "older update"},
    )
    assert response.status_code == 200

    time.sleep(0.1)

    # Try to pull - should return None since only old revision is pending
    async with basehook.last_revision(buffer_in_seconds=0) as update:
        assert update is None

    # Check database - old revision should be skipped
    updates = await get_thread_updates(basehook, "test", "thread-2")
    assert len(updates) == 2

    # Find the old update
    old_update = next(u for u in updates if u.revision_number == 1.0)
    assert old_update.status == ThreadUpdateStatus.SKIPPED


@pytest.mark.asyncio
async def test_multiple_items_random_order(client: AsyncClient, basehook: Basehook) -> None:
    """
    Test multiple updates in random order:
    - Push multiple items to /test in random order
    - Make sure last_revision returns last item and db is updated accordingly
    """
    # Push multiple updates in random order
    revisions = [3.0, 1.0, 5.0, 2.0, 4.0]
    for rev in revisions:
        response = await client.post(
            "/test",
            json={"thread_id": "thread-3", "revision": rev, "data": f"update {rev}"},
        )
        assert response.status_code == 200

    time.sleep(0.1)

    # Pull the last revision - should get revision 5.0
    async with basehook.last_revision(buffer_in_seconds=0) as update:
        assert update is not None
        assert update["revision"] == 5.0
        assert update["data"] == "update 5.0"

    # Check database state
    updates = await get_thread_updates(basehook, "test", "thread-3")
    assert len(updates) == 5

    # The highest revision should be SUCCESS
    highest = next(u for u in updates if u.revision_number == 5.0)
    assert highest.status == ThreadUpdateStatus.SUCCESS

    # All others should be SKIPPED
    for u in updates:
        if u.revision_number < 5.0:
            assert u.status == ThreadUpdateStatus.SKIPPED

    # Thread should have last_revision_number = 5.0
    thread = await get_thread(basehook, "test", "thread-3")
    assert thread is not None
    assert thread.last_revision_number == 5.0


@pytest.mark.asyncio
async def test_error_handling(client: AsyncClient, basehook: Basehook) -> None:
    """
    Test error handling:
    - Push to /test
    - Call last_revision but raise an error during processing
    - Make sure update is marked as ERROR
    """
    # Push an update
    response = await client.post(
        "/test",
        json={"thread_id": "thread-4", "revision": 1.0, "data": "will fail"},
    )
    assert response.status_code == 200

    time.sleep(0.1)

    # Try to process but raise an error - exception will be caught by context manager
    with pytest.raises(ValueError):
        async with basehook.last_revision(buffer_in_seconds=0) as update:
            assert update is not None
            # Simulate processing error
            raise ValueError("Processing failed")

    # Check database - should be marked as ERROR
    updates = await get_thread_updates(basehook, "test", "thread-4")
    assert len(updates) == 1
    assert updates[0].status == ThreadUpdateStatus.ERROR

    # Thread should still exist but last_revision_number should be None (initial state)
    thread = await get_thread(basehook, "test", "thread-4")
    assert thread is not None
    assert thread.last_revision_number is None
