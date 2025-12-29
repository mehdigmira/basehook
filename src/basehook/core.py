import os

from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

_engine: AsyncEngine | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres@localhost:5432/postgres")
        )
    return _engine
