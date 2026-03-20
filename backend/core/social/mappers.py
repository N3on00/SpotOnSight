from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from models.schemas import (
    MeetupPublic,
    ModerationNotificationPublic,
    ModerationReportPublic,
    ModerationUserPublic,
    SpotPublic,
    SupportTicketPublic,
    UserPublic,
)

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
        is_admin=bool(doc.get("is_admin", False)),
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
        moderation_status=as_text(doc.get("moderation_status") or "visible").lower() if as_text(doc.get("moderation_status") or "visible").lower() in {"visible", "flagged", "hidden"} else "visible",
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
        moderation_status=as_text(doc.get("moderation_status") or "visible").lower() if as_text(doc.get("moderation_status") or "visible").lower() in {"visible", "flagged", "hidden"} else "visible",
        created_at=created_at,
        updated_at=updated_at,
    )


def to_moderation_report_public(doc: dict[str, Any]) -> ModerationReportPublic:
    status_text = as_text(doc.get("status") or "open").lower()
    if status_text not in {"open", "upheld", "dismissed"}:
        status_text = "open"
    return ModerationReportPublic(
        id=serialize_id(doc.get("_id")),
        reporter_user_id=as_text(doc.get("reporter_user_id")),
        target_type=as_text(doc.get("target_type")),
        target_id=as_text(doc.get("target_id")),
        target_owner_user_id=as_text(doc.get("target_owner_user_id")),
        reason=as_text(doc.get("reason") or "other"),
        details=as_text(doc.get("details")),
        status=status_text,
        severity=as_text(doc.get("severity")),
        action_taken=as_text(doc.get("action_taken")),
        admin_notes=as_text(doc.get("admin_notes")),
        created_at=doc.get("created_at") or datetime.now(UTC),
        reviewed_at=doc.get("reviewed_at"),
        reviewed_by=as_text(doc.get("reviewed_by")),
    )


def to_moderation_notification_public(doc: dict[str, Any]) -> ModerationNotificationPublic:
    return ModerationNotificationPublic(
        id=serialize_id(doc.get("_id")),
        user_id=as_text(doc.get("user_id")),
        title=as_text(doc.get("title")),
        message=as_text(doc.get("message")),
        details=as_text(doc.get("details")),
        created_at=doc.get("created_at") or datetime.now(UTC),
    )


def to_moderation_user_public(doc: dict[str, Any], *, active_strike_weight: int = 0, recent_strike_count: int = 0) -> ModerationUserPublic:
    status_text = as_text(doc.get("account_status") or "active").lower()
    if status_text not in {"active", "watch", "banned"}:
        status_text = "active"
    return ModerationUserPublic(
        id=serialize_id(doc.get("_id")),
        username=as_text(doc.get("username")),
        email=as_text(doc.get("email")),
        display_name=as_text(doc.get("display_name") or doc.get("username")),
        account_status=status_text,
        account_status_reason=as_text(doc.get("account_status_reason")),
        posting_timeout_until=doc.get("posting_timeout_until"),
        active_strike_weight=max(0, int(active_strike_weight or 0)),
        recent_strike_count=max(0, int(recent_strike_count or 0)),
        created_at=doc.get("created_at") or datetime.now(UTC),
    )
