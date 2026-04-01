from __future__ import annotations

from threading import Lock

from pymongo import ASCENDING

_INDEX_LOCK = Lock()
_INDEXES_READY = False


def ensure_indexes(repositories) -> None:
    global _INDEXES_READY
    if _INDEXES_READY:
        return

    with _INDEX_LOCK:
        if _INDEXES_READY:
            return

        r = repositories
        r.favorites.create_index([("user_id", ASCENDING), ("spot_id", ASCENDING)], unique=True)
        r.follows.create_index([("follower_id", ASCENDING), ("followee_id", ASCENDING)], unique=True)
        r.follow_requests.create_index([("follower_id", ASCENDING), ("followee_id", ASCENDING)], unique=True)
        r.blocks.create_index([("blocker_id", ASCENDING), ("blocked_id", ASCENDING)], unique=True)
        r.shares.create_index([("user_id", ASCENDING), ("spot_id", ASCENDING), ("created_at", ASCENDING)])
        r.support_tickets.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        r.support_tickets.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_reports.create_index([("status", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_reports.create_index([("target_type", ASCENDING), ("target_id", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_reports.create_index([("reporter_user_id", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_strikes.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        r.moderation_notifications.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)])
        r.spots.create_index([("owner_id", ASCENDING)])
        r.spots.create_index([("visibility", ASCENDING)])
        r.spots.create_index([("moderation_status", ASCENDING), ("created_at", ASCENDING)])
        r.spots.create_index([("invite_user_ids", ASCENDING)])
        r.comments.create_index([("spot_id", ASCENDING), ("moderation_status", ASCENDING), ("created_at", ASCENDING)])
        r.meetups.create_index([("host_user_id", ASCENDING), ("starts_at", ASCENDING)])
        r.meetups.create_index([("starts_at", ASCENDING)])
        r.meetups.create_index([("moderation_status", ASCENDING), ("starts_at", ASCENDING)])
        r.meetup_invites.create_index([("meetup_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
        r.meetup_invites.create_index([("user_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)])
        r.meetup_comments.create_index([("meetup_id", ASCENDING), ("created_at", ASCENDING)])
        r.meetup_comments.create_index([("meetup_id", ASCENDING), ("moderation_status", ASCENDING), ("created_at", ASCENDING)])
        _INDEXES_READY = True
