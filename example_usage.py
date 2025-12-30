"""
Example usage of the Basehook class.

This demonstrates the recommended way to use Basehook in your application.
"""

import asyncio

from basehook import Basehook
from basehook.models import metadata


async def example_with_lifespan():
    """Example using the lifespan context manager (recommended for apps)."""
    basehook = Basehook()

    async with basehook.lifespan():
        # Create tables if needed
        await basehook.create_tables(metadata)

        # Process updates
        async with basehook.last_revision(buffer_in_seconds=5) as update:
            if update is not None:
                print(f"Processing update: {update}")
                # Your business logic here
            else:
                print("No updates to process")


async def example_with_manual_init():
    """Example using manual init/dispose (useful for scripts)."""
    basehook = Basehook()

    try:
        await basehook.init()
        await basehook.create_tables(metadata)

        # Process updates
        async with basehook.last_revision(buffer_in_seconds=5) as update:
            if update is not None:
                print(f"Processing update: {update}")
            else:
                print("No updates to process")
    finally:
        await basehook.dispose()


async def example_fastapi_integration():
    """Example showing how to integrate with FastAPI."""
    from contextlib import asynccontextmanager

    from fastapi import FastAPI

    # Create Basehook instance
    basehook = Basehook()

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # Startup
        async with basehook.lifespan():
            yield

    # Create FastAPI app with lifespan
    app = FastAPI(lifespan=lifespan)

    @app.get("/process")
    async def process_updates():
        async with basehook.last_revision() as update:
            if update is not None:
                return {"status": "processed", "update": update}
            return {"status": "no_updates"}

    return app


if __name__ == "__main__":
    print("Example 1: Using lifespan context manager")
    asyncio.run(example_with_lifespan())

    print("\nExample 2: Using manual init/dispose")
    asyncio.run(example_with_manual_init())
