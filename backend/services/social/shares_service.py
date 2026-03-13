from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from models.schemas import ShareRequest
from core.social import serialize_id

from .base_service import SocialServiceBase


class SharesService(SocialServiceBase):
    def share_spot(self, spot_id: str, req: ShareRequest, current_user: dict[str, Any]) -> dict[str, bool]:
        spot = self.spot_or_404(spot_id)
        me_id = self.require_spot_visible(spot, current_user, "Spot is not visible to you")
        self.repos.shares.insert_one(
            {
                "user_id": me_id,
                "spot_id": serialize_id(spot.get("_id")),
                "message": req.message,
                "created_at": datetime.now(UTC),
            }
        )
        return {"ok": True}
