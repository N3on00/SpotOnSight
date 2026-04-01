from __future__ import annotations

from contextlib import asynccontextmanager

from .indexes import ensure_indexes


@asynccontextmanager
async def social_lifespan(app):
    ensure_indexes(app.state.social_repositories)
    yield
