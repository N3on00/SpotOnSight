from __future__ import annotations

from datetime import UTC, datetime

from bson import ObjectId
from fastapi import HTTPException, status

from core.admin_setup import is_admin_user
from models.schemas import SpotComment

from .ids import as_text, serialize_id


class SocialCommentActions:
    def __init__(self, actions) -> None:
        self.actions = actions

    @property
    def repos(self):
        return self.actions.repos

    def to_spot_comment(self, row):
        data = row or {}
        return SpotComment(
            id=serialize_id(data.get("_id")),
            spot_id=as_text(data.get("spot_id")),
            user_id=as_text(data.get("user_id")),
            message=as_text(data.get("message")),
            moderation_status=self.actions._content_status(data),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def list_comments(self, spot_id: str, current_user):
        spot = self.actions.spot_or_404(spot_id)
        self.actions.require_spot_visible(spot, current_user, "Not authorized to view this spot")
        canonical_spot_id = serialize_id(spot.get("_id"))
        rows = self.repos.comments.find_many({"spot_id": canonical_spot_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [self.to_spot_comment(row) for row in rows if self.actions._can_view_content_doc(row, current_user)]

    def create_comment(self, spot_id: str, req, current_user):
        self.actions.ensure_can_post(current_user)
        spot = self.actions.spot_or_404(spot_id)
        me_id = self.actions.require_spot_visible(spot, current_user, "Not authorized to comment on this spot")
        doc = {
            "spot_id": serialize_id(spot.get("_id")),
            "user_id": me_id,
            "message": as_text(req.message),
            "moderation_status": "visible",
            "created_at": datetime.now(UTC),
        }
        inserted_id = self.repos.comments.insert_one(doc)
        row = self.repos.comments.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Comment creation failed")
        return self.to_spot_comment(row)

    def update_comment(self, comment_id: str, req, current_user):
        self.actions.ensure_can_post(current_user)
        existing = self.actions.comment_or_404(comment_id)
        me_id = self.actions.me_id(current_user)
        if existing.get("user_id") != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")
        self.repos.comments.update_fields({"_id": ObjectId(comment_id)}, {"message": as_text(req.message), "updated_at": datetime.now(UTC)})
        row = self.repos.comments.find_one({"_id": ObjectId(comment_id)})
        return self.to_spot_comment(row)

    def delete_comment(self, comment_id: str, current_user):
        existing = self.actions.comment_or_404(comment_id)
        me_id = self.actions.me_id(current_user)
        if existing.get("user_id") != me_id and not is_admin_user(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")
        self.repos.comments.delete_one_by_query({"_id": ObjectId(comment_id)})
        return {"ok": True, "deleted": True}
