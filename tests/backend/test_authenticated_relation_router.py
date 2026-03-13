from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from api.crud import AuthenticatedRelationRouter  # noqa: E402


class DemoRef(BaseModel):
    spot_id: str


def _current_user() -> dict[str, str]:
    return {"_id": "user-1"}


def test_authenticated_relation_router_reuses_generic_auth_for_relation_endpoints() -> None:
    calls: list[tuple[str, str, str]] = []

    router = AuthenticatedRelationRouter(
        repository=object(),
        prefix="/favorites",
        tags=["Demo"],
        auth_dependency=_current_user,
        add_handler=lambda spot_id, current_user: calls.append(("add", spot_id, current_user["_id"])) or {"ok": True},
        remove_handler=lambda spot_id, current_user: calls.append(("remove", spot_id, current_user["_id"])) or {"ok": True},
        list_handler=lambda current_user: [DemoRef(spot_id=current_user["_id"])],
        list_response_model=list[DemoRef],
        item_path_name="spot_id",
        id_parser=lambda spot_id: str(spot_id or "").strip(),
        collection_path="",
    ).build()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    list_response = client.get("/favorites")
    assert list_response.status_code == 200
    assert list_response.json() == [{"spot_id": "user-1"}]

    add_response = client.post("/favorites/spot-1")
    assert add_response.status_code == 200
    assert add_response.json() == {"ok": True}

    remove_response = client.delete("/favorites/spot-1")
    assert remove_response.status_code == 200
    assert remove_response.json() == {"ok": True}

    read_response = client.get("/favorites/spot-1")
    assert read_response.status_code == 405

    assert calls == [("add", "spot-1", "user-1"), ("remove", "spot-1", "user-1")]


def test_authenticated_relation_router_can_skip_list_route() -> None:
    router = AuthenticatedRelationRouter(
        repository=object(),
        prefix="/block",
        tags=["Demo"],
        auth_dependency=_current_user,
        add_handler=lambda user_id, current_user: {"ok": True, "user_id": user_id, "viewer": current_user["_id"]},
        remove_handler=lambda user_id, current_user: {"ok": True, "user_id": user_id, "viewer": current_user["_id"]},
        list_handler=lambda current_user: [DemoRef(spot_id=current_user["_id"])],
        item_path_name="user_id",
        id_parser=lambda user_id: str(user_id or "").strip(),
        include_list=False,
    ).build()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    add_response = client.post("/block/user-2")
    assert add_response.status_code == 200

    list_response = client.get("/block")
    assert list_response.status_code == 404
