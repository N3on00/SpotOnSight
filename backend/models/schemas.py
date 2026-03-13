from __future__ import annotations

from datetime import UTC, datetime
import re
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from core.registry import mongo_entity_encrypted


def _normalize_email(value: str) -> str:
    return str(value or "").strip().lower()


def _normalize_username(value: str) -> str:
    return str(value or "").strip().lower()


@mongo_entity_encrypted(
    collection="spots",
    tags=["Spots"],
    prefix="/spots",
)
class Spot(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    tags: List[str] = Field(default_factory=list)

    lat: float
    lon: float

    # Store images as base64 strings (later you can switch to URLs)
    images: List[str] = Field(default_factory=list)

    created_at: Optional[datetime] = None

    @field_validator("created_at")
    @classmethod
    def default_now(cls, v):
        return v or datetime.now(UTC)


@mongo_entity_encrypted(collection="client_error_reports", tags=["ClientErrors"], prefix="/client-errors")
class ClientErrorReport(BaseModel):
    kind: str = Field(default="exception", max_length=40)
    source: str = Field(default="app", max_length=80)
    message: str = Field(default="", max_length=8000)
    exception_type: Optional[str] = Field(default=None, max_length=200)
    stacktrace: str = Field(default="", max_length=200000)
    context: Dict[str, Any] = Field(default_factory=dict)
    platform: Optional[str] = Field(default=None, max_length=200)
    python_version: Optional[str] = Field(default=None, max_length=200)
    created_at: Optional[datetime] = None

    @field_validator("created_at")
    @classmethod
    def default_now_report(cls, v):
        return v or datetime.now(UTC)


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=5, max_length=200)
    password: str = Field(min_length=8, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=120)


class UpdateProfileRequest(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=40)
    email: Optional[str] = Field(default=None, min_length=5, max_length=200)
    display_name: Optional[str] = Field(default=None, max_length=120)
    bio: Optional[str] = Field(default=None, max_length=1200)
    avatar_image: Optional[str] = Field(default=None, max_length=5_000_000)
    social_accounts: Optional[Dict[str, str]] = Field(default=None)
    follow_requires_approval: Optional[bool] = None
    current_password: Optional[str] = Field(default=None, max_length=200)
    new_password: Optional[str] = Field(default=None, min_length=8, max_length=200)


class UserPublic(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    bio: str = ""
    avatar_image: str = ""
    social_accounts: Dict[str, str] = Field(default_factory=dict)
    follow_requires_approval: bool = False
    created_at: datetime


class SpotUpsertRequest(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    tags: List[str] = Field(default_factory=list)
    lat: float
    lon: float
    images: List[str] = Field(default_factory=list)
    visibility: Literal["public", "following", "invite_only", "personal"] = "public"
    invite_user_ids: List[str] = Field(default_factory=list)


class SpotPublic(BaseModel):
    id: str
    owner_id: str
    title: str
    description: str
    tags: List[str] = Field(default_factory=list)
    lat: float
    lon: float
    images: List[str] = Field(default_factory=list)
    visibility: Literal["public", "following", "invite_only", "personal"] = "public"
    invite_user_ids: List[str] = Field(default_factory=list)
    created_at: datetime


class ShareRequest(BaseModel):
    message: str = Field(default="", max_length=300)


class SupportTicketRequest(BaseModel):
    category: Literal["bug", "feature", "complaint", "question", "other"] = "other"
    subject: str = Field(min_length=3, max_length=140)
    message: str = Field(min_length=10, max_length=6000)
    page: str = Field(default="", max_length=240)
    contact_email: Optional[str] = Field(default=None, max_length=200)
    allow_contact: bool = False


class SupportTicketPublic(BaseModel):
    id: str
    user_id: str
    category: Literal["bug", "feature", "complaint", "question", "other"] = "other"
    subject: str
    message: str
    page: str = ""
    contact_email: str = ""
    allow_contact: bool = False
    status: Literal["open", "closed"] = "open"
    created_at: datetime


class FollowRequestPublic(BaseModel):
    follower: UserPublic
    created_at: datetime


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class LoginRequest(BaseModel):
    username_or_email: str = Field(min_length=3, max_length=200)
    password: str = Field(min_length=1, max_length=200)

    @field_validator("username_or_email")
    @classmethod
    def normalize_username_or_email(cls, v: str) -> str:
        return str(v or "").strip().lower()


class AuthUserRecord(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    email: str = Field(min_length=5, max_length=200)
    password_hash: str = Field(min_length=1, max_length=500)
    display_name: str = Field(min_length=1, max_length=120)
    bio: str = Field(default="", max_length=1200)
    avatar_image: str = Field(default="", max_length=5_000_000)
    social_accounts: Dict[str, str] = Field(default_factory=dict)
    follow_requires_approval: bool = False
    is_admin: bool = Field(default=False)
    created_at: Optional[datetime] = None

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str) -> str:
        username = _normalize_username(v)
        if not re.fullmatch(r"[a-z0-9_.-]{3,40}", username):
            raise ValueError("Invalid username format")
        return username

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        email = _normalize_email(v)
        if "@" not in email:
            raise ValueError("Invalid email format")
        return email

    @field_validator("social_accounts")
    @classmethod
    def sanitize_social_accounts(cls, v: Dict[str, str]) -> Dict[str, str]:
        out: Dict[str, str] = {}
        source = v if isinstance(v, dict) else {}
        for key, value in source.items():
            k = str(key or "").strip()
            val = str(value or "").strip()
            if not k or not val:
                continue
            if len(k) > 40 or len(val) > 500:
                continue
            out[k] = val
        return out

    @field_validator("created_at")
    @classmethod
    def default_created_at(cls, v):
        return v or datetime.now(UTC)


class FavoriteRef(BaseModel):
    spot_id: str
    created_at: datetime


class FollowRef(BaseModel):
    user_id: str
    created_at: datetime


class FollowRequestRef(BaseModel):
    follower_id: str
    created_at: datetime


class BlockRef(BaseModel):
    user_id: str
    created_at: datetime


class SpotComment(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    spot_id: str
    user_id: str
    message: str = Field(min_length=1, max_length=2000)
    created_at: Optional[datetime] = None

    model_config = {"populate_by_name": True}

    @field_validator("created_at")
    @classmethod
    def default_created_at(cls, v):
        return v or datetime.now(UTC)


class CommentCreateRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class CommentUpdateRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class MeetupCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=3000)
    starts_at: datetime
    invite_user_ids: List[str] = Field(default_factory=list)


class MeetupUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=3000)
    starts_at: Optional[datetime] = None
    invite_user_ids: Optional[List[str]] = None


class MeetupPublic(BaseModel):
    id: str
    host_user_id: str
    title: str
    description: str = ""
    starts_at: datetime
    invite_user_ids: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class MeetupInviteRef(BaseModel):
    meetup_id: str
    user_id: str
    status: Literal["pending", "accepted", "declined"] = "pending"
    response_comment: str = ""
    created_at: datetime
    responded_at: Optional[datetime] = None


class MeetupRespondRequest(BaseModel):
    status: Literal["accepted", "declined"]
    comment: str = Field(default="", max_length=1000)


class MeetupComment(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    meetup_id: str
    user_id: str
    message: str = Field(min_length=1, max_length=2000)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"populate_by_name": True}

    @field_validator("created_at")
    @classmethod
    def default_meetup_comment_created_at(cls, v):
        return v or datetime.now(UTC)


class MeetupCommentCreateRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class MeetupCommentUpdateRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
