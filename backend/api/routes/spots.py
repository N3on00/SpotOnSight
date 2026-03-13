from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from models.schemas import SpotPublic, SpotUpsertRequest
from services.auth.current_user import get_current_user
from api.crud import VisibilityFilteredCrudRouter
from core.social import SocialRepositories

from services.social.spots_service import SpotsService


def _spot_route_id(spot_id: str) -> str:
    text = str(spot_id or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid ID format")
    return text


def create_spots_router(repos: SocialRepositories) -> APIRouter:
    service = SpotsService(repos)

    router = APIRouter()
    spots_crud_router = VisibilityFilteredCrudRouter(
        model=SpotUpsertRequest,
        repository=repos.spots,
        prefix="/spots",
        tags=["Social"],
        auth_dependency=get_current_user,
        list_handler=service.list_visible_spots,
        create_handler=service.create_spot,
        update_handler=service.update_spot,
        delete_handler=service.delete_spot,
        item_response_model=SpotPublic,
        list_response_model=list[SpotPublic],
        include_read=False,
        id_parser=_spot_route_id,
        collection_path="",
        entity_path_name="spot_id",
    ).build()
    router.include_router(spots_crud_router)

    @router.get("/users/{user_id}/spots", response_model=list[SpotPublic])
    def user_spots(user_id: str, current_user: dict = Depends(get_current_user)):
        return service.user_spots(user_id, current_user)

    return router
