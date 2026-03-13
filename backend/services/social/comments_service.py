from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from models.schemas import CommentCreateRequest, CommentUpdateRequest, SpotComment
from core.admin_setup import is_admin_user
from core.social import as_text, serialize_id

from .base_service import SocialServiceBase


class CommentsService(SocialServiceBase):
    def list_comments(self, spot_id: str, current_user: dict[str, Any]) -> list[SpotComment]:
        spot = self.spot_or_404(spot_id)
        self.require_spot_visible(spot, current_user, "Not authorized to view this spot")
        canonical_spot_id = serialize_id(spot.get("_id"))
        rows = self.repos.comments.find_many({"spot_id": canonical_spot_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [SpotComment(**row) for row in rows]

    def create_comment(self, spot_id: str, req: CommentCreateRequest, current_user: dict[str, Any]) -> SpotComment:
        spot = self.spot_or_404(spot_id)
        me_id = self.require_spot_visible(spot, current_user, "Not authorized to comment on this spot")
        doc = {
            "spot_id": serialize_id(spot.get("_id")),
            "user_id": me_id,
            "message": as_text(req.message),
            "created_at": datetime.now(UTC),
        }
        inserted_id = self.repos.comments.insert_one(doc)
        row = self.repos.comments.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Comment creation failed")
        return SpotComment(**row)

    def update_comment(self, comment_id: str, req: CommentUpdateRequest, current_user: dict[str, Any]) -> SpotComment:
        existing = self.comment_or_404(comment_id)
        me_id = self.me_id(current_user)
        if existing.get("user_id") != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")
        self.repos.comments.update_fields({"_id": ObjectId(comment_id)}, {"message": as_text(req.message), "updated_at": datetime.now(UTC)})
        row = self.repos.comments.find_one({"_id": ObjectId(comment_id)})
        return SpotComment(**row)

    def delete_comment(self, comment_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        existing = self.comment_or_404(comment_id)
        me_id = self.me_id(current_user)
        if existing.get("user_id") != me_id and not is_admin_user(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")
        self.repos.comments.collection.delete_one({"_id": ObjectId(comment_id)})
        return {"ok": True, "deleted": True}
