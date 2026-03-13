from __future__ import annotations

from typing import Any

from .ids import normalize_id_list, serialize_id, spot_owner_id, spot_visibility
from .repositories import SocialRepositories


def is_following(r: SocialRepositories, follower_id: str, followee_id: str) -> bool:
    if not follower_id or not followee_id:
        return False
    return r.follows.count_documents({"follower_id": follower_id, "followee_id": followee_id}, limit=1) > 0


def is_blocked_pair(r: SocialRepositories, user_a: str, user_b: str) -> bool:
    if not user_a or not user_b:
        return False
    return r.blocks.count_documents({"$or": [{"blocker_id": user_a, "blocked_id": user_b}, {"blocker_id": user_b, "blocked_id": user_a}]}, limit=1) > 0


def can_view_spot(r: SocialRepositories, viewer_id: str, spot_doc: dict[str, Any]) -> bool:
    owner_id = spot_owner_id(spot_doc)
    visibility = spot_visibility(spot_doc)
    if not owner_id:
        return visibility == "public"
    if viewer_id and viewer_id == owner_id:
        return True
    if viewer_id and is_blocked_pair(r, viewer_id, owner_id):
        return False
    if visibility == "public":
        return True
    if visibility == "personal":
        return False
    if visibility == "following":
        return is_following(r, viewer_id, owner_id)
    if visibility == "invite_only":
        return viewer_id in set(normalize_id_list(spot_doc.get("invite_user_ids")))
    return False


def can_view_private_user(r: SocialRepositories, target_user: dict[str, Any], viewer_id: str) -> bool:
    target_id = serialize_id(target_user.get("_id"))
    if viewer_id == target_id:
        return True
    if is_blocked_pair(r, viewer_id, target_id):
        return False
    if not bool(target_user.get("follow_requires_approval", False)):
        return True
    return is_following(r, viewer_id, target_id)
