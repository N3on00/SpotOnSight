from __future__ import annotations

import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel


BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


from api.crud import AuthenticatedCreateRouter  # noqa: E402


class DemoPayload(BaseModel):
    name: str


class DemoPublic(BaseModel):
    owner_id: str
    name: str


def _current_user() -> dict[str, str]:
    return {"_id": "user-1"}


def test_authenticated_create_router_reuses_generic_validation_for_create_only_routes() -> None:
    router = AuthenticatedCreateRouter(
        model=DemoPayload,
        repository=object(),
        prefix="/demo",
        tags=["Demo"],
        auth_dependency=_current_user,
        create_handler=lambda payload, current_user: DemoPublic(owner_id=current_user["_id"], name=payload.name),
        response_model=DemoPublic,
        status_code=201,
        collection_path="",
    ).build()

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    create_response = client.post("/demo", json={"name": "fresh"})
    assert create_response.status_code == 201
    assert create_response.json() == {"owner_id": "user-1", "name": "fresh"}

    invalid_response = client.post("/demo", json={})
    assert invalid_response.status_code == 422

    read_response = client.get("/demo")
    assert read_response.status_code == 405
