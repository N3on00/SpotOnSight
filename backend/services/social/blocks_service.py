from __future__ import annotations

from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from models.schemas import BlockRef
from core.social import parse_object_id, serialize_id

from .base_service import SocialServiceBase


class BlocksService(SocialServiceBase):
    def block_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.me_id(current_user)
        target_id = serialize_id(parse_object_id(user_id))
        if me_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself")
        self.upsert_relation_timestamp(self.repos.blocks.collection, {"blocker_id": me_id, "blocked_id": target_id})
        self.delete_bidirectional_relation_pairs(self.repos.follows.collection, "follower_id", me_id, "followee_id", target_id)
        self.delete_bidirectional_relation_pairs(self.repos.follow_requests.collection, "follower_id", me_id, "followee_id", target_id)
        return {"ok": True}

    def unblock_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.me_id(current_user)
        target_id = serialize_id(parse_object_id(user_id))
        self.delete_relation_pair(self.repos.blocks.collection, "blocker_id", me_id, "blocked_id", target_id)
        return {"ok": True}

    def blocked_users(self, current_user: dict[str, Any]) -> list[BlockRef]:
        me_id = self.me_id(current_user)
        rows = self.sorted_rows(self.repos.blocks.collection, {"blocker_id": me_id}, 500)
        return self.map_relation_refs(rows, source_field="blocked_id", dto_type=BlockRef, dto_id_field="user_id", allow_id=ObjectId.is_valid)
