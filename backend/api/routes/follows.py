from __future__ import annotations

from fastapi import APIRouter, Depends

from models.schemas import FollowRef, FollowRequestRef
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.follows_service import FollowsService


def create_follows_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = FollowsService(repos)

    @router.get("/follow/requests", response_model=list[FollowRequestRef])
    def follow_requests(current_user: dict = Depends(get_current_user)):
        return service.follow_requests(current_user)

    @router.post("/follow/requests/{follower_id}/approve")
    def approve_follow_request(follower_id: str, current_user: dict = Depends(get_current_user)):
        return service.approve_follow_request(follower_id, current_user)

    @router.post("/follow/requests/{follower_id}/reject")
    def reject_follow_request(follower_id: str, current_user: dict = Depends(get_current_user)):
        return service.reject_follow_request(follower_id, current_user)

    @router.post("/follow/{user_id}")
    def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.follow_user(user_id, current_user)

    @router.delete("/follow/{user_id}")
    def unfollow_user(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.unfollow_user(user_id, current_user)

    @router.get("/followers/{user_id}", response_model=list[FollowRef])
    def followers(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.followers(user_id, current_user)

    @router.get("/following/{user_id}", response_model=list[FollowRef])
    def following(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.following(user_id, current_user)

    @router.delete("/followers/{user_id}")
    def remove_follower(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.remove_follower(user_id, current_user)

    return router
