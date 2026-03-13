from __future__ import annotations

from contextlib import asynccontextmanager

from .indexes import ensure_indexes


@asynccontextmanager
async def social_lifespan(_app):
    ensure_indexes()
    yield
