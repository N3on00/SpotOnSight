from __future__ import annotations

import sys
from pathlib import Path

from fastapi import APIRouter


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from api.routes import social as social_router_module  # noqa: E402


def test_social_router_assembles_feature_routers(monkeypatch):
    calls: list[str] = []

    def make_factory(name: str):
        def factory(_repos):
            calls.append(name)
            return APIRouter()

        return factory

    monkeypatch.setattr(social_router_module, "_SOCIAL_ROUTER", None)
    monkeypatch.setattr(social_router_module, "repos", lambda: object())
    monkeypatch.setattr(social_router_module, "create_profile_router", make_factory("profile"))
    monkeypatch.setattr(social_router_module, "create_spots_router", make_factory("spots"))
    monkeypatch.setattr(social_router_module, "create_favorites_router", make_factory("favorites"))
    monkeypatch.setattr(social_router_module, "create_follows_router", make_factory("follows"))
    monkeypatch.setattr(social_router_module, "create_blocks_router", make_factory("blocks"))
    monkeypatch.setattr(social_router_module, "create_shares_router", make_factory("shares"))
    monkeypatch.setattr(social_router_module, "create_support_router", make_factory("support"))
    monkeypatch.setattr(social_router_module, "create_meetups_router", make_factory("meetups"))
    monkeypatch.setattr(social_router_module, "create_comments_router", make_factory("comments"))

    _ = social_router_module.get_social_router()
    assert calls == [
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
