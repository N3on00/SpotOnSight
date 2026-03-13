from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from models.schemas import (
    MeetupComment,
    MeetupCommentCreateRequest,
    MeetupCommentUpdateRequest,
    MeetupCreateRequest,
    MeetupInviteRef,
    MeetupPublic,
    MeetupRespondRequest,
    MeetupUpdateRequest,
)
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.meetups_service import MeetupsService


def create_meetups_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = MeetupsService(repos)

    @router.post("/meetups", response_model=MeetupPublic, status_code=201)
    def create_meetup(req: MeetupCreateRequest, current_user: dict = Depends(get_current_user)):
        return service.create_meetup(req, current_user)

    @router.get("/meetups", response_model=list[MeetupPublic])
    def list_meetups(scope: str = Query(default="upcoming"), current_user: dict = Depends(get_current_user)):
        return service.list_meetups(scope, current_user)

    @router.put("/meetups/{meetup_id}", response_model=MeetupPublic)
    def update_meetup(meetup_id: str, req: MeetupUpdateRequest, current_user: dict = Depends(get_current_user)):
        return service.update_meetup(meetup_id, req, current_user)

    @router.delete("/meetups/{meetup_id}")
    def delete_meetup(meetup_id: str, current_user: dict = Depends(get_current_user)):
        return service.delete_meetup(meetup_id, current_user)

    @router.get("/meetups/invites", response_model=list[MeetupInviteRef])
    def list_meetup_invites(current_user: dict = Depends(get_current_user)):
        return service.list_meetup_invites(current_user)

    @router.post("/meetups/{meetup_id}/respond", response_model=MeetupInviteRef)
    def respond_meetup(meetup_id: str, req: MeetupRespondRequest, current_user: dict = Depends(get_current_user)):
        return service.respond_meetup(meetup_id, req, current_user)

    @router.get("/meetups/{meetup_id}/comments", response_model=list[MeetupComment])
    def list_meetup_comments(meetup_id: str, current_user: dict = Depends(get_current_user)):
        return service.list_meetup_comments(meetup_id, current_user)

    @router.post("/meetups/{meetup_id}/comments", response_model=MeetupComment, status_code=201)
    def create_meetup_comment(meetup_id: str, req: MeetupCommentCreateRequest, current_user: dict = Depends(get_current_user)):
        return service.create_meetup_comment(meetup_id, req, current_user)

    @router.patch("/meetup-comments/{comment_id}", response_model=MeetupComment)
    def update_meetup_comment(comment_id: str, req: MeetupCommentUpdateRequest, current_user: dict = Depends(get_current_user)):
        return service.update_meetup_comment(comment_id, req, current_user)

    @router.delete("/meetup-comments/{comment_id}")
    def delete_meetup_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
        return service.delete_meetup_comment(comment_id, current_user)

    return router
