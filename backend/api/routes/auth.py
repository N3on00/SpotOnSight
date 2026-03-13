from __future__ import annotations

from fastapi import APIRouter

from api.crud import router_create_auth_sessions

from repositories.auth_repository import get_auth_user_repository
from services.auth.password_service import password_service
from services.auth.token_service import token_service


_AUTH_ROUTER: APIRouter | None = None


def get_auth_router() -> APIRouter:
    global _AUTH_ROUTER
    if _AUTH_ROUTER is not None:
        return _AUTH_ROUTER

    from models.schemas import AuthTokenResponse, LoginRequest, RegisterRequest, UserPublic

    _AUTH_ROUTER = router_create_auth_sessions(
        repository=get_auth_user_repository(),
        register_model=RegisterRequest,
        login_model=LoginRequest,
        user_public_model=UserPublic,
        token_response_model=AuthTokenResponse,
        token_extension=token_service,
        password_extension=password_service,
        prefix="/auth",
        tags=["Auth"],
    )
    return _AUTH_ROUTER
