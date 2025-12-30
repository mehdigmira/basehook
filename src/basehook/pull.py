"""
Deprecated module. Use basehook.core.Basehook.last_revision() instead.

This module is kept for backwards compatibility.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from basehook.core import Basehook

# Global instance for backwards compatibility
_basehook = Basehook()


@asynccontextmanager
async def last_revision(buffer_in_seconds: int = 0) -> AsyncGenerator[Any, None]:
    """
    DEPRECATED: Use Basehook.last_revision() instead.

    Pull the last revision of a given thread from the database.
    This is a backwards compatibility wrapper that delegates to Basehook.

    Args:
        buffer_in_seconds: only pickup threads that have updates older than this value.

    Yields:
        The content of the last revision of the thread, or None if no work to do.
    """
    async with _basehook.last_revision(buffer_in_seconds) as content:
        yield content
