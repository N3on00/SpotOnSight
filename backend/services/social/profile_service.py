from __future__ import annotations

from typing import Any
import re

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from models.schemas import UpdateProfileRequest, UserPublic
from services.auth.password_service import password_service
from core.social import (
    as_text,
    ensure_indexes,
    is_blocked_pair,
    normalize_login,
    normalize_social_accounts,
    safe_user_projection,
    serialize_id,
    to_user_public,
    viewer_user_id,
)

from .base_service import SocialServiceBase


class ProfileService(SocialServiceBase):
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
        users = list(
            self.repos.users.collection.find(
                {"$or": [{"username": regex}, {"display_name": regex}]},
                safe_user_projection(),
            ).limit(limit)
        )

        out: list[UserPublic] = []
        for user_doc in users:
            user_id = serialize_id(user_doc.get("_id"))
            if user_id == me_id:
                continue
            if is_blocked_pair(self.repos, me_id, user_id):
                continue
            out.append(to_user_public(user_doc))
        return out

    def get_user_profile(self, user_id: str, current_user: dict[str, Any]) -> UserPublic:
        target_id, target = self.user_or_404(user_id)
        me_id = viewer_user_id(current_user)
        if me_id != target_id and is_blocked_pair(self.repos, me_id, target_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return to_user_public(target)
