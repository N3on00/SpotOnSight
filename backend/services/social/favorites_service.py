from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from models.schemas import FavoriteRef
from core.social import as_text, serialize_id, visible_favorite_refs

from .base_service import SocialServiceBase


class FavoritesService(SocialServiceBase):
    def add_favorite(self, spot_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        spot = self.spot_or_404(spot_id)
        me_id = self.require_spot_visible(spot, current_user, "Spot is not visible to you")
        doc = {"user_id": me_id, "spot_id": serialize_id(spot.get("_id")), "created_at": datetime.now(UTC)}
        self.insert_relation_ignore_duplicate(self.repos.favorites.collection, doc)
        return {"ok": True}

    def remove_favorite(self, spot_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.me_id(current_user)
        canonical_values = [as_text(spot_id)]
        if ObjectId.is_valid(spot_id):
            canonical_values.append(serialize_id(ObjectId(spot_id)))
        canonical_values = [value for value in dict.fromkeys([v for v in canonical_values if v])]
        self.repos.favorites.collection.delete_many({"user_id": me_id, "spot_id": {"$in": canonical_values}})
        return {"ok": True}

    def list_favorites(self, current_user: dict[str, Any]) -> list[FavoriteRef]:
        me_id = self.me_id(current_user)
        rows = list(self.repos.favorites.collection.find({"user_id": me_id}).sort("created_at", -1).limit(2000))
        return visible_favorite_refs(self.repos, rows, me_id)

    def user_favorites(self, user_id: str, current_user: dict[str, Any]) -> list[FavoriteRef]:
        _target_id, target = self.user_or_404(user_id)
        me_id = self.require_private_profile_access(target, current_user)
        rows = list(self.repos.favorites.collection.find({"user_id": user_id}).sort("created_at", -1).limit(2000))
        return visible_favorite_refs(self.repos, rows, me_id)
