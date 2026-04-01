from __future__ import annotations

from typing import Any

from bson import json_util
from fastapi import APIRouter, Body, Depends, HTTPException, Response, status
from pydantic import ValidationError

from models.schemas import ClientErrorReport, Spot
from repositories.mongo_repository import MongoRepository
from services.auth.current_user import get_current_user


def _jsonable(value):
    return json_util.loads(json_util.dumps(value))


def _build_authenticated_entity_router(model, repository, *, prefix: str, tags: list[str]) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=tags)

    @router.post("/")
    async def create_entity(entity_data: dict[str, Any] = Body(...), _current_user: dict = Depends(get_current_user)):
        try:
            entity = model.model_validate(entity_data)
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
        entity_id = repository.create(entity)
        return {"id": str(entity_id)}

    @router.get("/")
    async def read_all_entities(_current_user: dict = Depends(get_current_user)):
        return _jsonable(repository.read_all())

    @router.get("/{entity_id}")
    async def read_entity(entity_id: str, _current_user: dict = Depends(get_current_user)):
        entity = repository.read(entity_id)
        if not entity:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        return _jsonable(entity)

    @router.put("/{entity_id}")
    async def update_entity(entity_id: str, entity_data: dict[str, Any] = Body(...), _current_user: dict = Depends(get_current_user)):
        try:
            entity = model.model_validate(entity_data)
        except ValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
        result = repository.update(entity_id, entity)
        if not result.modified_count:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Entity not found")
        return {"modified_count": result.modified_count}

    @router.delete("/{entity_id}")
    async def delete_entity(entity_id: str, _current_user: dict = Depends(get_current_user)):
        result = repository.delete(entity_id)
        if result.deleted_count == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Entity not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return router


def build_entity_routers() -> list[APIRouter]:
    return [
        _build_authenticated_entity_router(
            Spot,
            MongoRepository(collection_name="spots", model_type=Spot),
            prefix="/spots",
            tags=["Spots"],
        ),
        _build_authenticated_entity_router(
            ClientErrorReport,
            MongoRepository(collection_name="client_error_reports", model_type=ClientErrorReport),
            prefix="/client-errors",
            tags=["ClientErrors"],
        ),
    ]
