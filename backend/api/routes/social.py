from __future__ import annotations

from fastapi import APIRouter

from core.social import build_social_actor_routers, repos, social_lifespan, spot_lookup_query


_SOCIAL_ROUTER: APIRouter | None = None


def get_social_router() -> APIRouter:
    global _SOCIAL_ROUTER
    if _SOCIAL_ROUTER is not None:
        return _SOCIAL_ROUTER

    shared_repos = repos()
    router = APIRouter(prefix="/social", tags=["Social"], lifespan=social_lifespan)

    for child_router in build_social_actor_routers(shared_repos):
        router.include_router(child_router)

    _SOCIAL_ROUTER = router
    return _SOCIAL_ROUTER


def _spot_lookup_query(spot_id: str) -> dict[str, object]:
    return spot_lookup_query(spot_id)
