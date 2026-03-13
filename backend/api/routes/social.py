from __future__ import annotations

from fastapi import APIRouter

from core.social import repos, social_lifespan, spot_lookup_query

from .blocks import create_blocks_router
from .comments import create_comments_router
from .favorites import create_favorites_router
from .follows import create_follows_router
from .meetups import create_meetups_router
from .profile import create_profile_router
from .shares import create_shares_router
from .spots import create_spots_router
from .support import create_support_router


_SOCIAL_ROUTER: APIRouter | None = None


def get_social_router() -> APIRouter:
    global _SOCIAL_ROUTER
    if _SOCIAL_ROUTER is not None:
        return _SOCIAL_ROUTER

    shared_repos = repos()
    router = APIRouter(prefix="/social", tags=["Social"], lifespan=social_lifespan)

    for child_router in (
        create_profile_router(shared_repos),
        create_spots_router(shared_repos),
        create_favorites_router(shared_repos),
        create_follows_router(shared_repos),
        create_blocks_router(shared_repos),
        create_shares_router(shared_repos),
        create_support_router(shared_repos),
        create_meetups_router(shared_repos),
        create_comments_router(shared_repos),
    ):
        router.include_router(child_router)

    _SOCIAL_ROUTER = router
    return _SOCIAL_ROUTER


def _spot_lookup_query(spot_id: str) -> dict[str, object]:
    return spot_lookup_query(spot_id)
