from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from .ids import parse_object_id, serialize_id
from .policies import is_blocked_pair, is_following


class SocialRelationshipActions:
    def __init__(self, actions) -> None:
        self.actions = actions

    @property
    def repos(self):
        return self.actions.repos

    def follow_requests(self, current_user: dict[str, Any]):
        me_id = self.actions.me_id(current_user)
        rows = self.actions.sorted_rows(self.repos.follow_requests, {"followee_id": me_id}, 500)
        return self.actions.map_relation_refs(
            rows,
            source_field="follower_id",
            dto_type=self.actions.dto_types["follow_request"],
            dto_id_field="follower_id",
            allow_id=ObjectId.is_valid,
        )

    def approve_follow_request(self, follower_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        follower_sid = serialize_id(parse_object_id(follower_id))
        me_id = self.actions.me_id(current_user)
        request_row = self.repos.follow_requests.find_one({"follower_id": follower_sid, "followee_id": me_id})
        if not request_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow request not found")
        self.actions.insert_relation_ignore_duplicate(
            self.repos.follows,
            {"follower_id": follower_sid, "followee_id": me_id, "created_at": datetime.now(UTC)},
        )
        self.actions.delete_relation_pair(self.repos.follow_requests, "follower_id", follower_sid, "followee_id", me_id)
        return {"ok": True}

    def reject_follow_request(self, follower_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        follower_sid = serialize_id(parse_object_id(follower_id))
        me_id = self.actions.me_id(current_user)
        self.actions.delete_relation_pair(self.repos.follow_requests, "follower_id", follower_sid, "followee_id", me_id)
        return {"ok": True}

    def follow_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, str | bool]:
        target_id, target_user = self.actions.user_or_404(user_id)
        me_id = self.actions.me_id(current_user)
        if me_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")
        if is_blocked_pair(self.repos, me_id, target_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot follow this user")
        if is_following(self.repos, me_id, target_id):
            return {"ok": True, "status": "following"}
        if bool(target_user.get("follow_requires_approval", False)):
            self.actions.upsert_relation_timestamp(self.repos.follow_requests, {"follower_id": me_id, "followee_id": target_id})
            return {"ok": True, "status": "pending"}
        self.actions.insert_relation_ignore_duplicate(
            self.repos.follows,
            {"follower_id": me_id, "followee_id": target_id, "created_at": datetime.now(UTC)},
        )
        self.actions.delete_relation_pair(self.repos.follow_requests, "follower_id", me_id, "followee_id", target_id)
        return {"ok": True, "status": "following"}

    def unfollow_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.actions.me_id(current_user)
        target_id = serialize_id(parse_object_id(user_id))
        self.actions.delete_relation_pair(self.repos.follows, "follower_id", me_id, "followee_id", target_id)
        self.actions.delete_relation_pair(self.repos.follow_requests, "follower_id", me_id, "followee_id", target_id)
        return {"ok": True}

    def followers(self, user_id: str, current_user: dict[str, Any]):
        target_id, target_user = self.actions.user_or_404(user_id)
        me_id = self.actions.require_private_profile_access(target_user, current_user)
        rows = self.actions.sorted_rows(self.repos.follows, {"followee_id": target_id}, 1200)
        return self.actions.map_relation_refs(
            rows,
            source_field="follower_id",
            dto_type=self.actions.dto_types["follow"],
            dto_id_field="user_id",
            allow_id=lambda related_id: ObjectId.is_valid(related_id) and not is_blocked_pair(self.repos, me_id, related_id),
        )

    def following(self, user_id: str, current_user: dict[str, Any]):
        target_id, target_user = self.actions.user_or_404(user_id)
        me_id = self.actions.require_private_profile_access(target_user, current_user)
        rows = self.actions.sorted_rows(self.repos.follows, {"follower_id": target_id}, 1200)
        return self.actions.map_relation_refs(
            rows,
            source_field="followee_id",
            dto_type=self.actions.dto_types["follow"],
            dto_id_field="user_id",
            allow_id=lambda related_id: ObjectId.is_valid(related_id) and not is_blocked_pair(self.repos, me_id, related_id),
        )

    def remove_follower(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.actions.me_id(current_user)
        follower_id = serialize_id(parse_object_id(user_id))
        self.actions.delete_relation_pair(self.repos.follows, "follower_id", follower_id, "followee_id", me_id)
        self.actions.delete_relation_pair(self.repos.follow_requests, "follower_id", follower_id, "followee_id", me_id)
        return {"ok": True}

    def block_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.actions.me_id(current_user)
        target_id = serialize_id(parse_object_id(user_id))
        if me_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself")
        self.actions.upsert_relation_timestamp(self.repos.blocks, {"blocker_id": me_id, "blocked_id": target_id})
        self.actions.delete_bidirectional_relation_pairs(self.repos.follows, "follower_id", me_id, "followee_id", target_id)
        self.actions.delete_bidirectional_relation_pairs(self.repos.follow_requests, "follower_id", me_id, "followee_id", target_id)
        return {"ok": True}

    def unblock_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.actions.me_id(current_user)
        target_id = serialize_id(parse_object_id(user_id))
        self.actions.delete_relation_pair(self.repos.blocks, "blocker_id", me_id, "blocked_id", target_id)
        return {"ok": True}

    def blocked_users(self, current_user: dict[str, Any]):
        me_id = self.actions.me_id(current_user)
        rows = self.actions.sorted_rows(self.repos.blocks, {"blocker_id": me_id}, 500)
        return self.actions.map_relation_refs(
            rows,
            source_field="blocked_id",
            dto_type=self.actions.dto_types["block"],
            dto_id_field="user_id",
            allow_id=ObjectId.is_valid,
        )
