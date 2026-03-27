from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Protocol

from pymongo.errors import DuplicateKeyError


Resolver = Callable[["ExecutionContext", dict[str, Any]], Any]
Policy = Callable[["ExecutionContext", dict[str, Any]], None]
Projector = Callable[["ExecutionContext", dict[str, Any]], Any]


@dataclass(slots=True)
class WorkflowStep:
    actor: str
    config: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class WorkflowDefinition:
    name: str
    version: int
    steps: list[WorkflowStep]


@dataclass(slots=True)
class ExecutionContext:
    principal: Any = None
    input: Any = None
    state: dict[str, Any] = field(default_factory=dict)
    result: Any = None
    facts: list[dict[str, Any]] = field(default_factory=list)

    def get(self, key: str, default: Any = None) -> Any:
        text = str(key or "").strip()
        if not text:
            return default
        if text == "principal":
            return self.principal
        if text == "input":
            return self.input
        if text == "result":
            return self.result
        return self.state.get(text, default)

    def put(self, key: str, value: Any) -> Any:
        text = str(key or "").strip()
        if not text:
            raise ValueError("Context key is required")
        if text == "principal":
            self.principal = value
        elif text == "input":
            self.input = value
        elif text == "result":
            self.result = value
        else:
            self.state[text] = value
        return value

    def emit(self, fact_type: str, **payload: Any) -> None:
        self.facts.append({"type": str(fact_type or "").strip(), **payload})


@dataclass(slots=True)
class WorkflowServices:
    repositories: Mapping[str, Any] = field(default_factory=dict)
    builders: Mapping[str, Resolver] = field(default_factory=dict)
    loaders: Mapping[str, Resolver] = field(default_factory=dict)
    policies: Mapping[str, Policy] = field(default_factory=dict)
    projectors: Mapping[str, Projector] = field(default_factory=dict)

    def builder(self, key: str) -> Resolver:
        return _get_from_registry(self.builders, key, "builder")

    def loader(self, key: str) -> Resolver:
        return _get_from_registry(self.loaders, key, "loader")

    def policy(self, key: str) -> Policy:
        return _get_from_registry(self.policies, key, "policy")

    def projector(self, key: str) -> Projector:
        return _get_from_registry(self.projectors, key, "projector")

    def repository(self, key: str) -> Any:
        return _get_from_registry(self.repositories, key, "repository")


def _get_from_registry(registry: Mapping[str, Any], key: str, kind: str) -> Any:
    name = str(key or "").strip()
    if not name:
        raise KeyError(f"Workflow {kind} key is required")
    try:
        return registry[name]
    except KeyError as exc:
        raise KeyError(f"Unknown workflow {kind}: {name}") from exc


class Actor(Protocol):
    def execute(self, context: ExecutionContext, step: WorkflowStep, services: WorkflowServices) -> None:
        ...


class ActorRegistry:
    def __init__(self) -> None:
        self._actors: dict[str, Actor] = {}

    def register(self, key: str, actor: Actor) -> None:
        name = str(key or "").strip()
        if not name:
            raise ValueError("Actor key is required")
        if name in self._actors:
            raise ValueError(f"Duplicate actor key: {name}")
        self._actors[name] = actor

    def resolve(self, key: str) -> Actor:
        return _get_from_registry(self._actors, key, "actor")


class AuthorizeActor:
    def execute(self, context: ExecutionContext, step: WorkflowStep, services: WorkflowServices) -> None:
        policy = services.policy(step.config.get("policy"))
        policy(context, step.config)


class LoadActor:
    def execute(self, context: ExecutionContext, step: WorkflowStep, services: WorkflowServices) -> None:
        loader = services.loader(step.config.get("loader"))
        value = loader(context, step.config)
        store_as = str(step.config.get("store_as") or "").strip()
        if store_as:
            context.put(store_as, value)


class BuildActor:
    def execute(self, context: ExecutionContext, step: WorkflowStep, services: WorkflowServices) -> None:
        builder = services.builder(step.config.get("builder"))
        value = builder(context, step.config)
        store_as = str(step.config.get("store_as") or "").strip()
        if store_as:
            context.put(store_as, value)


class PersistActor:
    def execute(self, context: ExecutionContext, step: WorkflowStep, services: WorkflowServices) -> None:
        repository = services.repository(step.config.get("repository"))
        operation = str(step.config.get("operation") or "").strip().lower()
        store_as = str(step.config.get("store_as") or "").strip()

        if operation == "insert_one":
            document = context.get(step.config.get("document_key"))
            value = repository.insert_one(document)
        elif operation == "insert_one_ignore_duplicate":
            document = context.get(step.config.get("document_key"))
            try:
                value = repository.insert_one(document)
            except DuplicateKeyError:
                value = None
        elif operation == "find_one":
            query = context.get(step.config.get("query_key"), {})
            projection = step.config.get("projection")
            value = repository.find_one(query, projection)
        elif operation == "update_fields":
            query = context.get(step.config.get("query_key"), {})
            fields = context.get(step.config.get("document_key"), {})
            value = repository.update_fields(query, fields, upsert=bool(step.config.get("upsert", False)))
        elif operation == "delete_one":
            query = context.get(step.config.get("query_key"), {})
            value = repository.collection.delete_one(query)
        elif operation == "delete_many":
            query = context.get(step.config.get("query_key"), {})
            value = repository.delete_many(query)
        else:
            raise ValueError(f"Unsupported persist operation: {operation}")

        if store_as:
            context.put(store_as, value)


class ProjectActor:
    def execute(self, context: ExecutionContext, step: WorkflowStep, services: WorkflowServices) -> None:
        projector = services.projector(step.config.get("projector"))
        value = projector(context, step.config)
        target = str(step.config.get("store_as") or "result").strip() or "result"
        context.put(target, value)


class WorkflowRuntime:
    def __init__(self, *, actors: ActorRegistry, services: WorkflowServices) -> None:
        self.actors = actors
        self.services = services

    def run(self, definition: WorkflowDefinition, context: ExecutionContext) -> ExecutionContext:
        for step in definition.steps:
            actor = self.actors.resolve(step.actor)
            actor.execute(context, step, self.services)
        return context
