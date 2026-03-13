from __future__ import annotations

from datetime import UTC, datetime
import re
from typing import Any, Dict, List, Literal, Optional

from fastapi import Depends, Query
from pydantic import BaseModel, Field, field_validator

from api.crud import CrudRouteConfig, CrudRouteConfigs, CrudRouteEnabled
from core.registry import mongo_entity_encrypted
from core.social_registry import ExtraRouteSpec, SocialCrudSpec, register_social_actor


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
    updated_at: Optional[datetime] = None

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


def _social_actions(repos):
    from core.social.actions import SocialActions

    return SocialActions(repos)


def _current_user_dependency():
    from services.auth.current_user import get_current_user

    return get_current_user


def _non_empty_id(value: str) -> str:
    text = str(value or "").strip()
    if not text:
        raise ValueError("Invalid ID format")
    return text


def _profile_read_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def read_me(current_user: dict = Depends(get_current_user)):
            return actions.get_me(current_user)

        return read_me

    return wrapper


def _profile_update_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def update_me(entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = UpdateProfileRequest.model_validate(entity_data)
            return actions.update_me(req, current_user)

        return update_me

    return wrapper


def _user_search_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def search_users(
        q: str = Query(default="", max_length=80),
        limit: int = Query(default=20, ge=1, le=50),
        current_user: dict = Depends(get_current_user),
    ):
        return actions.search_users(q, limit, current_user)

    return search_users


def _user_profile_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
        return actions.get_user_profile(user_id, current_user)

    return user_profile


def _spots_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def create_spot(entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = SpotUpsertRequest.model_validate(entity_data)
            return actions.create_spot(req, current_user)

        return create_spot

    return wrapper


def _spots_list_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def list_spots(current_user: dict = Depends(get_current_user)):
            return actions.list_visible_spots(current_user)

        return list_spots

    return wrapper


def _spots_update_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def update_spot(spot_id: str, entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = SpotUpsertRequest.model_validate(entity_data)
            return actions.update_spot(spot_id, req, current_user)

        return update_spot

    return wrapper


def _spots_delete_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def delete_spot(spot_id: str, current_user: dict = Depends(get_current_user)):
            return actions.delete_spot(spot_id, current_user)

        return delete_spot

    return wrapper


def _user_spots_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def user_spots(user_id: str, current_user: dict = Depends(get_current_user)):
        return actions.user_spots(user_id, current_user)

    return user_spots


def _favorites_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def add_favorite(spot_id: str, current_user: dict = Depends(get_current_user)):
            return actions.add_favorite(spot_id, current_user)

        return add_favorite

    return wrapper


def _favorites_list_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def list_favorites(current_user: dict = Depends(get_current_user)):
            return actions.list_favorites(current_user)

        return list_favorites

    return wrapper


def _favorites_delete_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def remove_favorite(spot_id: str, current_user: dict = Depends(get_current_user)):
            return actions.remove_favorite(spot_id, current_user)

        return remove_favorite

    return wrapper


def _user_favorites_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def user_favorites(user_id: str, current_user: dict = Depends(get_current_user)):
        return actions.user_favorites(user_id, current_user)

    return user_favorites


def _follow_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
            return actions.follow_user(user_id, current_user)

        return follow_user

    return wrapper


def _follow_delete_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
            return actions.unfollow_user(user_id, current_user)

        return unfollow_user

    return wrapper


def _follow_requests_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def follow_requests(current_user: dict = Depends(get_current_user)):
        return actions.follow_requests(current_user)

    return follow_requests


def _approve_follow_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def approve_follow_request(follower_id: str, current_user: dict = Depends(get_current_user)):
        return actions.approve_follow_request(follower_id, current_user)

    return approve_follow_request


def _reject_follow_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def reject_follow_request(follower_id: str, current_user: dict = Depends(get_current_user)):
        return actions.reject_follow_request(follower_id, current_user)

    return reject_follow_request


def _followers_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def followers(user_id: str, current_user: dict = Depends(get_current_user)):
        return actions.followers(user_id, current_user)

    return followers


def _following_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def following(user_id: str, current_user: dict = Depends(get_current_user)):
        return actions.following(user_id, current_user)

    return following


def _remove_follower_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def remove_follower(user_id: str, current_user: dict = Depends(get_current_user)):
        return actions.remove_follower(user_id, current_user)

    return remove_follower


def _blocks_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def block_user(user_id: str, current_user: dict = Depends(get_current_user)):
            return actions.block_user(user_id, current_user)

        return block_user

    return wrapper


def _blocks_delete_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def unblock_user(user_id: str, current_user: dict = Depends(get_current_user)):
            return actions.unblock_user(user_id, current_user)

        return unblock_user

    return wrapper


def _blocked_users_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def blocked_users(current_user: dict = Depends(get_current_user)):
        return actions.blocked_users(current_user)

    return blocked_users


def _shares_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def share_spot(spot_id: str, entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = ShareRequest.model_validate(entity_data)
            return actions.share_spot(spot_id, req, current_user)

        return share_spot

    return wrapper


def _support_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def create_support_ticket(entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = SupportTicketRequest.model_validate(entity_data)
            return actions.create_support_ticket(req, current_user)

        return create_support_ticket

    return wrapper


def _support_admin_list_endpoint(repos):
    actions = _social_actions(repos)
    from core.admin_setup import get_current_admin_user

    async def list_all_support_tickets(_admin_user: dict = Depends(get_current_admin_user)):
        return actions.list_all_support_tickets()

    return list_all_support_tickets


def _support_admin_update_endpoint(repos):
    actions = _social_actions(repos)
    from core.admin_setup import get_current_admin_user

    async def update_ticket_status(
        ticket_id: str,
        ticket_status: str = Query(alias="status"),
        _admin_user: dict = Depends(get_current_admin_user),
    ):
        return actions.update_ticket_status(ticket_id, ticket_status)

    return update_ticket_status


def _support_admin_delete_endpoint(repos):
    actions = _social_actions(repos)
    from core.admin_setup import get_current_admin_user

    async def delete_ticket(ticket_id: str, _admin_user: dict = Depends(get_current_admin_user)):
        return actions.delete_ticket(ticket_id)

    return delete_ticket


def _comments_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def create_comment(spot_id: str, entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = CommentCreateRequest.model_validate(entity_data)
            return actions.create_comment(spot_id, req, current_user)

        return create_comment

    return wrapper


def _comments_list_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def list_comments(spot_id: str, current_user: dict = Depends(get_current_user)):
            return actions.list_comments(spot_id, current_user)

        return list_comments

    return wrapper


def _comments_update_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def update_comment(comment_id: str, entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = CommentUpdateRequest.model_validate(entity_data)
            return actions.update_comment(comment_id, req, current_user)

        return update_comment

    return wrapper


def _comments_delete_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
            return actions.delete_comment(comment_id, current_user)

        return delete_comment

    return wrapper


def _meetups_create_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def create_meetup(entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = MeetupCreateRequest.model_validate(entity_data)
            return actions.create_meetup(req, current_user)

        return create_meetup

    return wrapper


def _meetups_list_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def list_meetups(scope: str = Query(default="upcoming"), current_user: dict = Depends(get_current_user)):
            return actions.list_meetups(scope, current_user)

        return list_meetups

    return wrapper


def _meetups_update_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def update_meetup(meetup_id: str, entity_data: Dict[str, Any], current_user: dict = Depends(get_current_user)):
            req = MeetupUpdateRequest.model_validate(entity_data)
            return actions.update_meetup(meetup_id, req, current_user)

        return update_meetup

    return wrapper


def _meetups_delete_wrapper(repos):
    actions = _social_actions(repos)

    def wrapper(_endpoint):
        from services.auth.current_user import get_current_user

        async def delete_meetup(meetup_id: str, current_user: dict = Depends(get_current_user)):
            return actions.delete_meetup(meetup_id, current_user)

        return delete_meetup

    return wrapper


def _meetup_invites_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def list_meetup_invites(current_user: dict = Depends(get_current_user)):
        return actions.list_meetup_invites(current_user)

    return list_meetup_invites


def _meetup_respond_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def respond_meetup(meetup_id: str, req: MeetupRespondRequest, current_user: dict = Depends(get_current_user)):
        return actions.respond_meetup(meetup_id, req, current_user)

    return respond_meetup


def _meetup_comments_list_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def list_meetup_comments(meetup_id: str, current_user: dict = Depends(get_current_user)):
        return actions.list_meetup_comments(meetup_id, current_user)

    return list_meetup_comments


def _meetup_comments_create_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def create_meetup_comment(meetup_id: str, req: MeetupCommentCreateRequest, current_user: dict = Depends(get_current_user)):
        return actions.create_meetup_comment(meetup_id, req, current_user)

    return create_meetup_comment


def _meetup_comments_update_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def update_meetup_comment(comment_id: str, req: MeetupCommentUpdateRequest, current_user: dict = Depends(get_current_user)):
        return actions.update_meetup_comment(comment_id, req, current_user)

    return update_meetup_comment


def _meetup_comments_delete_endpoint(repos):
    actions = _social_actions(repos)
    from services.auth.current_user import get_current_user

    async def delete_meetup_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
        return actions.delete_meetup_comment(comment_id, current_user)

    return delete_meetup_comment


register_social_actor(
    UpdateProfileRequest,
    name="profile",
    order=10,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.users,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        route_enabled=CrudRouteEnabled(create=False, read_all=False, read=True, update=True, delete=False),
        route_configs=CrudRouteConfigs(
            read=CrudRouteConfig(path="/me", response_model=UserPublic),
            update=CrudRouteConfig(path="/me", response_model=UserPublic),
        ),
        read_wrappers=(_profile_read_wrapper,),
        update_wrappers=(_profile_update_wrapper,),
        extra_routes=(
            ExtraRouteSpec("GET", "/users/search", _user_search_endpoint, response_model=list[UserPublic]),
            ExtraRouteSpec("GET", "/users/{user_id}/profile", _user_profile_endpoint, response_model=UserPublic),
        ),
    ),
)

register_social_actor(
    SpotUpsertRequest,
    name="spots",
    order=20,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.spots,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        id_parser=_non_empty_id,
        entity_path_name="spot_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=True, read=False, update=True, delete=True),
        route_configs=CrudRouteConfigs(
            create=CrudRouteConfig(path="/spots", response_model=SpotPublic),
            read_all=CrudRouteConfig(path="/spots", response_model=list[SpotPublic]),
            update=CrudRouteConfig(path="/spots/{spot_id}", response_model=SpotPublic),
            delete=CrudRouteConfig(path="/spots/{spot_id}"),
        ),
        create_wrappers=(_spots_create_wrapper,),
        read_all_wrappers=(_spots_list_wrapper,),
        update_wrappers=(_spots_update_wrapper,),
        delete_wrappers=(_spots_delete_wrapper,),
        extra_routes=(ExtraRouteSpec("GET", "/users/{user_id}/spots", _user_spots_endpoint, response_model=list[SpotPublic]),),
    ),
)

register_social_actor(
    FavoriteRef,
    name="favorites",
    order=30,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.favorites,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        id_parser=_non_empty_id,
        entity_path_name="spot_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=True, read=False, update=False, delete=True),
        route_configs=CrudRouteConfigs(
            create=CrudRouteConfig(path="/favorites/{spot_id}"),
            read_all=CrudRouteConfig(path="/favorites", response_model=list[FavoriteRef]),
            delete=CrudRouteConfig(path="/favorites/{spot_id}"),
        ),
        create_wrappers=(_favorites_create_wrapper,),
        read_all_wrappers=(_favorites_list_wrapper,),
        delete_wrappers=(_favorites_delete_wrapper,),
        extra_routes=(ExtraRouteSpec("GET", "/users/{user_id}/favorites", _user_favorites_endpoint, response_model=list[FavoriteRef]),),
    ),
)

register_social_actor(
    FollowRef,
    name="follows",
    order=40,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.follows,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        id_parser=_non_empty_id,
        entity_path_name="user_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=False, read=False, update=False, delete=True),
        route_configs=CrudRouteConfigs(
            create=CrudRouteConfig(path="/follow/{user_id}"),
            delete=CrudRouteConfig(path="/follow/{user_id}"),
        ),
        create_wrappers=(_follow_create_wrapper,),
        delete_wrappers=(_follow_delete_wrapper,),
        extra_routes=(
            ExtraRouteSpec("GET", "/follow/requests", _follow_requests_endpoint, response_model=list[FollowRequestRef]),
            ExtraRouteSpec("POST", "/follow/requests/{follower_id}/approve", _approve_follow_endpoint),
            ExtraRouteSpec("POST", "/follow/requests/{follower_id}/reject", _reject_follow_endpoint),
            ExtraRouteSpec("GET", "/followers/{user_id}", _followers_endpoint, response_model=list[FollowRef]),
            ExtraRouteSpec("GET", "/following/{user_id}", _following_endpoint, response_model=list[FollowRef]),
            ExtraRouteSpec("DELETE", "/followers/{user_id}", _remove_follower_endpoint),
        ),
    ),
)

register_social_actor(
    BlockRef,
    name="blocks",
    order=50,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.blocks,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        id_parser=_non_empty_id,
        entity_path_name="user_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=False, read=False, update=False, delete=True),
        route_configs=CrudRouteConfigs(
            create=CrudRouteConfig(path="/block/{user_id}"),
            delete=CrudRouteConfig(path="/block/{user_id}"),
        ),
        create_wrappers=(_blocks_create_wrapper,),
        delete_wrappers=(_blocks_delete_wrapper,),
        extra_routes=(ExtraRouteSpec("GET", "/blocked", _blocked_users_endpoint, response_model=list[BlockRef]),),
    ),
)

register_social_actor(
    ShareRequest,
    name="shares",
    order=60,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.shares,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        id_parser=_non_empty_id,
        entity_path_name="spot_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=False, read=False, update=False, delete=False),
        route_configs=CrudRouteConfigs(create=CrudRouteConfig(path="/share/{spot_id}")),
        create_wrappers=(_shares_create_wrapper,),
    ),
)

register_social_actor(
    SupportTicketRequest,
    name="support",
    order=70,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.support_tickets,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        route_enabled=CrudRouteEnabled(create=True, read_all=False, read=False, update=False, delete=False),
        route_configs=CrudRouteConfigs(create=CrudRouteConfig(path="/support/tickets", response_model=SupportTicketPublic, status_code=201)),
        create_wrappers=(_support_create_wrapper,),
        extra_routes=(
            ExtraRouteSpec("GET", "/support/tickets/admin/all", _support_admin_list_endpoint, response_model=list[SupportTicketPublic]),
            ExtraRouteSpec("PATCH", "/support/tickets/{ticket_id}/status", _support_admin_update_endpoint, response_model=SupportTicketPublic),
            ExtraRouteSpec("DELETE", "/support/tickets/{ticket_id}", _support_admin_delete_endpoint),
        ),
    ),
)

register_social_actor(
    MeetupCreateRequest,
    name="meetups",
    order=80,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.meetups,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        entity_path_name="meetup_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=True, read=False, update=True, delete=True),
        route_configs=CrudRouteConfigs(
            create=CrudRouteConfig(path="/meetups", response_model=MeetupPublic, status_code=201),
            read_all=CrudRouteConfig(path="/meetups", response_model=list[MeetupPublic]),
            update=CrudRouteConfig(path="/meetups/{meetup_id}", response_model=MeetupPublic),
            delete=CrudRouteConfig(path="/meetups/{meetup_id}"),
        ),
        create_wrappers=(_meetups_create_wrapper,),
        read_all_wrappers=(_meetups_list_wrapper,),
        update_wrappers=(_meetups_update_wrapper,),
        delete_wrappers=(_meetups_delete_wrapper,),
        extra_routes=(
            ExtraRouteSpec("GET", "/meetups/invites", _meetup_invites_endpoint, response_model=list[MeetupInviteRef]),
            ExtraRouteSpec("POST", "/meetups/{meetup_id}/respond", _meetup_respond_endpoint, response_model=MeetupInviteRef),
            ExtraRouteSpec("GET", "/meetups/{meetup_id}/comments", _meetup_comments_list_endpoint, response_model=list[MeetupComment]),
            ExtraRouteSpec("POST", "/meetups/{meetup_id}/comments", _meetup_comments_create_endpoint, response_model=MeetupComment, status_code=201),
            ExtraRouteSpec("PATCH", "/meetup-comments/{comment_id}", _meetup_comments_update_endpoint, response_model=MeetupComment),
            ExtraRouteSpec("DELETE", "/meetup-comments/{comment_id}", _meetup_comments_delete_endpoint),
        ),
    ),
)

register_social_actor(
    CommentCreateRequest,
    name="comments",
    order=90,
    crud=SocialCrudSpec(
        repository_getter=lambda repos: repos.comments,
        prefix="",
        auth_dependency_factory=_current_user_dependency,
        collection_path="",
        entity_path_name="comment_id",
        route_enabled=CrudRouteEnabled(create=True, read_all=True, read=False, update=True, delete=True),
        route_configs=CrudRouteConfigs(
            create=CrudRouteConfig(path="/spots/{spot_id}/comments", response_model=SpotComment, status_code=201),
            read_all=CrudRouteConfig(path="/spots/{spot_id}/comments", response_model=list[SpotComment]),
            update=CrudRouteConfig(path="/comments/{comment_id}", response_model=SpotComment, method="PATCH"),
            delete=CrudRouteConfig(path="/comments/{comment_id}"),
        ),
        create_wrappers=(_comments_create_wrapper,),
        read_all_wrappers=(_comments_list_wrapper,),
        update_wrappers=(_comments_update_wrapper,),
        delete_wrappers=(_comments_delete_wrapper,),
    ),
)
