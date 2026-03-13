from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from models.schemas import MeetupPublic, SpotPublic, SupportTicketPublic, UserPublic

from .ids import as_float, as_text, normalize_id_list, normalize_social_accounts, serialize_id, spot_owner_id, spot_visibility


def to_user_public(doc: dict[str, Any]) -> UserPublic:
    return UserPublic(
        id=serialize_id(doc.get("_id")),
        username=as_text(doc.get("username")),
        email=as_text(doc.get("email")),
        display_name=as_text(doc.get("display_name") or doc.get("username")),
        bio=as_text(doc.get("bio")),
        avatar_image=as_text(doc.get("avatar_image")),
        social_accounts=normalize_social_accounts(doc.get("social_accounts")),
        follow_requires_approval=bool(doc.get("follow_requires_approval", False)),
        created_at=doc.get("created_at") or datetime.now(UTC),
    )


def to_spot_public(doc: dict[str, Any]) -> SpotPublic:
    return SpotPublic(
        id=serialize_id(doc.get("_id")),
        owner_id=spot_owner_id(doc),
        title=as_text(doc.get("title")),
        description=as_text(doc.get("description")),
        tags=[as_text(tag) for tag in doc.get("tags", []) if as_text(tag)],
        lat=as_float(doc.get("lat"), 0.0),
        lon=as_float(doc.get("lon"), 0.0),
        images=[as_text(img) for img in doc.get("images", []) if as_text(img)],
        visibility=spot_visibility(doc),
        invite_user_ids=normalize_id_list(doc.get("invite_user_ids")),
        created_at=doc.get("created_at") or datetime.now(UTC),
    )


def to_support_ticket_public(doc: dict[str, Any]) -> SupportTicketPublic:
    category = as_text(doc.get("category")).lower()
    if category not in {"bug", "feature", "complaint", "question", "other"}:
        category = "other"
    status_text = as_text(doc.get("status")).lower()
    status_value = "open" if status_text != "closed" else "closed"
    return SupportTicketPublic(
        id=serialize_id(doc.get("_id")),
        user_id=as_text(doc.get("user_id")),
        category=category,
        subject=as_text(doc.get("subject")),
        message=as_text(doc.get("message")),
        page=as_text(doc.get("page")),
        contact_email=as_text(doc.get("contact_email")),
        allow_contact=bool(doc.get("allow_contact", False)),
        status=status_value,
        created_at=doc.get("created_at") or datetime.now(UTC),
    )


def to_meetup_public(doc: dict[str, Any]) -> MeetupPublic:
    starts_at = doc.get("starts_at") or datetime.now(UTC)
    created_at = doc.get("created_at") or starts_at
    updated_at = doc.get("updated_at") or created_at
    return MeetupPublic(
        id=serialize_id(doc.get("_id")),
        host_user_id=as_text(doc.get("host_user_id")),
        title=as_text(doc.get("title")),
        description=as_text(doc.get("description")),
        starts_at=starts_at,
        invite_user_ids=normalize_id_list(doc.get("invite_user_ids")),
        created_at=created_at,
        updated_at=updated_at,
    )
