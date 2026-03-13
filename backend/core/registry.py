from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Type, TypeVar

from fastapi import APIRouter
from pydantic import BaseModel

from repositories.mongo_repository import MongoRepository
from api.crud import router_create, router_create_authenticated

T = TypeVar("T", bound=BaseModel)


@dataclass(frozen=True)
class EntityBinding:
    model: Type[BaseModel]
    collection: str
    prefix: str
    tags: list[str]
    authenticated: bool
    router: APIRouter


_REGISTRY: list[EntityBinding] = []


def get_routers() -> list[APIRouter]:
    return [b.router for b in _REGISTRY]


def mongo_entity(
    *,
    collection: str,
    prefix: str | None = None,
    tags: list[str] | None = None,
    authenticated: bool = False,
    auth_dependency: Callable[..., Any] | None = None,
) -> Callable[[Type[T]], Type[T]]:
    """Class decorator that registers a model and auto-creates its CRUD router."""

    def decorator(model_cls: Type[T]) -> Type[T]:
        effective_prefix = prefix or f"/{collection}"
        effective_tags = tags or [collection]

        repo = MongoRepository(collection_name=collection, model_type=model_cls)
        if authenticated:
            if auth_dependency is None:
                raise ValueError(
                    f"mongo_entity('{collection}') requires auth_dependency when authenticated=True"
                )
            router = router_create_authenticated(
                model=model_cls,
                repository=repo,
                prefix=effective_prefix,
                tags=effective_tags,
                auth_dependency=auth_dependency,
            )
        else:
            router = router_create(
                model=model_cls,
                repository=repo,
                prefix=effective_prefix,
                tags=effective_tags,
            )

        _REGISTRY.append(
            EntityBinding(
                model=model_cls,
                collection=collection,
                prefix=effective_prefix,
                tags=effective_tags,
                authenticated=authenticated,
                router=router,
            )
        )
        return model_cls

    return decorator


def mongo_entity_encrypted(
    *,
    collection: str,
    prefix: str | None = None,
    tags: list[str] | None = None,
) -> Callable[[Type[T]], Type[T]]:
    """Convenience decorator: authenticated mongo entity with auth/jwt checks.

    Uses the existing generic decorator/router stack and the auth logic from auth_routes.
    """

    from services.auth.current_user import get_current_user

    return mongo_entity(
        collection=collection,
        prefix=prefix,
        tags=tags,
        authenticated=True,
        auth_dependency=get_current_user,
    )
