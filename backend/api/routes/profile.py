from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from models.schemas import UpdateProfileRequest, UserPublic
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.profile_service import ProfileService


def create_profile_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = ProfileService(repos)

    @router.get("/me", response_model=UserPublic)
    def me(current_user: dict = Depends(get_current_user)):
        return service.get_me(current_user)

    @router.put("/me", response_model=UserPublic)
    def update_me(req: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
        return service.update_me(req, current_user)

    @router.get("/users/search", response_model=list[UserPublic])
    def search_users(
        q: str = Query(default="", max_length=80),
        limit: int = Query(default=20, ge=1, le=50),
        current_user: dict = Depends(get_current_user),
    ):
        return service.search_users(q, limit, current_user)

    @router.get("/users/{user_id}/profile", response_model=UserPublic)
    def user_profile(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.get_user_profile(user_id, current_user)

    return router
