from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from api.crud import AuthenticatedEntityActionRouter
from models.schemas import ShareRequest
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.shares_service import SharesService


def _share_spot_id(spot_id: str) -> str:
    text = str(spot_id or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
    return text


def create_shares_router(repos: SocialRepositories) -> APIRouter:
    service = SharesService(repos)
    return AuthenticatedEntityActionRouter(
        model=ShareRequest,
        repository=repos.shares,
        prefix="/share",
        tags=["Social"],
        auth_dependency=get_current_user,
        action_handler=service.share_spot,
        entity_path_name="spot_id",
        id_parser=_share_spot_id,
        collection_path="",
    ).build()
