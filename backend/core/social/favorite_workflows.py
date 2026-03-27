from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from bson import ObjectId

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

from .builders import visible_favorite_refs
from .ids import as_text, serialize_id

if TYPE_CHECKING:
    from .actions import SocialActions


def _build_actor_registry() -> ActorRegistry:
    registry = ActorRegistry()
    registry.register("authorize", AuthorizeActor())
    registry.register("load", LoadActor())
    registry.register("build", BuildActor())
    registry.register("persist", PersistActor())
    registry.register("project", ProjectActor())
    return registry


def _workflow(name: str, *steps: WorkflowStep) -> WorkflowDefinition:
    return WorkflowDefinition(name=name, version=1, steps=list(steps))


FAVORITE_WORKFLOWS: dict[str, WorkflowDefinition] = {
    "favorites.add": _workflow(
        "favorites.add",
        WorkflowStep("load", {"loader": "spots.target", "store_as": "target_spot"}),
        WorkflowStep("authorize", {"policy": "spots.visible_access", "detail": "Spot is not visible to you"}),
        WorkflowStep("build", {"builder": "favorites.add_document", "store_as": "favorite_doc"}),
        WorkflowStep(
            "persist",
            {
                "repository": "favorites",
                "operation": "insert_one_ignore_duplicate",
                "document_key": "favorite_doc",
            },
        ),
        WorkflowStep("project", {"projector": "ok"}),
    ),
    "favorites.remove": _workflow(
        "favorites.remove",
        WorkflowStep("build", {"builder": "favorites.remove_query", "store_as": "favorites_remove_query"}),
        WorkflowStep("persist", {"repository": "favorites", "operation": "delete_many", "query_key": "favorites_remove_query"}),
        WorkflowStep("project", {"projector": "ok"}),
    ),
    "favorites.list_for_me": _workflow(
        "favorites.list_for_me",
        WorkflowStep("load", {"loader": "favorites.viewer_rows", "store_as": "favorite_rows"}),
        WorkflowStep("project", {"projector": "favorites.visible_refs"}),
    ),
    "favorites.list_for_user": _workflow(
        "favorites.list_for_user",
        WorkflowStep("load", {"loader": "users.target_bundle", "store_as": "target_user"}),
        WorkflowStep("authorize", {"policy": "users.private_profile_access"}),
        WorkflowStep("load", {"loader": "favorites.target_rows", "store_as": "favorite_rows"}),
        WorkflowStep("project", {"projector": "favorites.visible_refs"}),
    ),
}


class FavoriteWorkflowExecutor:
    def __init__(self, actions: SocialActions) -> None:
        self.actions = actions
        self.runtime = WorkflowRuntime(actors=_build_actor_registry(), services=self._build_services())

    def add_favorite(self, spot_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        return self._run("favorites.add", principal=current_user, state={"spot_id": spot_id}).result

    def remove_favorite(self, spot_id: str, current_user: dict[str, Any]) -> dict[str, bool]:
        return self._run("favorites.remove", principal=current_user, state={"spot_id": spot_id}).result

    def list_favorites(self, current_user: dict[str, Any]):
        return self._run("favorites.list_for_me", principal=current_user).result

    def user_favorites(self, user_id: str, current_user: dict[str, Any]):
        return self._run("favorites.list_for_user", principal=current_user, state={"user_id": user_id}).result

    def _run(self, workflow_key: str, *, principal: Any, state: dict[str, Any] | None = None) -> ExecutionContext:
        definition = FAVORITE_WORKFLOWS[workflow_key]
        context = ExecutionContext(principal=principal, state=dict(state or {}))
        return self.runtime.run(definition, context)

    def _build_services(self) -> WorkflowServices:
        return WorkflowServices(
            repositories={
                "favorites": self.actions.repos.favorites,
            },
            loaders={
                "spots.target": self._load_target_spot,
                "favorites.viewer_rows": self._load_viewer_favorites,
                "users.target_bundle": self._load_target_user_bundle,
                "favorites.target_rows": self._load_target_user_favorites,
            },
            builders={
                "favorites.add_document": self._build_add_document,
                "favorites.remove_query": self._build_remove_query,
            },
            policies={
                "spots.visible_access": self._policy_spot_visible_access,
                "users.private_profile_access": self._policy_private_profile_access,
            },
            projectors={
                "favorites.visible_refs": self._project_visible_favorite_refs,
                "ok": self._project_ok,
            },
        )

    def _policy_spot_visible_access(self, context: ExecutionContext, config: dict[str, Any]) -> None:
        spot = context.get("target_spot") or {}
        detail = as_text(config.get("detail")) or "Spot is not visible to you"
        viewer_id = self.actions.require_spot_visible(spot, context.principal, detail)
        context.put("viewer_user_id", viewer_id)

    def _policy_private_profile_access(self, context: ExecutionContext, _config: dict[str, Any]) -> None:
        target_bundle = context.get("target_user") or {}
        target_doc = target_bundle.get("doc") or {}
        viewer_id = self.actions.require_private_profile_access(target_doc, context.principal)
        context.put("viewer_user_id", viewer_id)

    def _load_target_spot(self, context: ExecutionContext, _config: dict[str, Any]) -> dict[str, Any]:
        return self.actions.spot_or_404(as_text(context.get("spot_id")))

    def _load_viewer_favorites(self, context: ExecutionContext, _config: dict[str, Any]) -> list[dict[str, Any]]:
        viewer_id = self.actions.me_id(context.principal)
        context.put("viewer_user_id", viewer_id)
        return list(self.actions.repos.favorites.collection.find({"user_id": viewer_id}).sort("created_at", -1).limit(2000))

    def _load_target_user_bundle(self, context: ExecutionContext, _config: dict[str, Any]) -> dict[str, Any]:
        target_id, target_doc = self.actions.user_or_404(as_text(context.get("user_id")))
        return {"id": target_id, "doc": target_doc}

    def _load_target_user_favorites(self, context: ExecutionContext, _config: dict[str, Any]) -> list[dict[str, Any]]:
        target_user = context.get("target_user") or {}
        target_id = as_text(target_user.get("id"))
        return list(self.actions.repos.favorites.collection.find({"user_id": target_id}).sort("created_at", -1).limit(2000))

    def _build_add_document(self, context: ExecutionContext, _config: dict[str, Any]) -> dict[str, Any]:
        target_spot = context.get("target_spot") or {}
        return {
            "user_id": as_text(context.get("viewer_user_id")) or self.actions.me_id(context.principal),
            "spot_id": serialize_id(target_spot.get("_id")),
            "created_at": datetime.now(UTC),
        }

    def _build_remove_query(self, context: ExecutionContext, _config: dict[str, Any]) -> dict[str, Any]:
        raw_spot_id = as_text(context.get("spot_id"))
        canonical_values = [raw_spot_id]
        if ObjectId.is_valid(raw_spot_id):
            canonical_values.append(serialize_id(ObjectId(raw_spot_id)))
        canonical_values = [value for value in dict.fromkeys([value for value in canonical_values if value])]
        return {
            "user_id": self.actions.me_id(context.principal),
            "spot_id": {"$in": canonical_values},
        }

    def _project_visible_favorite_refs(self, context: ExecutionContext, _config: dict[str, Any]):
        rows = context.get("favorite_rows", []) or []
        viewer_id = as_text(context.get("viewer_user_id")) or self.actions.me_id(context.principal)
        return visible_favorite_refs(self.actions.repos, rows, viewer_id)

    @staticmethod
    def _project_ok(_context: ExecutionContext, _config: dict[str, Any]) -> dict[str, bool]:
        return {"ok": True}
