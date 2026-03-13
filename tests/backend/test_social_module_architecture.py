from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from api.routes import social as social_router_module  # noqa: E402
from core.social import get_social_actor_specs  # noqa: E402


def test_social_router_assembles_actor_routers(monkeypatch):
    monkeypatch.setattr(social_router_module, "_SOCIAL_ROUTER", None)
    monkeypatch.setattr(social_router_module, "repos", lambda: object())
    monkeypatch.setattr(
        social_router_module,
        "build_social_actor_routers",
        lambda _repos: [APIRouter() for _ in range(9)],
    )

    router = social_router_module.get_social_router()
    assert len([route for route in router.routes if getattr(route, "path", None) is not None]) == 0


def test_social_actor_specs_are_registered_from_dto_metadata() -> None:
    names = [spec.name for spec in get_social_actor_specs()]
    assert names == [
        "profile",
        "spots",
        "favorites",
        "follows",
        "blocks",
        "shares",
        "support",
        "meetups",
        "comments",
    ]
