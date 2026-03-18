from __future__ import annotations

from threading import Lock

from pymongo import ASCENDING

from .repositories import repos


_INDEX_LOCK = Lock()
_INDEXES_READY = False


def ensure_indexes() -> None:
    global _INDEXES_READY
    if _INDEXES_READY:
        return

    with _INDEX_LOCK:
        if _INDEXES_READY:
            return

        r = repos()
        r.favorites.collection.create_index([("user_id", ASCENDING), ("spot_id", ASCENDING)], unique=True)
        r.follows.collection.create_index([("follower_id", ASCENDING), ("followee_id", ASCENDING)], unique=True)
        r.follow_requests.collection.create_index([("follower_id", ASCENDING), ("followee_id", ASCENDING)], unique=True)
        r.blocks.collection.create_index([("blocker_id", ASCENDING), ("blocked_id", ASCENDING)], unique=True)
        r.shares.collection.create_index([("user_id", ASCENDING), ("spot_id", ASCENDING), ("created_at", ASCENDING)])
        r.support_tickets.collection.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        r.support_tickets.collection.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_reports.collection.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_reports.collection.create_index([("target_type", ASCENDING), ("target_id", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_reports.collection.create_index([("reporter_user_id", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_strikes.collection.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_notifications.collection.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        r.spots.collection.create_index([("owner_id", ASCENDING)])
        r.spots.collection.create_index([("visibility", ASCENDING)])
        r.spots.collection.create_index([("moderation_status", ASCENDING), ("created_at", ASCENDING)])
        r.spots.collection.create_index([("invite_user_ids", ASCENDING)])
        r.comments.collection.create_index([("spot_id", ASCENDING), ("moderation_status", ASCENDING), ("created_at", ASCENDING)])
        r.meetups.collection.create_index([("host_user_id", ASCENDING), ("starts_at", ASCENDING)])
        r.meetups.collection.create_index([("starts_at", ASCENDING)])
        r.meetup_invites.collection.create_index([("meetup_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
        r.meetup_invites.collection.create_index([("user_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)])
        r.meetup_comments.collection.create_index([("meetup_id", ASCENDING), ("created_at", ASCENDING)])
        r.meetup_comments.collection.create_index([("meetup_id", ASCENDING), ("moderation_status", ASCENDING), ("created_at", ASCENDING)])
        _INDEXES_READY = True
