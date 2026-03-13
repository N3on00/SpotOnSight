from functools import wraps
import json
from datetime import UTC, datetime
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Type, TypeVar

from bson import ObjectId, json_util
from fastapi import APIRouter, Body, Depends, HTTPException, Path, Response, status
from pydantic import BaseModel, ValidationError
from pymongo.errors import DuplicateKeyError

# Generic type for Pydantic models
T = TypeVar('T', bound=BaseModel)


@dataclass
class CrudRouteWrappers:
    create: list[Callable[[Callable[..., Any]], Callable[..., Any]]] = field(default_factory=list)
    read_all: list[Callable[[Callable[..., Any]], Callable[..., Any]]] = field(default_factory=list)
    read: list[Callable[[Callable[..., Any]], Callable[..., Any]]] = field(default_factory=list)
    update: list[Callable[[Callable[..., Any]], Callable[..., Any]]] = field(default_factory=list)
    delete: list[Callable[[Callable[..., Any]], Callable[..., Any]]] = field(default_factory=list)


@dataclass
class CrudRouteConfig:
    path: str | None = None
    response_model: Any = None
    status_code: int | None = None
    method: str | None = None


@dataclass
class CrudRouteConfigs:
    create: CrudRouteConfig = field(default_factory=CrudRouteConfig)
    read_all: CrudRouteConfig = field(default_factory=CrudRouteConfig)
    read: CrudRouteConfig = field(default_factory=CrudRouteConfig)
    update: CrudRouteConfig = field(default_factory=CrudRouteConfig)
    delete: CrudRouteConfig = field(default_factory=CrudRouteConfig)


@dataclass
class CrudRouteEnabled:
    create: bool = True
    read_all: bool = True
    read: bool = True
    update: bool = True
    delete: bool = True


