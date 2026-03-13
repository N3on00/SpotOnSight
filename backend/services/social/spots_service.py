from __future__ import annotations

from typing import Any

from bson import ObjectId
from fastapi import HTTPException, status

from models.schemas import SpotPublic, SpotUpsertRequest
from core.social import (
    build_spot_doc,
    can_view_spot,
    is_blocked_pair,
    spot_owner_id,
    to_spot_public,
)

from .base_service import SocialServiceBase


def _canonical_spot_keys(spot_id: str, spot_key: object) -> list[str]:
    keys = [str(spot_id or "").strip(), str(spot_key or "").strip()]
    return [key for key in dict.fromkeys([k for k in keys if k])]


class SpotsService(SocialServiceBase):
    def list_visible_spots(self, current_user: dict[str, Any]) -> list[SpotPublic]:
        me_id = self.me_id(current_user)
        docs = list(self.repos.spots.collection.find({}).sort("created_at", -1).limit(1500))
        return [to_spot_public(doc) for doc in docs if can_view_spot(self.repos, me_id, doc)]

    def create_spot(self, req: SpotUpsertRequest, current_user: dict[str, Any]) -> SpotPublic:
        me_id = self.me_id(current_user)
        doc = build_spot_doc(req, owner_id=me_id)
        inserted_id = self.repos.spots.insert_one(doc)
        created = self.repos.spots.find_one({"_id": ObjectId(inserted_id)})
        if not created:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Spot creation failed")
        return to_spot_public(created)

    def update_spot(self, spot_id: str, req: SpotUpsertRequest, current_user: dict[str, Any]) -> SpotPublic:
        existing = self.spot_or_404(spot_id)
        me_id = self.me_id(current_user)
        owner_id = spot_owner_id(existing)
        if owner_id and owner_id != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can edit this spot")

        spot_key = existing.get("_id")
        next_doc = build_spot_doc(req, owner_id=owner_id or me_id, created_at=existing.get("created_at"))
        self.repos.spots.update_fields({"_id": spot_key}, next_doc)
        updated = self.repos.spots.find_one({"_id": spot_key})
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Spot update failed")
        return to_spot_public(updated)

    def delete_spot(self, spot_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        existing = self.spot_or_404(spot_id)
        me_id = self.me_id(current_user)
        owner_id = spot_owner_id(existing)
        if owner_id and owner_id != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owner can delete this spot")

        spot_key = existing.get("_id")
        spot_keys = _canonical_spot_keys(spot_id, spot_key)
        self.repos.spots.collection.delete_one({"_id": spot_key})
        self.repos.favorites.delete_many({"spot_id": {"$in": spot_keys}})
        self.repos.shares.delete_many({"spot_id": {"$in": spot_keys}})
        self.repos.comments.delete_many({"spot_id": {"$in": spot_keys}})
        return {"ok": True}

    def user_spots(self, user_id: str, current_user: dict[str, Any]) -> list[SpotPublic]:
        target_id, _target = self.user_or_404(user_id)
        me_id = self.me_id(current_user)
        if me_id != target_id and is_blocked_pair(self.repos, me_id, target_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

        docs = list(self.repos.spots.collection.find({"owner_id": target_id}).sort("created_at", -1).limit(1200))
        return [to_spot_public(doc) for doc in docs if can_view_spot(self.repos, me_id, doc)]
