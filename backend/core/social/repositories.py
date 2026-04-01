from __future__ import annotations

import os

from models.schemas import (
    BlockRef,
    FavoriteRef,
    FollowRef,
    FollowRequestRef,
    MeetupNotificationPublic,
    MeetupComment,
    MeetupCreateRequest,
    MeetupInviteRef,
    ModerationNotificationPublic,
    ModerationReportCreateRequest,
    ModerationUserPublic,
    ShareRequest,
    SpotComment,
    SpotUpsertRequest,
    SupportTicketRequest,
)
from repositories.mongo_repository import MongoRepository
class SocialRepositories:
    def __init__(self, users_repository) -> None:
        self.users = users_repository
        self.spots = MongoRepository("spots", SpotUpsertRequest, db_name=_spots_db_name())
        self.favorites = MongoRepository("favorites", FavoriteRef, db_name=_social_db_name())
        self.follows = MongoRepository("follows", FollowRef, db_name=_social_db_name())
        self.follow_requests = MongoRepository("follow_requests", FollowRequestRef, db_name=_social_db_name())
        self.blocks = MongoRepository("blocks", BlockRef, db_name=_social_db_name())
        self.shares = MongoRepository("shares", ShareRequest, db_name=_social_db_name())
        self.support_tickets = MongoRepository("support_tickets", SupportTicketRequest, db_name=_social_db_name())
        self.moderation_reports = MongoRepository("moderation_reports", ModerationReportCreateRequest, db_name=_social_db_name())
        self.moderation_strikes = MongoRepository("moderation_strikes", ModerationUserPublic, db_name=_social_db_name())
        self.moderation_notifications = MongoRepository("moderation_notifications", ModerationNotificationPublic, db_name=_social_db_name())
        self.comments = MongoRepository("comments", SpotComment, db_name=_social_db_name())
        self.meetups = MongoRepository("meetups", MeetupCreateRequest, db_name=_social_db_name())
        self.meetup_invites = MongoRepository("meetup_invites", MeetupInviteRef, db_name=_social_db_name())
        self.meetup_comments = MongoRepository("meetup_comments", MeetupComment, db_name=_social_db_name())
        self.meetup_notifications = MongoRepository("meetup_notifications", MeetupNotificationPublic, db_name=_social_db_name())

def _social_db_name() -> str:
    return str(os.getenv("MONGO_AUTH_DB") or "SpotOnSightAuth").strip() or "SpotOnSightAuth"


def _spots_db_name() -> str:
    return str(os.getenv("MONGO_SPOTS_DB") or "spot_on_sight").strip() or "spot_on_sight"
