from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId

from models.schemas import FavoriteRef, SpotUpsertRequest

from .ids import as_float, as_text, normalize_id_list, serialize_id
from .policies import can_view_spot
from .repositories import SocialRepositories


def build_spot_doc(payload: SpotUpsertRequest, owner_id: str, created_at: datetime | None = None) -> dict[str, Any]:
    return {
        "owner_id": owner_id,
        "title": as_text(payload.title),
        "description": as_text(payload.description),
        "tags": [as_text(tag) for tag in payload.tags if as_text(tag)],
        "lat": as_float(payload.lat, 0.0),
        "lon": as_float(payload.lon, 0.0),
        "images": [as_text(img) for img in payload.images if as_text(img)],
        "visibility": payload.visibility,
        "invite_user_ids": normalize_id_list(payload.invite_user_ids),
        "created_at": created_at or datetime.now(UTC),
    }


def visible_favorite_refs(r: SocialRepositories, rows: list[dict[str, Any]], viewer_user_id_value: str) -> list[FavoriteRef]:
    spot_ids = [as_text(row.get("spot_id")) for row in rows]
    unique_spot_ids = list(dict.fromkeys([sid for sid in spot_ids if sid]))
    if not unique_spot_ids:
        return []
    lookup_ids: list[Any] = []
    for sid in unique_spot_ids:
        lookup_ids.append(sid)
        if ObjectId.is_valid(sid):
            lookup_ids.append(ObjectId(sid))
    spot_docs = list(r.spots.collection.find({"_id": {"$in": lookup_ids}}))
    visible_ids = {serialize_id(doc.get("_id")) for doc in spot_docs if can_view_spot(r, viewer_user_id_value, doc)}
    out: list[FavoriteRef] = []
    for row in rows:
        sid = as_text(row.get("spot_id"))
        if sid not in visible_ids:
            continue
        out.append(FavoriteRef(spot_id=sid, created_at=row.get("created_at") or datetime.now(UTC)))
    return out
