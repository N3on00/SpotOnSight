from __future__ import annotations

import os

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes.auth import get_auth_router
from core.registry import get_routers
from core.admin_setup import ensure_admin_user
from api.routes.social import get_social_router


def _cors_origins() -> list[str]:
    raw = str(os.getenv("CORS_ORIGINS") or "").strip()
    if not raw:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    if not origins:
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
    return origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle handler."""
    print("[STARTUP] Ensuring admin user exists...")
    try:
        ensure_admin_user()
    except Exception as e:
        print(f"[STARTUP] Warning: Could not ensure admin user: {e}")
    yield
    print("[SHUTDOWN] Application shutting down...")


class Routing:
    """FastAPI app builder.

    Important: DTO modules must be imported before building the app,
    so @mongo_entity decorators can register their routers.
    """

    def __init__(self) -> None:
        self._app = FastAPI(lifespan=lifespan)
        self._app.add_middleware(
            CORSMiddleware,
            allow_origins=_cors_origins(),
            allow_methods=["*"],
            allow_headers=["*"],
        )

        for router in get_routers():
            self._app.include_router(router)

        self._app.include_router(get_auth_router())
        self._app.include_router(get_social_router())

    def get_app(self) -> FastAPI:
        return self._app
