from __future__ import annotations

import os

from pymongo import ASCENDING

from repositories.mongo_repository import MongoRepository


_AUTH_REPOSITORY: MongoRepository | None = None


def auth_db_name() -> str:
    return str(os.getenv("MONGO_AUTH_DB") or "SpotOnSightAuth").strip() or "SpotOnSightAuth"


def _create_repository() -> MongoRepository:
    from models.schemas import AuthUserRecord

    repo = MongoRepository(
        collection_name="users",
        model_type=AuthUserRecord,
        db_name=auth_db_name(),
    )
    try:
        repo.collection.create_index([("username", ASCENDING)], unique=True)
        repo.collection.create_index([("email", ASCENDING)], unique=True)
        repo.collection.create_index([("display_name", ASCENDING)])
    except Exception:
        pass
    return repo


def get_auth_user_repository() -> MongoRepository:
    global _AUTH_REPOSITORY
    if _AUTH_REPOSITORY is None:
        _AUTH_REPOSITORY = _create_repository()
    return _AUTH_REPOSITORY
