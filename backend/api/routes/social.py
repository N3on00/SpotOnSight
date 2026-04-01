from __future__ import annotations

from api.route_registry import build_router
from api.routes.social_specs import get_social_router_spec
from core.social import spot_lookup_query


def build_social_router(shared_repos):
    return build_router(get_social_router_spec(), shared_repos)


def _spot_lookup_query(spot_id: str) -> dict[str, object]:
    return spot_lookup_query(spot_id)
