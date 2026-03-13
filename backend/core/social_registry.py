from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Type

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.crud import AuthenticatedCrudRouter, CrudRouteConfig, CrudRouteConfigs, CrudRouteEnabled, CrudRouteWrappers, GenericCrudRouter


WrapperFactory = Callable[[Any], Callable[[Callable[..., Any]], Callable[..., Any]]]
EndpointFactory = Callable[[Any], Callable[..., Any]]
DependencyFactory = Callable[[], Any]


@dataclass(frozen=True)
class ExtraRouteSpec:
    method: str
    path: str
    endpoint_factory: EndpointFactory
    response_model: Any = None
    status_code: int = 200
    dependencies: tuple[DependencyFactory, ...] = ()


@dataclass(frozen=True)
class SocialCrudSpec:
    repository_getter: Callable[[Any], Any]
    prefix: str
    tags: tuple[str, ...] = ("Social",)
    auth_dependency_factory: Callable[[], Callable[..., Any]] | None = None
    id_parser: Callable[[str], Any] | None = None
    collection_path: str = "/"
    entity_path_name: str = "entity_id"
    route_enabled: CrudRouteEnabled = field(default_factory=CrudRouteEnabled)
    route_configs: CrudRouteConfigs = field(default_factory=CrudRouteConfigs)
    create_wrappers: tuple[WrapperFactory, ...] = ()
    read_all_wrappers: tuple[WrapperFactory, ...] = ()
    read_wrappers: tuple[WrapperFactory, ...] = ()
    update_wrappers: tuple[WrapperFactory, ...] = ()
    delete_wrappers: tuple[WrapperFactory, ...] = ()
    extra_routes: tuple[ExtraRouteSpec, ...] = ()


@dataclass(frozen=True)
class SocialActorSpec:
    name: str
    model: Type[BaseModel]
    order: int
    crud: SocialCrudSpec


_SOCIAL_ACTORS: list[SocialActorSpec] = []


def register_social_actor(model_cls: Type[BaseModel], *, name: str, order: int, crud: SocialCrudSpec) -> Type[BaseModel]:
    _SOCIAL_ACTORS.append(SocialActorSpec(name=name, model=model_cls, order=order, crud=crud))
    return model_cls


def get_social_actor_specs() -> list[SocialActorSpec]:
    return sorted(_SOCIAL_ACTORS, key=lambda spec: spec.order)


def _build_wrappers(spec: SocialCrudSpec, repos) -> CrudRouteWrappers:
    return CrudRouteWrappers(
        create=[factory(repos) for factory in spec.create_wrappers],
        read_all=[factory(repos) for factory in spec.read_all_wrappers],
        read=[factory(repos) for factory in spec.read_wrappers],
        update=[factory(repos) for factory in spec.update_wrappers],
        delete=[factory(repos) for factory in spec.delete_wrappers],
    )


def _build_base_router(model: Type[BaseModel], spec: SocialCrudSpec, repos) -> APIRouter:
    auth_dependency = spec.auth_dependency_factory() if spec.auth_dependency_factory is not None else None
    repository = spec.repository_getter(repos)
    common_kwargs = dict(
        model=model,
        repository=repository,
        prefix=spec.prefix,
        tags=list(spec.tags),
        id_parser=spec.id_parser,
        collection_path=spec.collection_path,
        entity_path_name=spec.entity_path_name,
        route_wrappers=_build_wrappers(spec, repos),
        route_configs=spec.route_configs,
        route_enabled=spec.route_enabled,
    )
    if auth_dependency is not None:
        return AuthenticatedCrudRouter(auth_dependency=auth_dependency, **common_kwargs).build()
    return GenericCrudRouter(**common_kwargs).build()


def _append_extra_routes(router: APIRouter, spec: SocialCrudSpec, repos) -> None:
    for extra in spec.extra_routes:
        router.add_api_route(
            extra.path,
            extra.endpoint_factory(repos),
            methods=[extra.method],
            response_model=extra.response_model,
            status_code=extra.status_code,
            dependencies=[Depends(factory()) for factory in extra.dependencies],
        )


def build_social_actor_routers(repos) -> list[APIRouter]:
    routers: list[APIRouter] = []
    for actor in get_social_actor_specs():
        base_router = _build_base_router(actor.model, actor.crud, repos)
        _append_extra_routes(base_router, actor.crud, repos)
        routers.append(base_router)
    return routers
