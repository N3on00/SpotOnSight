from __future__ import annotations

from datetime import UTC, datetime, timedelta
import re
from typing import Any, Callable

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from core.admin_setup import is_admin_user
from core.text import normalize_email, normalize_search_text, normalize_username
from models.schemas import (
    BlockRef,
    CommentCreateRequest,
    CommentUpdateRequest,
    FavoriteRef,
    FollowRef,
    FollowRequestRef,
    MeetupNotificationPublic,
    ModerationNotificationPublic,
    ModerationReportCreateRequest,
    ModerationReportPublic,
    ModerationReportReviewRequest,
    ModerationUserPublic,
    ModerationUserStatusRequest,
    MeetupComment,
    MeetupCommentCreateRequest,
    MeetupCommentUpdateRequest,
    MeetupCreateRequest,
    MeetupInviteRef,
    MeetupPublic,
    MeetupRespondRequest,
    MeetupUpdateRequest,
    ShareRequest,
    SpotComment,
    SpotPublic,
    SpotUpsertRequest,
    SupportTicketPublic,
    SupportTicketRequest,
    UpdateProfileRequest,
    UserPublic,
)
from repositories.auth_repository import get_auth_user_repository
from services.auth.password_service import password_service

from .builders import build_spot_doc, visible_favorite_refs
from .ids import (
    as_text,
    normalize_login,
    normalize_social_accounts,
    parse_object_id,
    safe_user_projection,
    serialize_id,
    spot_document_by_id,
    spot_owner_id,
    viewer_user_id,
)
from .indexes import ensure_indexes
from .mappers import to_meetup_notification_public, to_meetup_public, to_moderation_notification_public, to_moderation_report_public
from .mappers import to_moderation_user_public, to_moderation_user_summary, to_spot_public
from .mappers import to_support_ticket_public, to_user_public
from .policies import can_view_private_user, can_view_spot, is_blocked_pair, is_following
from .spot_workflows import SpotWorkflowExecutor


def normalize_invite_status(value: Any) -> str:
    text = as_text(value).lower()
    if text in {"pending", "accepted", "declined"}:
        return text
    return "pending"


