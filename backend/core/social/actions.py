from __future__ import annotations

from datetime import UTC, datetime
import re
from typing import Any, Callable

from bson import ObjectId
from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from core.admin_setup import is_admin_user
from models.schemas import (
    BlockRef,
    CommentCreateRequest,
    CommentUpdateRequest,
    FavoriteRef,
    FollowRef,
    FollowRequestRef,
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
from .mappers import to_meetup_public, to_spot_public, to_support_ticket_public, to_user_public
from .policies import can_view_private_user, can_view_spot, is_blocked_pair, is_following


def normalize_invite_status(value: Any) -> str:
    text = as_text(value).lower()
    if text in {"pending", "accepted", "declined"}:
        return text
    return "pending"


class SocialActions:
    def __init__(self, repos) -> None:
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
            username = normalize_login(req.username)
            if not re.fullmatch(r"[a-z0-9_.-]{3,40}", username):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid username format")
            updates["username"] = username
        if req.email is not None:
            email = normalize_login(req.email)
            if "@" not in email:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid email format")
            updates["email"] = email
        if req.display_name is not None:
            updates["display_name"] = as_text(req.display_name)
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
        text = as_text(query)
        if not text:
            return []
        me_id = viewer_user_id(current_user)
        regex = re.compile(re.escape(text), re.IGNORECASE)
        users = list(self.repos.users.collection.find({"$or": [{"username": regex}, {"display_name": regex}]}, safe_user_projection()).limit(limit))
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
        if me_id != target_id and is_blocked_pair(self.repos, me_id, target_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return to_user_public(target)

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
        spot_keys = [key for key in dict.fromkeys([as_text(spot_id), as_text(spot_key)]) if key]
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
        doc = {"user_id": me_id, "category": req.category, "subject": as_text(req.subject), "message": as_text(req.message), "page": as_text(req.page), "contact_email": contact_email, "allow_contact": bool(req.allow_contact), "status": "open", "created_at": now, "updated_at": now}
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

    @staticmethod
    def to_spot_comment(row: dict[str, Any] | None) -> SpotComment:
        data = row or {}
        return SpotComment(id=serialize_id(data.get("_id")), spot_id=as_text(data.get("spot_id")), user_id=as_text(data.get("user_id")), message=as_text(data.get("message")), created_at=data.get("created_at"), updated_at=data.get("updated_at"))

    def list_comments(self, spot_id: str, current_user: dict[str, Any]) -> list[SpotComment]:
        spot = self.spot_or_404(spot_id)
        self.require_spot_visible(spot, current_user, "Not authorized to view this spot")
        canonical_spot_id = serialize_id(spot.get("_id"))
        rows = self.repos.comments.find_many({"spot_id": canonical_spot_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [self.to_spot_comment(row) for row in rows]

    def create_comment(self, spot_id: str, req: CommentCreateRequest, current_user: dict[str, Any]) -> SpotComment:
        spot = self.spot_or_404(spot_id)
        me_id = self.require_spot_visible(spot, current_user, "Not authorized to comment on this spot")
        doc = {"spot_id": serialize_id(spot.get("_id")), "user_id": me_id, "message": as_text(req.message), "created_at": datetime.now(UTC)}
        inserted_id = self.repos.comments.insert_one(doc)
        row = self.repos.comments.find_one({"_id": ObjectId(inserted_id)})
        if not row:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Comment creation failed")
        return self.to_spot_comment(row)

    def update_comment(self, comment_id: str, req: CommentUpdateRequest, current_user: dict[str, Any]) -> SpotComment:
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
        me_id = self.me_id(current_user)
        invite_user_ids = [uid for uid in dict.fromkeys(req.invite_user_ids) if ObjectId.is_valid(uid)]
        now = datetime.now(UTC)
        doc = {"host_user_id": me_id, "title": as_text(req.title), "description": as_text(req.description), "starts_at": req.starts_at, "invite_user_ids": invite_user_ids, "created_at": now, "updated_at": now}
        inserted_id = self.repos.meetups.insert_one(doc)
        meetup_id = serialize_id(ObjectId(inserted_id))
        self.sync_meetup_invites(meetup_id, me_id, invite_user_ids)
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
        all_rows.sort(key=lambda row: row.get("starts_at") or now)
        return [to_meetup_public(row) for row in all_rows]

    def update_meetup(self, meetup_id: str, req: MeetupUpdateRequest, current_user: dict[str, Any]) -> MeetupPublic:
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
        return MeetupInviteRef(meetup_id=as_text(row.get("meetup_id")), user_id=as_text(row.get("user_id")), status=normalize_invite_status(row.get("status")), response_comment=as_text(row.get("response_comment")), created_at=row.get("created_at") or now, responded_at=row.get("responded_at"))

    def list_meetup_comments(self, meetup_id: str, current_user: dict[str, Any]) -> list[MeetupComment]:
        me_id = self.me_id(current_user)
        meetup = self.meetup_or_404(meetup_id)
        if not self.can_access_meetup(meetup, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to view this meetup")
        canonical_meetup_id = serialize_id(meetup.get("_id"))
        rows = self.repos.meetup_comments.find_many({"meetup_id": canonical_meetup_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [MeetupComment(**row) for row in rows]

    def create_meetup_comment(self, meetup_id: str, req: MeetupCommentCreateRequest, current_user: dict[str, Any]) -> MeetupComment:
        me_id = self.me_id(current_user)
        meetup = self.meetup_or_404(meetup_id)
        if not self.can_access_meetup(meetup, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to comment on this meetup")
        now = datetime.now(UTC)
        doc = {"meetup_id": serialize_id(meetup.get("_id")), "user_id": me_id, "message": as_text(req.message), "created_at": now, "updated_at": now}
        inserted_id = self.repos.meetup_comments.insert_one(doc)
        row = self.repos.meetup_comments.find_one({"_id": ObjectId(inserted_id)})
        return MeetupComment(**row)

    def update_meetup_comment(self, comment_id: str, req: MeetupCommentUpdateRequest, current_user: dict[str, Any]) -> MeetupComment:
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
