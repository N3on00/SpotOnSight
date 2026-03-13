from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.crud import AuthenticatedRelationRouter
from models.schemas import BlockRef
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.blocks_service import BlocksService


def _blocked_user_id(user_id: str) -> str:
    text = str(user_id or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
    return text


def create_blocks_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = BlocksService(repos)
    router.include_router(
        AuthenticatedRelationRouter(
            repository=repos.blocks,
            prefix="/block",
            tags=["Social"],
            auth_dependency=get_current_user,
            add_handler=service.block_user,
            remove_handler=service.unblock_user,
            list_handler=service.blocked_users,
            item_path_name="user_id",
            id_parser=_blocked_user_id,
            include_list=False,
        ).build()
    )

    @router.get("/blocked", response_model=list[BlockRef])
    def blocked_users(current_user: dict = Depends(get_current_user)):
        return service.blocked_users(current_user)

    return router
