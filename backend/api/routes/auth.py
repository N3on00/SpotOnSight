from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from core.text import normalize_email, normalize_login, normalize_search_text, normalize_text, normalize_username
from services.auth.current_user import get_current_user
from services.auth.password_service import password_service
from services.auth.token_service import token_service


def _as_text(value: Any) -> str:
    return normalize_text(value)


def _to_user_public(user_public_model, user_doc: dict[str, Any]):
    payload = {
        "id": _as_text(user_doc.get("_id")),
        "username": _as_text(user_doc.get("username")),
        "email": _as_text(user_doc.get("email")),
        "display_name": _as_text(user_doc.get("display_name") or user_doc.get("username")),
        "bio": _as_text(user_doc.get("bio")),
        "avatar_image": _as_text(user_doc.get("avatar_image")),
        "social_accounts": user_doc.get("social_accounts") if isinstance(user_doc.get("social_accounts"), dict) else {},
        "follow_requires_approval": bool(user_doc.get("follow_requires_approval", False)),
        "is_admin": bool(user_doc.get("is_admin", False)),
        "created_at": user_doc.get("created_at") or datetime.now(UTC),
    }
    return user_public_model.model_validate(payload)


def _to_auth_response(token_response_model, user_public_model, user_doc: dict[str, Any]):
    user_id = _as_text(user_doc.get("_id"))
    username = _as_text(user_doc.get("username"))
    access_token = token_service.issue_access_token(user_id=user_id, username=username)
    payload = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": _to_user_public(user_public_model, user_doc),
    }
    return token_response_model.model_validate(payload)


def _find_user_by_login(repository, username_or_email: str) -> dict[str, Any] | None:
    login = normalize_login(username_or_email)
    if not login:
        return None
    search_key = normalize_search_text(login)
    return repository.find_one(
        {
            "$or": [
                {"username": login},
                {"username_key": search_key},
                {"email": login},
                {"email_key": normalize_email(login)},
            ]
        }
    )


def _build_user_document(req, password_hash: str) -> dict[str, Any]:
    username = normalize_username(getattr(req, "username", ""))
    email = normalize_email(getattr(req, "email", ""))
    display_name = _as_text(getattr(req, "display_name", "")) or username
    return {
        "username": username,
        "username_key": normalize_search_text(username),
        "username_search": normalize_search_text(username),
        "email": email,
        "email_key": normalize_email(email),
        "password_hash": _as_text(password_hash),
        "display_name": display_name,
        "display_name_search": normalize_search_text(display_name),
        "bio": "",
        "avatar_image": "",
        "social_accounts": {},
        "follow_requires_approval": False,
        "created_at": datetime.now(UTC),
    }


def build_auth_router(repository) -> APIRouter:
    from models.schemas import AuthTokenResponse, LoginRequest, RegisterRequest, UserPublic

    router = APIRouter(prefix="/auth", tags=["Auth"])

    @router.post("/register", response_model=AuthTokenResponse)
    async def register(payload: dict[str, Any] = Body(...)):
        try:
            req = RegisterRequest.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc

        password_hash = password_service.hash_password(req.password)
        user_doc = _build_user_document(req, password_hash=password_hash)
        try:
            inserted_id = repository.insert_one(user_doc)
        except DuplicateKeyError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists") from exc

        created = repository.find_one({"_id": ObjectId(str(inserted_id))})
        if not created:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User creation failed")
        return _to_auth_response(AuthTokenResponse, UserPublic, created)

    @router.post("/login", response_model=AuthTokenResponse)
    async def login(payload: dict[str, Any] = Body(...)):
        try:
            req = LoginRequest.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc

        user_doc = _find_user_by_login(repository, req.username_or_email)
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username/email or password")
        if normalize_login(user_doc.get("account_status")) == "banned":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been banned")

        password_hash = _as_text(user_doc.get("password_hash"))
        if not password_service.verify_password(req.password, password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username/email or password")

        return _to_auth_response(AuthTokenResponse, UserPublic, user_doc)

    @router.delete('/account')
    async def delete_account(
        payload: dict[str, Any] = Body(...),
        current_user: dict[str, Any] = Depends(get_current_user),
    ):
        password = payload.get('password', '')
        if not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Password required for account deletion')

        user_id = current_user.get('_id')
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Not authenticated')

        user_doc = repository.find_one({'_id': user_id})
        if not user_doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='User not found')

        password_hash = _as_text(user_doc.get('password_hash'))
        if not password_service.verify_password(password, password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Incorrect password')

        repository.delete_one({'_id': user_id})
        return {'message': 'Account deleted successfully', 'deleted': True}

    return router
