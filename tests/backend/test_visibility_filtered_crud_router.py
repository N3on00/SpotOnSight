from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from api.crud import VisibilityFilteredCrudRouter  # noqa: E402


class DemoPayload(BaseModel):
    name: str


class DemoPublic(BaseModel):
    id: str
    owner_id: str
    name: str


def _current_user() -> dict[str, str]:
    return {"_id": "user-1"}


def test_visibility_filtered_crud_router_uses_generic_route_shape_with_user_aware_handlers() -> None:
    calls: list[tuple[str, str, str]] = []

    router = VisibilityFilteredCrudRouter(
        model=DemoPayload,
        repository=object(),
        prefix="/demo",
        tags=["Demo"],
        auth_dependency=_current_user,
        list_handler=lambda current_user: [DemoPublic(id="item-1", owner_id=current_user["_id"], name="visible")],
        create_handler=lambda payload, current_user: DemoPublic(id="created", owner_id=current_user["_id"], name=payload.name),
        update_handler=lambda entity_id, payload, current_user: calls.append(("update", entity_id, current_user["_id"])) or DemoPublic(id=entity_id, owner_id=current_user["_id"], name=payload.name),
        delete_handler=lambda entity_id, current_user: calls.append(("delete", entity_id, current_user["_id"])) or {"ok": True},
        item_response_model=DemoPublic,
        list_response_model=list[DemoPublic],
        include_read=False,
        id_parser=lambda entity_id: str(entity_id or "").strip(),
    ).build()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    list_response = client.get("/demo/")
    assert list_response.status_code == 200
    assert list_response.json() == [{"id": "item-1", "owner_id": "user-1", "name": "visible"}]

    create_response = client.post("/demo/", json={"name": "fresh"})
    assert create_response.status_code == 200
    assert create_response.json() == {"id": "created", "owner_id": "user-1", "name": "fresh"}

    update_response = client.put("/demo/legacy-id", json={"name": "updated"})
    assert update_response.status_code == 200
    assert update_response.json() == {"id": "legacy-id", "owner_id": "user-1", "name": "updated"}

    delete_response = client.delete("/demo/legacy-id")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}

    read_response = client.get("/demo/legacy-id")
    assert read_response.status_code == 405

    assert calls == [("update", "legacy-id", "user-1"), ("delete", "legacy-id", "user-1")]