class GenericCrudRouter:
    """Generic CRUD router builder with model validation and ObjectId handling."""

    def __init__(
        self,
        model: Type[T],
        repository,
        prefix: str,
        tags: list[str] | None = None,
        id_parser: Callable[[str], Any] | None = None,
        collection_path: str = "/",
        entity_path_name: str = "entity_id",
        route_wrappers: CrudRouteWrappers | None = None,
        route_configs: CrudRouteConfigs | None = None,
        route_enabled: CrudRouteEnabled | None = None,
    ) -> None:
        self.model = model
        self.repository = repository
        self.prefix = prefix
        self.tags = tags or [prefix.strip('/')]
        self.id_parser = id_parser or self._validate_object_id
        self.collection_path = collection_path
        self.entity_path_name = entity_path_name
        self.route_wrappers = route_wrappers or CrudRouteWrappers()
        self.route_configs = route_configs or CrudRouteConfigs()
        self.route_enabled = route_enabled or CrudRouteEnabled()

    def route_dependencies(self) -> list[Any]:
        return []

    def _validate_object_id(self, entity_id: str) -> ObjectId:
        if not ObjectId.is_valid(entity_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid ID format",
            )
        return ObjectId(entity_id)

    def parse_entity_id(self, entity_id: str) -> Any:
        return self.id_parser(entity_id)

    def entity_route_path(self) -> str:
        return f"/{{{self.entity_path_name}}}"

    def include_create_route(self) -> bool:
        return self.route_enabled.create

    def include_read_all_route(self) -> bool:
        return self.route_enabled.read_all

    def include_read_route(self) -> bool:
        return self.route_enabled.read

    def include_update_route(self) -> bool:
        return self.route_enabled.update

    def include_delete_route(self) -> bool:
        return self.route_enabled.delete

    def _route_path(self, config_path: str | None, fallback: str) -> str:
        if config_path is None:
            return fallback
        return config_path

    def handle_exceptions(self, func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=getattr(e, 'status_code', 500),
                    detail={
                        "error": str(e),
                        "type": e.__class__.__name__,
                    },
                )

        return wrapper

    def validate_entity(self, entity_data: Dict[str, Any]) -> T:
        try:
            return self.model.model_validate(entity_data)
        except ValidationError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=e.errors(),
            ) from e

    def create_entity(self, entity_data: Dict[str, Any]):
        entity = self.validate_entity(entity_data)
        entity_id = self.repository.create(entity)
        return {"id": str(entity_id)}

    def read_all_entities(self):
        entities = self.repository.read_all()
        return json.loads(json_util.dumps(entities))

    def read_entity(self, entity_id: Any):
        entity = self.repository.read(entity_id)
        if not entity:
            raise HTTPException(status.HTTP_404_NOT_FOUND)
        return json.loads(json_util.dumps(entity))

    def update_entity(self, entity_id: Any, entity_data: Dict[str, Any]):
        entity = self.validate_entity(entity_data)
        result = self.repository.update(entity_id, entity)
        if not result.modified_count:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Entity not found")
        return {"modified_count": result.modified_count}

    def delete_entity(self, entity_id: Any):
        result = self.repository.delete(entity_id)
        if result.deleted_count == 0:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Entity not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    def register_create_route(self, router: APIRouter) -> None:
        async def create(entity_data: Dict[str, Any] = Body(...)):
            return self.create_entity(entity_data)

        wrapped = self.handle_exceptions(create)
        for wrapper in reversed(self.route_wrappers.create):
            wrapped = wrapper(wrapped)
        config = self.route_configs.create
        router.add_api_route(
            self._route_path(config.path, self.collection_path),
            wrapped,
            methods=[config.method or "POST"],
            response_model=config.response_model,
            status_code=config.status_code or status.HTTP_200_OK,
        )

    def register_read_all_route(self, router: APIRouter) -> None:
        async def read_all():
            return self.read_all_entities()

        wrapped = self.handle_exceptions(read_all)
        for wrapper in reversed(self.route_wrappers.read_all):
            wrapped = wrapper(wrapped)
        config = self.route_configs.read_all
        router.add_api_route(
            self._route_path(config.path, self.collection_path),
            wrapped,
            methods=[config.method or "GET"],
            response_model=config.response_model,
            status_code=config.status_code or status.HTTP_200_OK,
        )

    def register_read_route(self, router: APIRouter) -> None:
        async def read(entity_id: str = Path(alias=self.entity_path_name)):
            return self.read_entity(self.parse_entity_id(entity_id))

        wrapped = self.handle_exceptions(read)
        for wrapper in reversed(self.route_wrappers.read):
            wrapped = wrapper(wrapped)
        config = self.route_configs.read
        router.add_api_route(
            self._route_path(config.path, self.entity_route_path()),
            wrapped,
            methods=[config.method or "GET"],
            response_model=config.response_model,
            status_code=config.status_code or status.HTTP_200_OK,
        )

    def register_update_route(self, router: APIRouter) -> None:
        async def update(entity_id: str = Path(alias=self.entity_path_name), entity_data: Dict[str, Any] = Body(...)):
            return self.update_entity(self.parse_entity_id(entity_id), entity_data)

        wrapped = self.handle_exceptions(update)
        for wrapper in reversed(self.route_wrappers.update):
            wrapped = wrapper(wrapped)
        config = self.route_configs.update
        router.add_api_route(
            self._route_path(config.path, self.entity_route_path()),
            wrapped,
            methods=[config.method or "PUT"],
            response_model=config.response_model,
            status_code=config.status_code or status.HTTP_200_OK,
        )

    def register_delete_route(self, router: APIRouter) -> None:
        async def delete(entity_id: str = Path(alias=self.entity_path_name)):
            return self.delete_entity(self.parse_entity_id(entity_id))

        wrapped = self.handle_exceptions(delete)
        for wrapper in reversed(self.route_wrappers.delete):
            wrapped = wrapper(wrapped)
        config = self.route_configs.delete
        router.add_api_route(
            self._route_path(config.path, self.entity_route_path()),
            wrapped,
            methods=[config.method or "DELETE"],
            response_model=config.response_model,
            status_code=config.status_code or status.HTTP_200_OK,
        )

    def build(self) -> APIRouter:
        router = APIRouter(
            prefix=self.prefix,
            tags=self.tags,
            dependencies=self.route_dependencies(),
        )

        if self.include_create_route():
            self.register_create_route(router)
        if self.include_read_all_route():
            self.register_read_all_route(router)
        if self.include_read_route():
            self.register_read_route(router)
        if self.include_update_route():
            self.register_update_route(router)
        if self.include_delete_route():
            self.register_delete_route(router)

        return router


