from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Callable

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from core.social import (
    SocialRepositories,
    as_text,
    can_view_private_user,
    can_view_spot,
    parse_object_id,
    safe_user_projection,
    serialize_id,
    spot_document_by_id,
    viewer_user_id,
)


class SocialServiceBase:
    def __init__(self, repos: SocialRepositories) -> None:
        self.repos = repos

    def me_id(self, current_user: dict[str, Any]) -> str:
        return viewer_user_id(current_user)

    def user_or_404(self, user_id: str) -> tuple[str, dict[str, Any]]:
        target_oid = parse_object_id(user_id)
        target = self.repos.users.find_one({"_id": target_oid}, safe_user_projection())
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return serialize_id(target_oid), target

    def require_private_profile_access(self, target_user: dict[str, Any], current_user: dict[str, Any]) -> str:
        me_id = self.me_id(current_user)
        if not can_view_private_user(self.repos, target_user, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User profile is private")
        return me_id

    def spot_or_404(self, spot_id: str) -> dict[str, Any]:
        spot = spot_document_by_id(self.repos, spot_id)
        if not spot:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spot not found")
        return spot

    def require_spot_visible(self, spot: dict[str, Any], current_user: dict[str, Any], detail: str) -> str:
        me_id = self.me_id(current_user)
        if not can_view_spot(self.repos, me_id, spot):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
        return me_id

    def comment_or_404(self, comment_id: str) -> dict[str, Any]:
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
        row = self.repos.comments.find_one({"_id": ObjectId(comment_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        return row

    def meetup_or_404(self, meetup_id: str) -> dict[str, Any]:
        if not ObjectId.is_valid(meetup_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meetup ID")
        row = self.repos.meetups.find_one({"_id": ObjectId(meetup_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meetup not found")
        return row

    def can_access_meetup(self, meetup: dict[str, Any], user_id: str) -> bool:
        host_id = as_text(meetup.get("host_user_id"))
        if host_id and host_id == user_id:
            return True
        meetup_id = serialize_id(meetup.get("_id"))
        invite = self.repos.meetup_invites.find_one({"meetup_id": meetup_id, "user_id": user_id})
        return bool(invite)

    def sorted_rows(self, collection, query: dict[str, Any], limit: int) -> list[dict[str, Any]]:
        return list(collection.find(query).sort("created_at", -1).limit(limit))

    def map_relation_refs(
        self,
        rows: list[dict[str, Any]],
        *,
        source_field: str,
        dto_type,
        dto_id_field: str,
        allow_id: Callable[[str], bool] | None = None,
    ) -> list[Any]:
        out = []
        for row in rows:
            related_id = as_text(row.get(source_field))
            if not related_id:
                continue
            if allow_id and not allow_id(related_id):
                continue
            out.append(
                dto_type(
                    **{
                        dto_id_field: related_id,
                        "created_at": row.get("created_at") or datetime.now(UTC),
                    }
                )
            )
        return out

    def insert_relation_ignore_duplicate(self, collection, document: dict[str, Any]) -> None:
        try:
            collection.insert_one(document)
        except DuplicateKeyError:
            pass

    def upsert_relation_timestamp(self, collection, query: dict[str, Any]) -> None:
        collection.update_one(query, {"$set": {"created_at": datetime.now(UTC)}}, upsert=True)

    def delete_relation_pair(self, collection, left_field: str, left_id: str, right_field: str, right_id: str) -> None:
        collection.delete_one({left_field: left_id, right_field: right_id})

    def delete_bidirectional_relation_pairs(self, collection, left_field: str, left_id: str, right_field: str, right_id: str) -> None:
        collection.delete_many(
            {
                "$or": [
                    {left_field: left_id, right_field: right_id},
                    {left_field: right_id, right_field: left_id},
                ]
            }
        )
