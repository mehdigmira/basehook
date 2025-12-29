"""Pytest configuration for basehook tests."""

import pytest


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    """Configure anyio backend for async tests."""
    return "asyncio"
