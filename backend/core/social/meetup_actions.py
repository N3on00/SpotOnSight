from __future__ import annotations

from datetime import UTC, datetime

from bson import ObjectId
from fastapi import HTTPException, status

from core.admin_setup import is_admin_user
from models.schemas import MeetupComment, MeetupInviteRef

from .ids import as_text, serialize_id
from .mappers import to_meetup_notification_public, to_meetup_public


def _normalize_invite_status(value) -> str:
    text = as_text(value).lower()
    if text in {"pending", "accepted", "declined"}:
        return text
    return "pending"


class SocialMeetupActions:
    def __init__(self, actions) -> None:
        self.actions = actions

    @property
    def repos(self):
        return self.actions.repos

    def sync_meetup_invites(self, meetup_id: str, host_user_id: str, invite_user_ids: list[str]) -> None:
        invite_ids = [uid for uid in dict.fromkeys(invite_user_ids) if uid and uid != host_user_id]
        keep_ids = set(invite_ids)
        self.repos.meetup_invites.delete_many({"meetup_id": meetup_id, "user_id": {"$nin": list(keep_ids)} if keep_ids else {"$exists": True}})
        for invitee_id in invite_ids:
            self.repos.meetup_invites.set_on_insert(
                {"meetup_id": meetup_id, "user_id": invitee_id},
                {"status": "pending", "response_comment": "", "created_at": datetime.now(UTC)},
            )

    def create_meetup(self, req, current_user):
        self.actions.ensure_can_post(current_user)
        me_id = self.actions.me_id(current_user)
        invite_user_ids = [uid for uid in dict.fromkeys(req.invite_user_ids) if ObjectId.is_valid(uid)]
        now = datetime.now(UTC)

        spot_id = None
        if req.spot_id:
            spot = self.actions.spot_or_404(req.spot_id)
            self.actions.require_spot_visible(spot, current_user, "Cannot create meetup at this spot")
            spot_id = serialize_id(spot.get("_id"))

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
            self.actions._notify_meetup(
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

    def list_meetups(self, scope: str, current_user):
        me_id = self.actions.me_id(current_user)
        now = datetime.now(UTC)
        normalized_scope = as_text(scope).lower() or "upcoming"
        hosted_rows = self.repos.meetups.find_many({"host_user_id": me_id})
        invite_rows = self.repos.meetup_invites.find_many({"user_id": me_id})
        invited_ids = [as_text(entry.get("meetup_id")) for entry in invite_rows if as_text(entry.get("meetup_id"))]
        invite_lookup_ids = []
        for mid in invited_ids:
            invite_lookup_ids.append(mid)
            if ObjectId.is_valid(mid):
                invite_lookup_ids.append(ObjectId(mid))
        invited_rows = self.repos.meetups.find_many({"_id": {"$in": invite_lookup_ids}}) if invite_lookup_ids else []
        merged = {serialize_id(row.get("_id")): row for row in [*hosted_rows, *invited_rows]}
        all_rows = list(merged.values())

        def is_upcoming(row):
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
        all_rows = [row for row in all_rows if self.actions.can_access_meetup(row, me_id)]
        all_rows.sort(key=lambda row: row.get("starts_at") or now)
        return [to_meetup_public(row) for row in all_rows]

    def update_meetup(self, meetup_id: str, req, current_user):
        self.actions.ensure_can_post(current_user)
        me_id = self.actions.me_id(current_user)
        existing = self.actions.meetup_or_404(meetup_id)
        if as_text(existing.get("host_user_id")) != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only host can edit this meetup")
        updates = {"updated_at": datetime.now(UTC)}
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
                spot = self.actions.spot_or_404(req.spot_id)
                self.actions.require_spot_visible(spot, current_user, "Cannot set this spot for meetup")
                updates["spot_id"] = serialize_id(spot.get("_id"))
            else:
                updates["spot_id"] = None
        self.repos.meetups.update_fields({"_id": existing.get("_id")}, updates)
        updated = self.repos.meetups.find_one({"_id": existing.get("_id")})
        if not updated:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Meetup update failed")
        self.sync_meetup_invites(serialize_id(updated.get("_id")), me_id, [uid for uid in updated.get("invite_user_ids") if ObjectId.is_valid(uid)])
        return to_meetup_public(updated)

    def delete_meetup(self, meetup_id: str, current_user):
        me_id = self.actions.me_id(current_user)
        existing = self.actions.meetup_or_404(meetup_id)
        if as_text(existing.get("host_user_id")) != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only host can delete this meetup")
        canonical_meetup_id = serialize_id(existing.get("_id"))
        self.repos.meetups.delete_one_by_query({"_id": existing.get("_id")})
        self.repos.meetup_invites.delete_many({"meetup_id": canonical_meetup_id})
        self.repos.meetup_comments.delete_many({"meetup_id": canonical_meetup_id})
        return {"ok": True, "deleted": True}

    def list_meetup_invites(self, current_user):
        me_id = self.actions.me_id(current_user)
        rows = self.actions.sorted_rows(self.repos.meetup_invites, {"user_id": me_id}, 500)
        return [
            MeetupInviteRef(
                meetup_id=as_text(row.get("meetup_id")),
                user_id=as_text(row.get("user_id")),
                status=_normalize_invite_status(row.get("status")),
                response_comment=as_text(row.get("response_comment")),
                created_at=row.get("created_at") or datetime.now(UTC),
                responded_at=row.get("responded_at"),
            )
            for row in rows
        ]

    def respond_meetup(self, meetup_id: str, req, current_user):
        me_id = self.actions.me_id(current_user)
        meetup = self.actions.meetup_or_404(meetup_id)
        canonical_meetup_id = serialize_id(meetup.get("_id"))
        invite = self.repos.meetup_invites.find_one({"meetup_id": canonical_meetup_id, "user_id": me_id})
        if not invite:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not invited to this meetup")
        now = datetime.now(UTC)
        self.repos.meetup_invites.update_fields(
            {"meetup_id": canonical_meetup_id, "user_id": me_id},
            {"status": req.status, "response_comment": as_text(req.comment), "responded_at": now},
        )
        row = self.repos.meetup_invites.find_one({"meetup_id": canonical_meetup_id, "user_id": me_id})

        host_user_id = as_text(meetup.get("host_user_id"))
        if host_user_id:
            self.actions._notify_meetup(
                user_id=host_user_id,
                meetup_id=canonical_meetup_id,
                meetup_title=as_text(meetup.get("title")),
                notification_type=f"invite_{req.status}",
                from_user_id=me_id,
                from_username=as_text(current_user.get("username")),
                message=f"{as_text(current_user.get('username'))} has {req.status} your meetup invitation",
            )

        return MeetupInviteRef(
            meetup_id=as_text(row.get("meetup_id")),
            user_id=as_text(row.get("user_id")),
            status=_normalize_invite_status(row.get("status")),
            response_comment=as_text(row.get("response_comment")),
            created_at=row.get("created_at") or now,
            responded_at=row.get("responded_at"),
        )

    def list_meetup_comments(self, meetup_id: str, current_user):
        me_id = self.actions.me_id(current_user)
        meetup = self.actions.meetup_or_404(meetup_id)
        if not self.actions.can_access_meetup(meetup, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to view this meetup")
        canonical_meetup_id = serialize_id(meetup.get("_id"))
        rows = self.repos.meetup_comments.find_many({"meetup_id": canonical_meetup_id})
        rows.sort(key=lambda row: row.get("created_at") or datetime.min.replace(tzinfo=UTC), reverse=True)
        return [MeetupComment(**row) for row in rows if self.actions._can_view_content_doc(row, current_user)]

    def create_meetup_comment(self, meetup_id: str, req, current_user):
        self.actions.ensure_can_post(current_user)
        me_id = self.actions.me_id(current_user)
        meetup = self.actions.meetup_or_404(meetup_id)
        if not self.actions.can_access_meetup(meetup, me_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to comment on this meetup")
        now = datetime.now(UTC)
        doc = {
            "meetup_id": serialize_id(meetup.get("_id")),
            "user_id": me_id,
            "message": as_text(req.message),
            "moderation_status": "visible",
            "created_at": now,
            "updated_at": now,
        }
        inserted_id = self.repos.meetup_comments.insert_one(doc)
        row = self.repos.meetup_comments.find_one({"_id": ObjectId(inserted_id)})
        return MeetupComment(**row)

    def update_meetup_comment(self, comment_id: str, req, current_user):
        self.actions.ensure_can_post(current_user)
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
        me_id = self.actions.me_id(current_user)
        existing = self.repos.meetup_comments.find_one({"_id": ObjectId(comment_id)})
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if as_text(existing.get("user_id")) != me_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to edit this comment")
        self.repos.meetup_comments.update_fields({"_id": ObjectId(comment_id)}, {"message": as_text(req.message), "updated_at": datetime.now(UTC)})
        row = self.repos.meetup_comments.find_one({"_id": ObjectId(comment_id)})
        return MeetupComment(**row)

    def delete_meetup_comment(self, comment_id: str, current_user):
        if not ObjectId.is_valid(comment_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid comment ID")
        me_id = self.actions.me_id(current_user)
        existing = self.repos.meetup_comments.find_one({"_id": ObjectId(comment_id)})
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
        if as_text(existing.get("user_id")) != me_id and not is_admin_user(current_user):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this comment")
        self.repos.meetup_comments.delete_one_by_query({"_id": ObjectId(comment_id)})
        return {"ok": True, "deleted": True}

    def list_meetup_notifications(self, current_user):
        me_id = self.actions.me_id(current_user)
        rows = self.actions.sorted_rows(self.repos.meetup_notifications, {"user_id": me_id}, 100)
        return [to_meetup_notification_public(row) for row in rows]