class SocialActions:
    def __init__(self, repos) -> None:
        self.repos = repos
        self.spot_workflows = SpotWorkflowExecutor(self)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC)

    @staticmethod
    def _content_status(doc: dict[str, Any]) -> str:
        text = as_text(doc.get("moderation_status") or "visible").lower()
        if text in {"visible", "flagged", "hidden"}:
            return text
        return "visible"

    def is_admin(self, current_user: dict[str, Any]) -> bool:
        return is_admin_user(current_user)

    def _can_view_content_doc(self, doc: dict[str, Any], current_user: dict[str, Any]) -> bool:
        if self.is_admin(current_user):
            return True
        return self._content_status(doc) != "hidden"

    def _posting_timeout_until(self, user_doc: dict[str, Any]) -> datetime | None:
        value = user_doc.get("posting_timeout_until")
        return value if isinstance(value, datetime) else None

    def ensure_can_post(self, current_user: dict[str, Any]) -> None:
        if self.is_admin(current_user):
            return
        timeout_until = self._posting_timeout_until(current_user)
        now = self._now()
        if timeout_until and timeout_until > now:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Posting is temporarily restricted until {timeout_until.isoformat()}",
            )

    def _target_content(self, target_type: str, target_id: str) -> tuple[dict[str, Any], str]:
        normalized = as_text(target_type).lower()
        if normalized == "spot":
            target = self.spot_or_404(target_id)
            return target, spot_owner_id(target)
        if normalized == "comment":
            target = self.comment_or_404(target_id)
            return target, as_text(target.get("user_id"))
        if normalized == "meetup":
            target = self.meetup_or_404(target_id)
            return target, as_text(target.get("host_user_id"))
        if normalized == "meetup_comment":
            if not ObjectId.is_valid(target_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
            target = self.repos.meetup_comments.find_one({"_id": ObjectId(target_id)})
            if not target:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
            return target, as_text(target.get("user_id"))
        if normalized == "user":
            user_id, target = self.user_or_404(target_id)
            return target, user_id
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported moderation target")

    def _notify_user(self, user_id: str, *, title: str, message: str, details: str = "") -> None:
        uid = as_text(user_id)
        if not uid:
            return
        self.repos.moderation_notifications.insert_one(
            {
                "user_id": uid,
                "title": as_text(title),
                "message": as_text(message),
                "details": as_text(details),
                "created_at": self._now(),
            }
        )

    def _notify_meetup(
        self,
        user_id: str,
        *,
        meetup_id: str,
        meetup_title: str,
        notification_type: str,
        from_user_id: str,
        from_username: str,
        message: str = "",
    ) -> None:
        uid = as_text(user_id)
        if not uid:
            return
        self.repos.meetup_notifications.insert_one(
            {
                "user_id": uid,
                "meetup_id": as_text(meetup_id),
                "meetup_title": as_text(meetup_title),
                "notification_type": as_text(notification_type),
                "from_user_id": as_text(from_user_id),
                "from_username": as_text(from_username),
                "message": as_text(message),
                "created_at": self._now(),
            }
        )

    @staticmethod
    def _severity_weight(severity: str) -> int:
        normalized = as_text(severity).lower()
        if normalized == "high":
            return 3
        if normalized == "medium":
            return 2
        return 1

    def _recent_strike_metrics(self, user_id: str) -> tuple[int, int]:
        now = self._now()
        rows = self.repos.moderation_strikes.find_many({"user_id": user_id, "created_at": {"$gte": now - timedelta(days=30)}})
        total_weight = 0
        count = 0
        for row in rows:
            total_weight += max(0, int(row.get("weight") or 0))
            count += 1
        return total_weight, count

    def _user_summary(self, user_id: str) -> dict[str, Any] | None:
        uid = as_text(user_id)
        if not ObjectId.is_valid(uid):
            return None
        user_doc = self.repos.users.find_one({"_id": ObjectId(uid)}, safe_user_projection())
        summary = to_moderation_user_summary(user_doc)
        return summary.model_dump() if summary else None

    def _reported_person_id(self, row: dict[str, Any]) -> str:
        target_type = as_text(row.get("target_type")).lower()
        if target_type == "user":
            return as_text(row.get("target_id"))
        return as_text(row.get("target_owner_user_id"))

    def _target_preview(self, row: dict[str, Any]) -> dict[str, Any] | None:
        target_type = as_text(row.get("target_type")).lower()
        target_id = as_text(row.get("target_id"))
        if not target_id:
            return None

        try:
            target, owner_id = self._target_content(target_type, target_id)
        except HTTPException:
            return None

        if target_type == "spot":
            return {
                "id": target_id,
                "label": as_text(target.get("title")) or "Untitled spot",
                "subtitle": as_text(target.get("tags", [])[0]) if isinstance(target.get("tags"), list) and target.get("tags") else "Spot",
                "body": as_text(target.get("description")),
                "owner_user_id": owner_id,
                "spot_id": target_id,
                "lat": target.get("lat"),
                "lon": target.get("lon"),
                "moderation_status": as_text(target.get("moderation_status") or "visible"),
            }
        if target_type == "comment":
            return {
                "id": target_id,
                "label": "Spot comment",
                "subtitle": f"On spot {as_text(target.get('spot_id'))}" if as_text(target.get("spot_id")) else "Comment",
                "body": as_text(target.get("message")),
                "owner_user_id": owner_id,
                "spot_id": as_text(target.get("spot_id")),
                "moderation_status": as_text(target.get("moderation_status") or "visible"),
            }
        if target_type == "meetup":
            return {
                "id": target_id,
                "label": as_text(target.get("title")) or "Untitled meetup",
                "subtitle": "Meetup",
                "body": as_text(target.get("description")),
                "owner_user_id": owner_id,
                "moderation_status": as_text(target.get("moderation_status") or "visible"),
            }
        if target_type == "meetup_comment":
            return {
                "id": target_id,
                "label": "Meetup comment",
                "subtitle": f"On meetup {as_text(target.get('meetup_id'))}" if as_text(target.get("meetup_id")) else "Comment",
                "body": as_text(target.get("message")),
                "owner_user_id": owner_id,
                "moderation_status": as_text(target.get("moderation_status") or "visible"),
            }
        if target_type == "user":
            return {
                "id": target_id,
                "label": as_text(target.get("display_name") or target.get("username")) or "User",
                "subtitle": f"@{as_text(target.get('username'))}" if as_text(target.get("username")) else "User account",
                "body": as_text(target.get("bio")),
                "owner_user_id": owner_id,
            }
        return None

    def _moderation_report_metrics(self, row: dict[str, Any]) -> tuple[int, int, int]:
        target_person_id = self._reported_person_id(row)
        reporter_id = as_text(row.get("reporter_user_id"))

        target_distinct_reporters = 0
        target_report_count = 0
        if target_person_id:
            related = self.repos.moderation_reports.find_many({
                "$or": [
                    {"target_type": "user", "target_id": target_person_id},
                    {"target_owner_user_id": target_person_id},
                ]
            })
            target_report_count = len(related)
            target_distinct_reporters = len({as_text(item.get("reporter_user_id")) for item in related if as_text(item.get("reporter_user_id"))})

        reporter_distinct_targets = 0
        if reporter_id:
            related = self.repos.moderation_reports.find_many({"reporter_user_id": reporter_id})
            reporter_distinct_targets = len({self._reported_person_id(item) for item in related if self._reported_person_id(item)})

        return target_distinct_reporters, target_report_count, reporter_distinct_targets

    def _moderation_report_public(self, row: dict[str, Any]) -> ModerationReportPublic:
        enriched = dict(row)
        enriched["reporter_user"] = self._user_summary(as_text(row.get("reporter_user_id")))
        enriched["target_owner_user"] = self._user_summary(as_text(row.get("target_owner_user_id")))
        if as_text(row.get("target_type")).lower() == "user":
            enriched["target_user"] = self._user_summary(as_text(row.get("target_id")))
        else:
            enriched["target_user"] = enriched.get("target_owner_user")
        enriched["target_preview"] = self._target_preview(row)
        (
            enriched["target_distinct_reporter_count"],
            enriched["target_report_count"],
            enriched["reporter_distinct_target_count"],
        ) = self._moderation_report_metrics(row)
        return to_moderation_report_public(enriched)

    def _recalculate_posting_timeout(self, user_id: str) -> tuple[datetime | None, str]:
        now = self._now()
        user_doc = self.repos.users.find_one({"_id": ObjectId(user_id)}) or {}
        if as_text(user_doc.get("account_status")).lower() == "banned":
            return None, as_text(user_doc.get("account_status_reason"))
        windows = [
            (7, 3, timedelta(hours=24), "Posting is paused for 24 hours after repeated recent strikes."),
            (14, 5, timedelta(days=7), "Posting is paused for 7 days due to repeated violations."),
            (30, 7, timedelta(days=30), "Posting is paused for 30 days and your account now requires manual review."),
        ]
        timeout_until: datetime | None = None
        message = ""
        for days, threshold, duration, detail in windows:
            rows = self.repos.moderation_strikes.find_many({"user_id": user_id, "created_at": {"$gte": now - timedelta(days=days)}})
            total_weight = sum(max(0, int(row.get("weight") or 0)) for row in rows)
            if total_weight >= threshold:
                candidate = now + duration
                if timeout_until is None or candidate > timeout_until:
                    timeout_until = candidate
                    message = detail
        self.repos.users.update_fields(
            {"_id": ObjectId(user_id)},
            {
                "posting_timeout_until": timeout_until,
                "account_status": "watch" if timeout_until else "active",
                "account_status_reason": message if timeout_until else as_text(""),
            },
        )
        return timeout_until, message

    def _apply_strike(self, *, user_id: str, target_type: str, target_id: str, report_id: str, reason: str, severity: str, reviewed_by: str) -> tuple[int, datetime | None, str]:
        weight = self._severity_weight(severity)
        self.repos.moderation_strikes.insert_one(
            {
                "user_id": user_id,
                "target_type": as_text(target_type),
                "target_id": as_text(target_id),
                "report_id": as_text(report_id),
                "reason": as_text(reason),
                "severity": as_text(severity),
                "weight": weight,
                "reviewed_by": as_text(reviewed_by),
                "created_at": self._now(),
            }
        )
        timeout_until, timeout_message = self._recalculate_posting_timeout(user_id)
        return weight, timeout_until, timeout_message

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
        if self.is_admin(current_user):
            return me_id
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
        if self.is_admin(current_user):
            return me_id
        if self._content_status(spot) == "hidden":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
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
        if user_id and ObjectId.is_valid(user_id):
            current_user = self.repos.users.find_one({"_id": ObjectId(user_id)})
            if current_user and self.is_admin(current_user):
                return True
        if self._content_status(meetup) == "hidden":
            return False
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
            out.append(dto_type(**{dto_id_field: related_id, "created_at": row.get("created_at") or datetime.now(UTC)}))
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
        collection.delete_many({"$or": [{left_field: left_id, right_field: right_id}, {left_field: right_id, right_field: left_id}]})

    def get_me(self, current_user: dict[str, Any]) -> UserPublic:
        return to_user_public(current_user)

    def update_me(self, req: UpdateProfileRequest, current_user: dict[str, Any]) -> UserPublic:
        ensure_indexes()
        updates: dict[str, Any] = {}
        if req.username is not None:
            username = normalize_username(req.username)
            updates["username"] = username
            updates["username_key"] = normalize_search_text(username)
            updates["username_search"] = normalize_search_text(username)
        if req.email is not None:
            email = normalize_email(req.email)
            updates["email"] = email
            updates["email_key"] = normalize_email(email)
        if req.display_name is not None:
            updates["display_name"] = as_text(req.display_name)
            updates["display_name_search"] = normalize_search_text(req.display_name)
        if req.bio is not None:
            updates["bio"] = as_text(req.bio)
        if req.avatar_image is not None:
            updates["avatar_image"] = as_text(req.avatar_image)
        if req.social_accounts is not None:
            updates["social_accounts"] = normalize_social_accounts(req.social_accounts)
        if req.follow_requires_approval is not None:
            updates["follow_requires_approval"] = bool(req.follow_requires_approval)
        if req.new_password is not None:
            current_password = as_text(req.current_password)
            if not current_password:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is required")
            current_hash = as_text(current_user.get("password_hash"))
            if not password_service.verify_password(current_password, current_hash):
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")
            updates["password_hash"] = password_service.hash_password(req.new_password)
        if not updates:
            return to_user_public(current_user)
        try:
            self.repos.users.update_fields({"_id": current_user["_id"]}, updates)
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc
        updated = self.repos.users.find_one({"_id": current_user["_id"]})
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Profile update failed")
        return to_user_public(updated)

    def search_users(self, query: str, limit: int, current_user: dict[str, Any]) -> list[UserPublic]:
        text = normalize_search_text(query)
        if not text:
            return []
        me_id = viewer_user_id(current_user)
        regex = re.compile(re.escape(text), re.IGNORECASE)
        users = list(self.repos.users.collection.find({
            "$or": [
                {"username_search": regex},
                {"display_name_search": regex},
                {"username": regex},
                {"display_name": regex},
            ]
        }, safe_user_projection()).limit(limit))
        out: list[UserPublic] = []
        for user_doc in users:
            user_id = serialize_id(user_doc.get("_id"))
            if user_id == me_id or is_blocked_pair(self.repos, me_id, user_id):
                continue
            out.append(to_user_public(user_doc))
        return out

    def get_user_profile(self, user_id: str, current_user: dict[str, Any]) -> UserPublic:
        target_id, target = self.user_or_404(user_id)
        me_id = viewer_user_id(current_user)
        if not self.is_admin(current_user) and me_id != target_id and is_blocked_pair(self.repos, me_id, target_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        active_weight = 0
        recent_count = 0
        if self.is_admin(current_user):
            active_weight, recent_count = self._recent_strike_metrics(target_id)
        return to_user_public(target, active_strike_weight=active_weight, recent_strike_count=recent_count)

    def list_visible_spots(self, current_user: dict[str, Any]) -> list[SpotPublic]:
        return self.spot_workflows.list_visible_spots(current_user)

    def create_spot(self, req: SpotUpsertRequest, current_user: dict[str, Any]) -> SpotPublic:
        return self.spot_workflows.create_spot(req, current_user)

    def update_spot(self, spot_id: str, req: SpotUpsertRequest, current_user: dict[str, Any]) -> SpotPublic:
        return self.spot_workflows.update_spot(spot_id, req, current_user)

    def delete_spot(self, spot_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        return self.spot_workflows.delete_spot(spot_id, current_user)

    def user_spots(self, user_id: str, current_user: dict[str, Any]) -> list[SpotPublic]:
        return self.spot_workflows.user_spots(user_id, current_user)

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

    def follow_requests(self, current_user: dict[str, Any]) -> list[FollowRequestRef]:
        me_id = self.me_id(current_user)
        rows = self.sorted_rows(self.repos.follow_requests.collection, {"followee_id": me_id}, 500)
        return self.map_relation_refs(rows, source_field="follower_id", dto_type=FollowRequestRef, dto_id_field="follower_id", allow_id=ObjectId.is_valid)

    def approve_follow_request(self, follower_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        follower_sid = serialize_id(parse_object_id(follower_id))
        me_id = self.me_id(current_user)
        request_row = self.repos.follow_requests.find_one({"follower_id": follower_sid, "followee_id": me_id})
        if not request_row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow request not found")
        self.insert_relation_ignore_duplicate(self.repos.follows.collection, {"follower_id": follower_sid, "followee_id": me_id, "created_at": datetime.now(UTC)})
        self.delete_relation_pair(self.repos.follow_requests.collection, "follower_id", follower_sid, "followee_id", me_id)
        return {"ok": True}

    def reject_follow_request(self, follower_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        follower_sid = serialize_id(parse_object_id(follower_id))
        me_id = self.me_id(current_user)
        self.delete_relation_pair(self.repos.follow_requests.collection, "follower_id", follower_sid, "followee_id", me_id)
        return {"ok": True}

    def follow_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, str | bool]:
        target_id, target_user = self.user_or_404(user_id)
        me_id = self.me_id(current_user)
        if me_id == target_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")
        if is_blocked_pair(self.repos, me_id, target_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot follow this user")
        if is_following(self.repos, me_id, target_id):
            return {"ok": True, "status": "following"}
        if bool(target_user.get("follow_requires_approval", False)):
            self.upsert_relation_timestamp(self.repos.follow_requests.collection, {"follower_id": me_id, "followee_id": target_id})
            return {"ok": True, "status": "pending"}
        self.insert_relation_ignore_duplicate(self.repos.follows.collection, {"follower_id": me_id, "followee_id": target_id, "created_at": datetime.now(UTC)})
        self.delete_relation_pair(self.repos.follow_requests.collection, "follower_id", me_id, "followee_id", target_id)
        return {"ok": True, "status": "following"}

    def unfollow_user(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.me_id(current_user)
        target_id = serialize_id(parse_object_id(user_id))
        self.delete_relation_pair(self.repos.follows.collection, "follower_id", me_id, "followee_id", target_id)
        self.delete_relation_pair(self.repos.follow_requests.collection, "follower_id", me_id, "followee_id", target_id)
        return {"ok": True}

    def followers(self, user_id: str, current_user: dict[str, Any]) -> list[FollowRef]:
        target_id, target_user = self.user_or_404(user_id)
        me_id = self.require_private_profile_access(target_user, current_user)
        rows = self.sorted_rows(self.repos.follows.collection, {"followee_id": target_id}, 1200)
        return self.map_relation_refs(rows, source_field="follower_id", dto_type=FollowRef, dto_id_field="user_id", allow_id=lambda related_id: ObjectId.is_valid(related_id) and not is_blocked_pair(self.repos, me_id, related_id))

    def following(self, user_id: str, current_user: dict[str, Any]) -> list[FollowRef]:
        target_id, target_user = self.user_or_404(user_id)
        me_id = self.require_private_profile_access(target_user, current_user)
        rows = self.sorted_rows(self.repos.follows.collection, {"follower_id": target_id}, 1200)
        return self.map_relation_refs(rows, source_field="followee_id", dto_type=FollowRef, dto_id_field="user_id", allow_id=lambda related_id: ObjectId.is_valid(related_id) and not is_blocked_pair(self.repos, me_id, related_id))

    def remove_follower(self, user_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.me_id(current_user)
        follower_id = serialize_id(parse_object_id(user_id))
        self.delete_relation_pair(self.repos.follows.collection, "follower_id", follower_id, "followee_id", me_id)
        self.delete_relation_pair(self.repos.follow_requests.collection, "follower_id", follower_id, "followee_id", me_id)
        return {"ok": True}

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

    def share_spot(self, spot_id: str, req: ShareRequest, current_user: dict[str, Any]) -> dict[str, bool]:
        spot = self.spot_or_404(spot_id)
        me_id = self.require_spot_visible(spot, current_user, "Spot is not visible to you")
        self.repos.shares.insert_one({"user_id": me_id, "spot_id": serialize_id(spot.get("_id")), "message": req.message, "created_at": datetime.now(UTC)})
        return {"ok": True}

    def create_support_ticket(self, req: SupportTicketRequest, current_user: dict[str, Any]) -> SupportTicketPublic:
        me_id = self.me_id(current_user)
        contact_email = as_text(req.contact_email or current_user.get("email"))
        if contact_email and "@" not in contact_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid contact email format")
        now = datetime.now(UTC)
        doc = {
            "user_id": me_id,
            "category": req.category,
            "subject": as_text(req.subject),
            "message": as_text(req.message),
            "page": as_text(req.page),
            "contact_email": contact_email,
            "allow_contact": bool(req.allow_contact),
            "technical_details": as_text(req.technical_details),
            "status": "open",
            "created_at": now,
            "updated_at": now,
        }
        inserted_id = self.repos.support_tickets.insert_one(doc)
        row = self.repos.support_tickets.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Support ticket creation failed")
        return to_support_ticket_public(row)

    def list_all_support_tickets(self) -> list[SupportTicketPublic]:
        cursor = self.repos.support_tickets.collection.find().sort("created_at", -1)
        return [to_support_ticket_public(doc) for doc in cursor]

    def update_ticket_status(self, ticket_id: str, ticket_status: str) -> SupportTicketPublic:
        if ticket_status not in ("open", "closed"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Status must be 'open' or 'closed'")
        if not ObjectId.is_valid(ticket_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ticket ID")
        self.repos.support_tickets.update_fields({"_id": ObjectId(ticket_id)}, {"status": ticket_status, "updated_at": datetime.now(UTC)})
        row = self.repos.support_tickets.find_one({"_id": ObjectId(ticket_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        return to_support_ticket_public(row)

    def delete_ticket(self, ticket_id: str) -> dict[str, bool]:
        if not ObjectId.is_valid(ticket_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ticket ID")
        result = self.repos.support_tickets.collection.delete_one({"_id": ObjectId(ticket_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
        return {"ok": True, "deleted": True}

    def create_moderation_report(self, req: ModerationReportCreateRequest, current_user: dict[str, Any]) -> ModerationReportPublic:
        ensure_indexes()
        reporter_id = self.me_id(current_user)
        target, target_owner_id = self._target_content(req.target_type, req.target_id)
        normalized_target_type = as_text(req.target_type).lower()
        if normalized_target_type == "user" and target_owner_id == reporter_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot report yourself")
        if normalized_target_type != "user" and target_owner_id == reporter_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot report your own content")
        now = self._now()
        doc = {
            "reporter_user_id": reporter_id,
            "target_type": normalized_target_type,
            "target_id": as_text(req.target_id),
            "target_owner_user_id": target_owner_id,
            "reason": as_text(req.reason),
            "details": as_text(req.details),
            "status": "open",
            "severity": "",
            "action_taken": "",
            "admin_notes": "",
            "created_at": now,
            "reviewed_at": None,
            "reviewed_by": "",
        }
        inserted_id = self.repos.moderation_reports.insert_one(doc)
        row = self.repos.moderation_reports.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Moderation report creation failed")
        return to_moderation_report_public(row)

    def list_moderation_notifications(self, current_user: dict[str, Any]) -> list[ModerationNotificationPublic]:
        me_id = self.me_id(current_user)
        rows = list(self.repos.moderation_notifications.collection.find({"user_id": me_id}).sort("created_at", -1).limit(50))
        return [to_moderation_notification_public(row) for row in rows]

    def list_moderation_reports(self, report_status: str, limit: int) -> list[ModerationReportPublic]:
        normalized = as_text(report_status).lower()
        query: dict[str, Any] = {}
        if normalized and normalized != "all":
            query["status"] = normalized
        rows = list(self.repos.moderation_reports.collection.find(query).sort("created_at", -1).limit(limit))
        return [self._moderation_report_public(row) for row in rows]

    def _set_target_content_status(self, target_type: str, target_id: str, moderation_status: str) -> None:
        normalized = as_text(target_type).lower()
        if normalized == "spot":
            target = self.spot_or_404(target_id)
            self.repos.spots.update_fields({"_id": target.get("_id")}, {"moderation_status": moderation_status})
            return
        if normalized == "comment":
            self.comment_or_404(target_id)
            self.repos.comments.update_fields({"_id": ObjectId(target_id)}, {"moderation_status": moderation_status, "updated_at": self._now()})
            return
        if normalized == "meetup":
            existing = self.meetup_or_404(target_id)
            self.repos.meetups.update_fields({"_id": existing.get("_id")}, {"moderation_status": moderation_status, "updated_at": self._now()})
            return
        if normalized == "meetup_comment":
            if not ObjectId.is_valid(target_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
            existing = self.repos.meetup_comments.find_one({"_id": ObjectId(target_id)})
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
            self.repos.meetup_comments.update_fields({"_id": ObjectId(target_id)}, {"moderation_status": moderation_status, "updated_at": self._now()})

    def review_moderation_report(self, report_id: str, req: ModerationReportReviewRequest, admin_user: dict[str, Any]) -> ModerationReportPublic:
        ensure_indexes()
        if not ObjectId.is_valid(report_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid report ID")
        row = self.repos.moderation_reports.find_one({"_id": ObjectId(report_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        if as_text(row.get("status")).lower() != "open":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Report already reviewed")

        action_taken = as_text(req.action).lower()
        severity = as_text(req.severity).lower()
        target_type = as_text(row.get("target_type")).lower()
        target_id = as_text(row.get("target_id"))
        target_owner_user_id = as_text(row.get("target_owner_user_id"))
        reviewed_by = self.me_id(admin_user)
        admin_notes = as_text(req.admin_notes)
        timeout_until: datetime | None = None
        timeout_message = ""

        if req.status == "upheld":
            if action_taken == "hide_content" and target_type in {"spot", "comment", "meetup", "meetup_comment"}:
                self._set_target_content_status(target_type, target_id, "hidden")
            if action_taken == "ban_user":
                if not ObjectId.is_valid(target_owner_user_id):
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target owner could not be resolved")
                self.repos.users.update_fields(
                    {"_id": ObjectId(target_owner_user_id)},
                    {
                        "account_status": "banned",
                        "account_status_reason": admin_notes or f"Account banned after upheld moderation report: {as_text(row.get('reason'))}",
                        "posting_timeout_until": None,
                    },
                )
            if target_type in {"spot", "comment", "meetup", "meetup_comment"} and ObjectId.is_valid(target_owner_user_id):
                _weight, timeout_until, timeout_message = self._apply_strike(
                    user_id=target_owner_user_id,
                    target_type=target_type,
                    target_id=target_id,
                    report_id=report_id,
                    reason=as_text(row.get("reason")),
                    severity=severity,
                    reviewed_by=reviewed_by,
                )
                details_parts = [
                    f"Reason: {as_text(row.get('reason')).replace('_', ' ')}.",
                    f"Severity: {severity}.",
                    "Continued violations can lead to posting restrictions or account bans.",
                ]
                if timeout_until and timeout_message:
                    details_parts.append(timeout_message)
                self._notify_user(
                    target_owner_user_id,
                    title="Content flagged",
                    message="One of your posts was flagged and a strike has been applied to your account.",
                    details=" ".join(details_parts),
                )

        updates = {
            "status": req.status,
            "severity": severity,
            "action_taken": action_taken,
            "admin_notes": admin_notes,
            "reviewed_at": self._now(),
            "reviewed_by": reviewed_by,
        }
        self.repos.moderation_reports.update_fields({"_id": ObjectId(report_id)}, updates)
        updated = self.repos.moderation_reports.find_one({"_id": ObjectId(report_id)})
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Moderation report update failed")
        return self._moderation_report_public(updated)

    def list_moderated_users(self, query: str, limit: int) -> list[ModerationUserPublic]:
        regex = re.compile(re.escape(as_text(query)), re.IGNORECASE) if as_text(query) else None
        mongo_query: dict[str, Any] = {}
        if regex is not None:
            mongo_query = {"$or": [{"username": regex}, {"display_name": regex}, {"email": regex}]}
        rows = list(self.repos.users.collection.find(mongo_query, safe_user_projection()).sort("created_at", -1).limit(limit))
        out: list[ModerationUserPublic] = []
        for row in rows:
            user_id = serialize_id(row.get("_id"))
            if not ObjectId.is_valid(user_id):
                continue
            active_weight, recent_count = self._recent_strike_metrics(user_id)
            out.append(to_moderation_user_public(row, active_strike_weight=active_weight, recent_strike_count=recent_count))
        return out

    def update_user_moderation_status(self, user_id: str, req: ModerationUserStatusRequest, admin_user: dict[str, Any]) -> ModerationUserPublic:
        target_id, _target = self.user_or_404(user_id)
        if target_id == self.me_id(admin_user) and req.account_status == "banned":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin cannot ban their own account")
        updates = {
            "account_status": req.account_status,
            "account_status_reason": as_text(req.reason),
            "posting_timeout_until": req.posting_timeout_until,
        }
        self.repos.users.update_fields({"_id": ObjectId(target_id)}, updates)
        updated = self.repos.users.find_one({"_id": ObjectId(target_id)}, safe_user_projection())
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User moderation update failed")
        title = "Account update"
        message = "Your account moderation status has been updated by an administrator."
        details = as_text(req.reason)
        if req.account_status == "banned":
            message = "Your account has been banned."
        elif req.posting_timeout_until:
            message = f"Your posting access is restricted until {req.posting_timeout_until.isoformat()}."
        self._notify_user(target_id, title=title, message=message, details=details)
        active_weight, recent_count = self._recent_strike_metrics(target_id)
        return to_moderation_user_public(updated, active_strike_weight=active_weight, recent_strike_count=recent_count)

    def to_spot_comment(self, row: dict[str, Any] | None) -> SpotComment:
        data = row or {}
        return SpotComment(id=serialize_id(data.get("_id")), spot_id=as_text(data.get("spot_id")), user_id=as_text(data.get("user_id")), message=as_text(data.get("message")), moderation_status=self._content_status(data), created_at=data.get("created_at"), updated_at=data.get("updated_at"))

    def list_comments(self, spot_id: str, current_user: dict[str, Any]) -> list[SpotComment]:
        spot = self.spot_or_404(spot_id)
        self.require_spot_visible(spot, current_user, "Not authorized to view this spot")
        canonical_spot_id = serialize_id(spot.get("_id"))
        rows = self.repos.comments.find_many({"spot_id": canonical_spot_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [self.to_spot_comment(row) for row in rows if self._can_view_content_doc(row, current_user)]

    def create_comment(self, spot_id: str, req: CommentCreateRequest, current_user: dict[str, Any]) -> SpotComment:
        self.ensure_can_post(current_user)
        spot = self.spot_or_404(spot_id)
        me_id = self.require_spot_visible(spot, current_user, "Not authorized to comment on this spot")
        doc = {"spot_id": serialize_id(spot.get("_id")), "user_id": me_id, "message": as_text(req.message), "moderation_status": "visible", "created_at": datetime.now(UTC)}
        inserted_id = self.repos.comments.insert_one(doc)
        row = self.repos.comments.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Comment creation failed")
        return self.to_spot_comment(row)

    def update_comment(self, comment_id: str, req: CommentUpdateRequest, current_user: dict[str, Any]) -> SpotComment:
        self.ensure_can_post(current_user)
        existing = self.comment_or_404(comment_id)
        me_id = self.me_id(current_user)
        if existing.get("user_id") != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")
        self.repos.comments.update_fields({"_id": ObjectId(comment_id)}, {"message": as_text(req.message), "updated_at": datetime.now(UTC)})
        row = self.repos.comments.find_one({"_id": ObjectId(comment_id)})
        return self.to_spot_comment(row)

    def delete_comment(self, comment_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        existing = self.comment_or_404(comment_id)
        me_id = self.me_id(current_user)
        if existing.get("user_id") != me_id and not is_admin_user(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")
        self.repos.comments.collection.delete_one({"_id": ObjectId(comment_id)})
        return {"ok": True, "deleted": True}

    def sync_meetup_invites(self, meetup_id: str, host_user_id: str, invite_user_ids: list[str]) -> None:
        invite_ids = [uid for uid in dict.fromkeys(invite_user_ids) if uid and uid != host_user_id]
        keep_ids = set(invite_ids)
        self.repos.meetup_invites.collection.delete_many({"meetup_id": meetup_id, "user_id": {"$nin": list(keep_ids)} if keep_ids else {"$exists": True}})
        for invitee_id in invite_ids:
            self.repos.meetup_invites.collection.update_one({"meetup_id": meetup_id, "user_id": invitee_id}, {"$setOnInsert": {"status": "pending", "response_comment": "", "created_at": datetime.now(UTC)}}, upsert=True)

    def create_meetup(self, req: MeetupCreateRequest, current_user: dict[str, Any]) -> MeetupPublic:
        self.ensure_can_post(current_user)
        me_id = self.me_id(current_user)
        invite_user_ids = [uid for uid in dict.fromkeys(req.invite_user_ids) if ObjectId.is_valid(uid)]
        now = datetime.now(UTC)

        spot_id = None
        spot_doc = None
        if req.spot_id:
            spot = self.spot_or_404(req.spot_id)
            self.require_spot_visible(spot, current_user, "Cannot create meetup at this spot")
            spot_id = serialize_id(spot.get("_id"))
            spot_doc = to_spot_public(spot).model_dump()

        doc = {
            "host_user_id": me_id,
            "title": as_text(req.title),
            "description": as_text(req.description),
            "starts_at": req.starts_at,
            "invite_user_ids": invite_user_ids,
            "spot_id": spot_id,
            "moderation_status": "visible",
            "created_at": now,
            "updated_at": now,
        }
        inserted_id = self.repos.meetups.insert_one(doc)
        meetup_id = serialize_id(ObjectId(inserted_id))
        self.sync_meetup_invites(meetup_id, me_id, invite_user_ids)

        for invitee_id in invite_user_ids:
            self._notify_meetup(
                user_id=invitee_id,
                meetup_id=meetup_id,
                meetup_title=req.title,
                notification_type="invite_received",
                from_user_id=me_id,
                from_username=as_text(current_user.get("username")),
                message=f"You've been invited to: {req.title}",
            )

        created = self.repos.meetups.find_one({"_id": ObjectId(inserted_id)})
        if not created:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Meetup creation failed")
        return to_meetup_public(created)

    def list_meetups(self, scope: str, current_user: dict[str, Any]) -> list[MeetupPublic]:
        me_id = self.me_id(current_user)
        now = datetime.now(UTC)
        normalized_scope = as_text(scope).lower() or "upcoming"
        hosted_rows = self.repos.meetups.find_many({"host_user_id": me_id})
        invite_rows = self.repos.meetup_invites.find_many({"user_id": me_id})
        invited_ids = [as_text(entry.get("meetup_id")) for entry in invite_rows if as_text(entry.get("meetup_id"))]
        invite_lookup_ids: list[Any] = []
        for mid in invited_ids:
            invite_lookup_ids.append(mid)
            if ObjectId.is_valid(mid):
                invite_lookup_ids.append(ObjectId(mid))
        invited_rows = self.repos.meetups.find_many({"_id": {"$in": invite_lookup_ids}}) if invite_lookup_ids else []
        merged = {serialize_id(row.get("_id")): row for row in [*hosted_rows, *invited_rows]}
        all_rows = list(merged.values())
        def is_upcoming(row: dict[str, Any]) -> bool:
            starts_at = row.get("starts_at") or now
            return starts_at >= now
        if normalized_scope == "hosting":
            all_rows = [row for row in all_rows if as_text(row.get("host_user_id")) == me_id]
        elif normalized_scope == "invited":
            invited_set = set(invited_ids)
            all_rows = [row for row in all_rows if serialize_id(row.get("_id")) in invited_set]
        elif normalized_scope == "past":
            all_rows = [row for row in all_rows if not is_upcoming(row)]
        else:
            all_rows = [row for row in all_rows if is_upcoming(row)]
        all_rows = [row for row in all_rows if self.can_access_meetup(row, me_id)]
        all_rows.sort(key=lambda row: row.get("starts_at") or now)
        return [to_meetup_public(row) for row in all_rows]

    def update_meetup(self, meetup_id: str, req: MeetupUpdateRequest, current_user: dict[str, Any]) -> MeetupPublic:
        self.ensure_can_post(current_user)
        me_id = self.me_id(current_user)
        existing = self.meetup_or_404(meetup_id)
        if as_text(existing.get("host_user_id")) != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only host can edit this meetup")
        updates: dict[str, Any] = {"updated_at": datetime.now(UTC)}
        if req.title is not None:
            updates["title"] = as_text(req.title)
        if req.description is not None:
            updates["description"] = as_text(req.description)
        if req.starts_at is not None:
            updates["starts_at"] = req.starts_at
        if req.invite_user_ids is not None:
            updates["invite_user_ids"] = [uid for uid in dict.fromkeys(req.invite_user_ids) if ObjectId.is_valid(uid)]
        if req.spot_id is not None:
            if req.spot_id:
                spot = self.spot_or_404(req.spot_id)
                self.require_spot_visible(spot, current_user, "Cannot set this spot for meetup")
                updates["spot_id"] = serialize_id(spot.get("_id"))
            else:
                updates["spot_id"] = None
        self.repos.meetups.update_fields({"_id": existing.get("_id")}, updates)
        updated = self.repos.meetups.find_one({"_id": existing.get("_id")})
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Meetup update failed")
        self.sync_meetup_invites(serialize_id(updated.get("_id")), me_id, [uid for uid in updated.get("invite_user_ids") if ObjectId.is_valid(uid)])
        return to_meetup_public(updated)

    def delete_meetup(self, meetup_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        me_id = self.me_id(current_user)
        existing = self.meetup_or_404(meetup_id)
        if as_text(existing.get("host_user_id")) != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only host can delete this meetup")
        canonical_meetup_id = serialize_id(existing.get("_id"))
        self.repos.meetups.collection.delete_one({"_id": existing.get("_id")})
        self.repos.meetup_invites.collection.delete_many({"meetup_id": canonical_meetup_id})
        self.repos.meetup_comments.collection.delete_many({"meetup_id": canonical_meetup_id})
        return {"ok": True, "deleted": True}

    def list_meetup_invites(self, current_user: dict[str, Any]) -> list[MeetupInviteRef]:
        me_id = self.me_id(current_user)
        rows = self.sorted_rows(self.repos.meetup_invites.collection, {"user_id": me_id}, 500)
        return [MeetupInviteRef(meetup_id=as_text(row.get("meetup_id")), user_id=as_text(row.get("user_id")), status=normalize_invite_status(row.get("status")), response_comment=as_text(row.get("response_comment")), created_at=row.get("created_at") or datetime.now(UTC), responded_at=row.get("responded_at")) for row in rows]

    def respond_meetup(self, meetup_id: str, req: MeetupRespondRequest, current_user: dict[str, Any]) -> MeetupInviteRef:
        me_id = self.me_id(current_user)
        meetup = self.meetup_or_404(meetup_id)
        canonical_meetup_id = serialize_id(meetup.get("_id"))
        invite = self.repos.meetup_invites.find_one({"meetup_id": canonical_meetup_id, "user_id": me_id})
        if not invite:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not invited to this meetup")
        now = datetime.now(UTC)
        self.repos.meetup_invites.update_fields({"meetup_id": canonical_meetup_id, "user_id": me_id}, {"status": req.status, "response_comment": as_text(req.comment), "responded_at": now})
        row = self.repos.meetup_invites.find_one({"meetup_id": canonical_meetup_id, "user_id": me_id})

        host_user_id = as_text(meetup.get("host_user_id"))
        if host_user_id:
            self._notify_meetup(
                user_id=host_user_id,
                meetup_id=canonical_meetup_id,
                meetup_title=as_text(meetup.get("title")),
                notification_type=f"invite_{req.status}",
                from_user_id=me_id,
                from_username=as_text(current_user.get("username")),
                message=f"{as_text(current_user.get('username'))} has {req.status} your meetup invitation",
            )

        return MeetupInviteRef(meetup_id=as_text(row.get("meetup_id")), user_id=as_text(row.get("user_id")), status=normalize_invite_status(row.get("status")), response_comment=as_text(row.get("response_comment")), created_at=row.get("created_at") or now, responded_at=row.get("responded_at"))

    def list_meetup_comments(self, meetup_id: str, current_user: dict[str, Any]) -> list[MeetupComment]:
        me_id = self.me_id(current_user)
        meetup = self.meetup_or_404(meetup_id)
        if not self.can_access_meetup(meetup, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to view this meetup")
        canonical_meetup_id = serialize_id(meetup.get("_id"))
        rows = self.repos.meetup_comments.find_many({"meetup_id": canonical_meetup_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [MeetupComment(**row) for row in rows if self._can_view_content_doc(row, current_user)]

    def create_meetup_comment(self, meetup_id: str, req: MeetupCommentCreateRequest, current_user: dict[str, Any]) -> MeetupComment:
        self.ensure_can_post(current_user)
        me_id = self.me_id(current_user)
        meetup = self.meetup_or_404(meetup_id)
        if not self.can_access_meetup(meetup, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to comment on this meetup")
        now = datetime.now(UTC)
        doc = {"meetup_id": serialize_id(meetup.get("_id")), "user_id": me_id, "message": as_text(req.message), "moderation_status": "visible", "created_at": now, "updated_at": now}
        inserted_id = self.repos.meetup_comments.insert_one(doc)
        row = self.repos.meetup_comments.find_one({"_id": ObjectId(inserted_id)})
        return MeetupComment(**row)

    def update_meetup_comment(self, comment_id: str, req: MeetupCommentUpdateRequest, current_user: dict[str, Any]) -> MeetupComment:
        self.ensure_can_post(current_user)
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
        me_id = self.me_id(current_user)
        existing = self.repos.meetup_comments.find_one({"_id": ObjectId(comment_id)})
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if as_text(existing.get("user_id")) != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")
        self.repos.meetup_comments.update_fields({"_id": ObjectId(comment_id)}, {"message": as_text(req.message), "updated_at": datetime.now(UTC)})
        row = self.repos.meetup_comments.find_one({"_id": ObjectId(comment_id)})
        return MeetupComment(**row)

    def delete_meetup_comment(self, comment_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
        me_id = self.me_id(current_user)
        existing = self.repos.meetup_comments.find_one({"_id": ObjectId(comment_id)})
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if as_text(existing.get("user_id")) != me_id and not is_admin_user(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")
        self.repos.meetup_comments.collection.delete_one({"_id": ObjectId(comment_id)})
        return {"ok": True, "deleted": True}

    def list_meetup_notifications(self, current_user: dict[str, Any]) -> list[MeetupNotificationPublic]:
        me_id = self.me_id(current_user)
        rows = self.sorted_rows(self.repos.meetup_notifications.collection, {"user_id": me_id}, 100)
        return [to_meetup_notification_public(row) for row in rows]
