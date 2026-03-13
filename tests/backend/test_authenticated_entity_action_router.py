from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from api.crud import AuthenticatedEntityActionRouter  # noqa: E402


class DemoPayload(BaseModel):
    message: str


def _current_user() -> dict[str, str]:
    return {"_id": "user-1"}


def test_authenticated_entity_action_router_reuses_generic_validation_for_path_actions() -> None:
    calls: list[tuple[str, str, str]] = []

    router = AuthenticatedEntityActionRouter(
        model=DemoPayload,
        repository=object(),
        prefix="/share",
        tags=["Demo"],
        auth_dependency=_current_user,
        action_handler=lambda entity_id, payload, current_user: calls.append((entity_id, payload.message, current_user["_id"])) or {"ok": True},
        entity_path_name="spot_id",
        id_parser=lambda entity_id: str(entity_id or "").strip(),
        collection_path="",
    ).build()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    create_response = client.post("/share/spot-1", json={"message": "hi"})
    assert create_response.status_code == 200
    assert create_response.json() == {"ok": True}

    invalid_response = client.post("/share/spot-1", json={})
    assert invalid_response.status_code == 422

    read_response = client.get("/share/spot-1")
    assert read_response.status_code == 405

    assert calls == [("spot-1", "hi", "user-1")]
