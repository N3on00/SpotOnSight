from __future__ import annotations

import sys
from pathlib import Path

from pymongo.errors import DuplicateKeyError

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from core.workflows import (
    ActorRegistry,
    AuthorizeActor,
    BuildActor,
    ExecutionContext,
    LoadActor,
    PersistActor,
    ProjectActor,
    WorkflowDefinition,
    WorkflowRuntime,
    WorkflowServices,
    WorkflowStep,
)


class FakeRepository:
    def __init__(self) -> None:
        self.inserted = []
        self.updated = []
        self.deleted = []
        self.many_deleted = []
        self.collection = self

    def insert_one(self, document):
        self.inserted.append(document)
        return "new-id"

    def find_one(self, query, projection=None):
        _ = projection
        return {"query": query, "ok": True}

    def update_fields(self, query, fields, upsert=False):
        self.updated.append((query, fields, upsert))
        return {"updated": True}

    def delete_one(self, query):
        self.deleted.append(query)
        return {"deleted": True}

    def delete_many(self, query):
        self.many_deleted.append(query)
        return {"deleted_many": True}


def build_runtime(repository: FakeRepository) -> WorkflowRuntime:
    actors = ActorRegistry()
    actors.register("authorize", AuthorizeActor())
    actors.register("load", LoadActor())
    actors.register("build", BuildActor())
    actors.register("persist", PersistActor())
    actors.register("project", ProjectActor())

    services = WorkflowServices(
        repositories={"items": repository},
        policies={
            "allowed": lambda context, config: context.emit("policy", name=config["policy"]),
        },
        loaders={
            "seed": lambda context, config: {"principal": context.principal, "token": config.get("token")},
        },
        builders={
            "query": lambda context, _config: {"id": context.get("entity_id")},
            "document": lambda context, _config: {"entity_id": context.get("entity_id"), "loaded": context.get("loaded")},
        },
        projectors={
            "result": lambda context, _config: {"facts": context.facts, "loaded": context.get("loaded")},
        },
    )
    return WorkflowRuntime(actors=actors, services=services)


def test_workflow_runtime_executes_generic_actors_in_order():
    repository = FakeRepository()
    runtime = build_runtime(repository)
    definition = WorkflowDefinition(
        name="spec.runtime",
        version=1,
        steps=[
            WorkflowStep("authorize", {"policy": "allowed"}),
            WorkflowStep("load", {"loader": "seed", "token": "abc", "store_as": "loaded"}),
            WorkflowStep("build", {"builder": "query", "store_as": "query"}),
            WorkflowStep("build", {"builder": "document", "store_as": "document"}),
            WorkflowStep("persist", {"repository": "items", "operation": "insert_one", "document_key": "document", "store_as": "inserted_id"}),
            WorkflowStep("persist", {"repository": "items", "operation": "find_one", "query_key": "query", "store_as": "loaded_again"}),
            WorkflowStep("project", {"projector": "result"}),
        ],
    )

    context = ExecutionContext(principal={"user": "demo"}, state={"entity_id": "e-1"})
    runtime.run(definition, context)

    assert repository.inserted == [{"entity_id": "e-1", "loaded": {"principal": {"user": "demo"}, "token": "abc"}}]
    assert context.get("inserted_id") == "new-id"
    assert context.get("loaded_again") == {"query": {"id": "e-1"}, "ok": True}
    assert context.result == {
        "facts": [{"type": "policy", "name": "allowed"}],
        "loaded": {"principal": {"user": "demo"}, "token": "abc"},
    }


def test_persist_actor_can_ignore_duplicate_insert_errors():
    class DuplicateRepository(FakeRepository):
        def insert_one(self, document):
            _ = document
            raise DuplicateKeyError("duplicate")

    repository = DuplicateRepository()
    runtime = build_runtime(repository)
    definition = WorkflowDefinition(
        name="spec.runtime.duplicate_insert",
        version=1,
        steps=[
            WorkflowStep("build", {"builder": "document", "store_as": "document"}),
            WorkflowStep(
                "persist",
                {
                    "repository": "items",
                    "operation": "insert_one_ignore_duplicate",
                    "document_key": "document",
                    "store_as": "inserted_id",
                },
            ),
        ],
    )

    context = ExecutionContext(principal={"user": "demo"}, state={"entity_id": "e-1", "loaded": {}})
    runtime.run(definition, context)

    assert context.get("inserted_id") is None
