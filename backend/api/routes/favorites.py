from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from api.crud import AuthenticatedRelationRouter
from models.schemas import FavoriteRef
from services.auth.current_user import get_current_user
from core.social import SocialRepositories

from services.social.favorites_service import FavoritesService


def _favorite_spot_id(spot_id: str) -> str:
    text = str(spot_id or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
    return text


def create_favorites_router(repos: SocialRepositories) -> APIRouter:
    router = APIRouter()
    service = FavoritesService(repos)
    router.include_router(
        AuthenticatedRelationRouter(
            repository=repos.favorites,
            prefix="/favorites",
            tags=["Social"],
            auth_dependency=get_current_user,
            add_handler=service.add_favorite,
            remove_handler=service.remove_favorite,
            list_handler=service.list_favorites,
            list_response_model=list[FavoriteRef],
            item_path_name="spot_id",
            id_parser=_favorite_spot_id,
            collection_path="",
        ).build()
    )

    @router.get("/users/{user_id}/favorites", response_model=list[FavoriteRef])
    def user_favorites(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.user_favorites(user_id, current_user)

    return router
