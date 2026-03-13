from __future__ import annotations

from fastapi import APIRouter, Depends

from models.schemas import CommentCreateRequest, CommentUpdateRequest, SpotComment
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.comments_service import CommentsService


def create_comments_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = CommentsService(repos)

    @router.get("/spots/{spot_id}/comments", response_model=list[SpotComment])
    def list_comments(spot_id: str, current_user: dict = Depends(get_current_user)):
        return service.list_comments(spot_id, current_user)

    @router.post("/spots/{spot_id}/comments", response_model=SpotComment, status_code=201)
    def create_comment(spot_id: str, req: CommentCreateRequest, current_user: dict = Depends(get_current_user)):
        return service.create_comment(spot_id, req, current_user)

    @router.patch("/comments/{comment_id}", response_model=SpotComment)
    def update_comment(comment_id: str, req: CommentUpdateRequest, current_user: dict = Depends(get_current_user)):
        return service.update_comment(comment_id, req, current_user)

    @router.delete("/comments/{comment_id}")
    def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
        return service.delete_comment(comment_id, current_user)

    return router
