from __future__ import annotations

import os

from contextlib import asynccontextmanager
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware

from api.routes.auth import build_auth_router
from api.routes.entity_routes import build_entity_routers
from core.admin_setup import ensure_admin_user
from api.routes.social import build_social_router
from core.social.repositories import SocialRepositories
from repositories.mongo_repository import ping_mongo
from repositories.auth_repository import get_auth_user_repository


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
        ensure_admin_user(app.state.auth_repository)
    except Exception as e:
        print(f"[STARTUP] Warning: Could not ensure admin user: {e}")
    yield
    print("[SHUTDOWN] Application shutting down...")


class Routing:
    """FastAPI app builder with explicit dependency wiring."""

    def __init__(self) -> None:
        self._app = FastAPI(lifespan=lifespan)
        auth_repository = get_auth_user_repository()
        social_repositories = SocialRepositories(auth_repository)
        self._app.state.auth_repository = auth_repository
        self._app.state.social_repositories = social_repositories
        self._app.add_middleware(
            CORSMiddleware,
            allow_origins=_cors_origins(),
            allow_methods=["*"],
            allow_headers=["*"],
        )

        for router in build_entity_routers():
            self._app.include_router(router)

        self._app.include_router(build_auth_router(auth_repository))
        self._app.include_router(build_social_router(social_repositories))

        @self._app.get("/health", tags=["Health"])
        def healthcheck(response: Response) -> dict[str, object]:
            try:
                mongo_ok = ping_mongo()
            except Exception:
                mongo_ok = False
            response.status_code = status.HTTP_200_OK if mongo_ok else status.HTTP_503_SERVICE_UNAVAILABLE
            return {
                "status": "ok" if mongo_ok else "degraded",
                "services": {
                    "api": "ok",
                    "mongo": "ok" if mongo_ok else "unavailable",
                },
            }

    def get_app(self) -> FastAPI:
        return self._app
