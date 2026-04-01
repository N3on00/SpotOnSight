from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import APIRouter


EndpointFactory = Callable[[Any], Callable[..., Any]]


@dataclass(frozen=True)
class EndpointSpec:
    method: str
    path: str
    endpoint_factory: EndpointFactory
    response_model: Any = None
    status_code: int = 200


@dataclass(frozen=True)
class RouterSpec:
    prefix: str
    tags: tuple[str, ...]
    endpoints: tuple[EndpointSpec, ...] = field(default_factory=tuple)
    lifespan: Any = None


def build_router(spec: RouterSpec, context) -> APIRouter:
    router = APIRouter(prefix=spec.prefix, tags=list(spec.tags), lifespan=spec.lifespan)
    for endpoint in spec.endpoints:
        router.add_api_route(
            endpoint.path,
            endpoint.endpoint_factory(context),
            methods=[endpoint.method],
            response_model=endpoint.response_model,
            status_code=endpoint.status_code,
        )
    return router