class AuthenticatedCrudRouter(GenericCrudRouter):
    """Generic CRUD router that adds auth dependency to all operations."""

    def __init__(
        self,
        model: Type[T],
        repository,
        prefix: str,
        tags: list[str] | None = None,
        auth_dependency: Callable[..., Any] | None = None,
        id_parser: Callable[[str], Any] | None = None,
        collection_path: str = "/",
        entity_path_name: str = "entity_id",
        route_wrappers: CrudRouteWrappers | None = None,
        route_configs: CrudRouteConfigs | None = None,
        route_enabled: CrudRouteEnabled | None = None,
    ) -> None:
        super().__init__(
            model=model,
            repository=repository,
            prefix=prefix,
            tags=tags,
            id_parser=id_parser,
            collection_path=collection_path,
            entity_path_name=entity_path_name,
            route_wrappers=route_wrappers,
            route_configs=route_configs,
            route_enabled=route_enabled,
        )
        if auth_dependency is None:
            raise ValueError("AuthenticatedCrudRouter requires an auth dependency")
        self.auth_dependency = auth_dependency

    def route_dependencies(self) -> list[Any]:
        return [Depends(self.auth_dependency)]


class AuthenticatedCreateRouter(AuthenticatedCrudRouter):
    """Authenticated router that keeps generic validation and create wiring only."""

    def __init__(
        self,
        model: Type[T],
        repository,
        prefix: str,
        auth_dependency: Callable[..., Any],
        create_handler: Callable[[T, dict[str, Any]], Any],
        *,
        tags: list[str] | None = None,
        response_model: Any = None,
        status_code: int = status.HTTP_200_OK,
        collection_path: str = "/",
    ) -> None:
        super().__init__(
            model=model,
            repository=repository,
            prefix=prefix,
            tags=tags,
            auth_dependency=auth_dependency,
            collection_path=collection_path,
        )
        self.create_handler = create_handler
        self.response_model = response_model
        self.create_status_code = status_code

    def include_read_all_route(self) -> bool:
        return False

    def include_read_route(self) -> bool:
        return False

    def include_update_route(self) -> bool:
        return False

    def include_delete_route(self) -> bool:
        return False

    def register_create_route(self, router: APIRouter) -> None:
        @router.post(self.collection_path, response_model=self.response_model, status_code=self.create_status_code)
        @self.handle_exceptions
        async def create(
            entity_data: Dict[str, Any] = Body(...),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.create_handler(self.validate_entity(entity_data), current_user)


class AuthenticatedRelationRouter(AuthenticatedCrudRouter):
    """Authenticated router for relation-style add/remove/list endpoints."""

    def __init__(
        self,
        repository,
        prefix: str,
        auth_dependency: Callable[..., Any],
        add_handler: Callable[[Any, dict[str, Any]], Any],
        remove_handler: Callable[[Any, dict[str, Any]], Any],
        list_handler: Callable[[dict[str, Any]], Any],
        *,
        tags: list[str] | None = None,
        list_response_model: Any = None,
        item_path_name: str = "entity_id",
        id_parser: Callable[[str], Any] | None = None,
        collection_path: str = "",
        include_list: bool = True,
    ) -> None:
        super().__init__(
            model=BaseModel,
            repository=repository,
            prefix=prefix,
            tags=tags,
            auth_dependency=auth_dependency,
            id_parser=id_parser,
            collection_path=collection_path,
            entity_path_name=item_path_name,
        )
        self.add_handler = add_handler
        self.remove_handler = remove_handler
        self.list_handler = list_handler
        self.list_response_model = list_response_model
        self.include_list = include_list

    def include_read_route(self) -> bool:
        return False

    def include_update_route(self) -> bool:
        return False

    def include_read_all_route(self) -> bool:
        return self.include_list

    def register_create_route(self, router: APIRouter) -> None:
        @router.post(self.entity_route_path())
        @self.handle_exceptions
        async def create(
            entity_id: str = Path(alias=self.entity_path_name),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.add_handler(self.parse_entity_id(entity_id), current_user)

    def register_read_all_route(self, router: APIRouter) -> None:
        @router.get(self.collection_path, response_model=self.list_response_model)
        @self.handle_exceptions
        async def read_all(current_user: dict[str, Any] = Depends(self.auth_dependency)):
            return self.list_handler(current_user)

    def register_delete_route(self, router: APIRouter) -> None:
        @router.delete(self.entity_route_path())
        @self.handle_exceptions
        async def delete(
            entity_id: str = Path(alias=self.entity_path_name),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.remove_handler(self.parse_entity_id(entity_id), current_user)


class AuthenticatedEntityActionRouter(AuthenticatedCrudRouter):
    """Authenticated router for validated body + path-param action endpoints."""

    def __init__(
        self,
        model: Type[T],
        repository,
        prefix: str,
        auth_dependency: Callable[..., Any],
        action_handler: Callable[[Any, T, dict[str, Any]], Any],
        *,
        tags: list[str] | None = None,
        entity_path_name: str = "entity_id",
        id_parser: Callable[[str], Any] | None = None,
        collection_path: str = "",
        status_code: int = status.HTTP_200_OK,
    ) -> None:
        super().__init__(
            model=model,
            repository=repository,
            prefix=prefix,
            tags=tags,
            auth_dependency=auth_dependency,
            id_parser=id_parser,
            collection_path=collection_path,
            entity_path_name=entity_path_name,
        )
        self.action_handler = action_handler
        self.action_status_code = status_code

    def include_read_all_route(self) -> bool:
        return False

    def include_read_route(self) -> bool:
        return False

    def include_update_route(self) -> bool:
        return False

    def include_delete_route(self) -> bool:
        return False

    def register_create_route(self, router: APIRouter) -> None:
        @router.post(self.entity_route_path(), status_code=self.action_status_code)
        @self.handle_exceptions
        async def create(
            entity_id: str = Path(alias=self.entity_path_name),
            entity_data: Dict[str, Any] = Body(...),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.action_handler(
                self.parse_entity_id(entity_id),
                self.validate_entity(entity_data),
                current_user,
            )


class VisibilityFilteredCrudRouter(AuthenticatedCrudRouter):
    """Authenticated CRUD router that extends generic CRUD with user-aware handlers."""

    def __init__(
        self,
        model: Type[T],
        repository,
        prefix: str,
        auth_dependency: Callable[..., Any],
        list_handler: Callable[[dict[str, Any]], Any],
        create_handler: Callable[[T, dict[str, Any]], Any],
        update_handler: Callable[[Any, T, dict[str, Any]], Any],
        delete_handler: Callable[[Any, dict[str, Any]], Any],
        *,
        tags: list[str] | None = None,
        read_handler: Callable[[Any, dict[str, Any]], Any] | None = None,
        item_response_model: Any = None,
        list_response_model: Any = None,
        include_read: bool = True,
        id_parser: Callable[[str], Any] | None = None,
        collection_path: str = "/",
        entity_path_name: str = "entity_id",
    ) -> None:
        super().__init__(
            model=model,
            repository=repository,
            prefix=prefix,
            tags=tags,
            auth_dependency=auth_dependency,
            id_parser=id_parser,
            collection_path=collection_path,
            entity_path_name=entity_path_name,
        )
        self.list_handler = list_handler
        self.create_handler = create_handler
        self.read_handler = read_handler
        self.update_handler = update_handler
        self.delete_handler = delete_handler
        self.item_response_model = item_response_model
        self.list_response_model = list_response_model
        self._include_read = include_read and read_handler is not None

    def include_read_route(self) -> bool:
        return self._include_read

    def register_create_route(self, router: APIRouter) -> None:
        @router.post(self.collection_path, response_model=self.item_response_model)
        @self.handle_exceptions
        async def create(
            entity_data: Dict[str, Any] = Body(...),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.create_handler(self.validate_entity(entity_data), current_user)

    def register_read_all_route(self, router: APIRouter) -> None:
        @router.get(self.collection_path, response_model=self.list_response_model)
        @self.handle_exceptions
        async def read_all(current_user: dict[str, Any] = Depends(self.auth_dependency)):
            return self.list_handler(current_user)

    def register_read_route(self, router: APIRouter) -> None:
        @router.get(self.entity_route_path(), response_model=self.item_response_model)
        @self.handle_exceptions
        async def read(
            entity_id: str = Path(alias=self.entity_path_name),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            if self.read_handler is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND)
            return self.read_handler(self.parse_entity_id(entity_id), current_user)

    def register_update_route(self, router: APIRouter) -> None:
        @router.put(self.entity_route_path(), response_model=self.item_response_model)
        @self.handle_exceptions
        async def update(
            entity_id: str = Path(alias=self.entity_path_name),
            entity_data: Dict[str, Any] = Body(...),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.update_handler(self.parse_entity_id(entity_id), self.validate_entity(entity_data), current_user)

    def register_delete_route(self, router: APIRouter) -> None:
        @router.delete(self.entity_route_path())
        @self.handle_exceptions
        async def delete(
            entity_id: str = Path(alias=self.entity_path_name),
            current_user: dict[str, Any] = Depends(self.auth_dependency),
        ):
            return self.delete_handler(self.parse_entity_id(entity_id), current_user)


class AuthSessionRouter(GenericCrudRouter):
    """Auth router extension built on top of GenericCrudRouter."""

    def __init__(
        self,
        repository,
        register_model: Type[BaseModel],
        login_model: Type[BaseModel],
        user_public_model: Type[BaseModel],
        token_response_model: Type[BaseModel],
        token_extension,
        password_extension,
        prefix: str = "/auth",
        tags: list[str] | None = None,
    ) -> None:
        super().__init__(model=register_model, repository=repository, prefix=prefix, tags=tags or ["Auth"])
        self.register_model = register_model
        self.login_model = login_model
        self.user_public_model = user_public_model
        self.token_response_model = token_response_model
        self.token_extension = token_extension
        self.password_extension = password_extension

    @staticmethod
    def _as_text(value: Any) -> str:
        return str(value or "").strip()

    def _normalize_login(self, value: Any) -> str:
        return self._as_text(value).lower()

    def _normalize_social_accounts(self, value: Any) -> dict[str, str]:
        if not isinstance(value, dict):
            return {}
        out: dict[str, str] = {}
        for key, item in value.items():
            k = self._as_text(key)
            v = self._as_text(item)
            if not k or not v:
                continue
            if len(k) > 40 or len(v) > 500:
                continue
            out[k] = v
        return out

    def _to_user_public(self, user_doc: dict[str, Any]) -> BaseModel:
        payload = {
            "id": self._as_text(user_doc.get("_id")),
            "username": self._as_text(user_doc.get("username")),
            "email": self._as_text(user_doc.get("email")),
            "display_name": self._as_text(user_doc.get("display_name") or user_doc.get("username")),
            "bio": self._as_text(user_doc.get("bio")),
            "avatar_image": self._as_text(user_doc.get("avatar_image")),
            "social_accounts": self._normalize_social_accounts(user_doc.get("social_accounts")),
            "follow_requires_approval": bool(user_doc.get("follow_requires_approval", False)),
            "created_at": user_doc.get("created_at") or datetime.now(UTC),
        }
        return self.user_public_model.model_validate(payload)

    def _to_auth_response(self, user_doc: dict[str, Any]) -> BaseModel:
        user_id = self._as_text(user_doc.get("_id"))
        username = self._as_text(user_doc.get("username"))
        access_token = self.token_extension.issue_access_token(user_id=user_id, username=username)
        payload = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": self._to_user_public(user_doc),
        }
        return self.token_response_model.model_validate(payload)

    def _build_auth_user_document(self, req: BaseModel, password_hash: str) -> dict[str, Any]:
        username = self._normalize_login(getattr(req, "username", ""))
        email = self._normalize_login(getattr(req, "email", ""))
        display_name = self._as_text(getattr(req, "display_name", "")) or username

        return {
            "username": username,
            "email": email,
            "password_hash": self._as_text(password_hash),
            "display_name": display_name,
            "bio": "",
            "avatar_image": "",
            "social_accounts": {},
            "follow_requires_approval": False,
            "created_at": datetime.now(UTC),
        }

    def _find_user_by_login(self, repository, username_or_email: str) -> dict[str, Any] | None:
        login = self._normalize_login(username_or_email)
        if not login:
            return None
        return repository.find_one({"$or": [{"username": login}, {"email": login}]})

    def _create_registered_user(self, repository, req: BaseModel, password_hash: str) -> dict[str, Any]:
        user_doc = self._build_auth_user_document(req, password_hash=password_hash)
        inserted_id = repository.insert_one(user_doc)
        return repository.find_one({"_id": ObjectId(str(inserted_id))})

    def build(self) -> APIRouter:
        repository = self.repository

        router = APIRouter(prefix=self.prefix, tags=self.tags)

        @router.post("/register", response_model=self.token_response_model)
        @self.handle_exceptions
        async def register(payload: Dict[str, Any] = Body(...)):
            try:
                req = self.register_model.model_validate(payload)
            except ValidationError as e:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.errors()) from e

            password_hash = self.password_extension.hash_password(req.password)

            try:
                user_doc = self._create_registered_user(repository, req, password_hash=password_hash)
            except DuplicateKeyError as e:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Username or email already exists",
                ) from e

            if not user_doc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="User creation failed",
                )

            return self._to_auth_response(user_doc)

        @router.post("/login", response_model=self.token_response_model)
        @self.handle_exceptions
        async def login(payload: Dict[str, Any] = Body(...)):
            try:
                req = self.login_model.model_validate(payload)
            except ValidationError as e:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.errors()) from e

            user_doc = self._find_user_by_login(repository, req.username_or_email)
            if not user_doc:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username/email or password",
                )

            password_hash = self._as_text(user_doc.get("password_hash"))
            if not self.password_extension.verify_password(req.password, password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect username/email or password",
                )

            return self._to_auth_response(user_doc)

        return router


def router_create(
    model: Type[T],
    repository,
    prefix: str,
    tags: list[str] | None = None,
) -> APIRouter:
    return GenericCrudRouter(
        model=model,
        repository=repository,
        prefix=prefix,
        tags=tags,
    ).build()


def router_create_authenticated(
    model: Type[T],
    repository,
    prefix: str,
    auth_dependency: Callable[..., Any],
    tags: list[str] | None = None,
) -> APIRouter:
    return AuthenticatedCrudRouter(
        model=model,
        repository=repository,
        prefix=prefix,
        tags=tags,
        auth_dependency=auth_dependency,
    ).build()


def router_create_auth_sessions(
    repository,
    register_model: Type[BaseModel],
    login_model: Type[BaseModel],
    user_public_model: Type[BaseModel],
    token_response_model: Type[BaseModel],
    token_extension,
    password_extension,
    prefix: str = "/auth",
    tags: list[str] | None = None,
) -> APIRouter:
    return AuthSessionRouter(
        repository=repository,
        register_model=register_model,
        login_model=login_model,
        user_public_model=user_public_model,
        token_response_model=token_response_model,
        token_extension=token_extension,
        password_extension=password_extension,
        prefix=prefix,
        tags=tags,
    ).build()
