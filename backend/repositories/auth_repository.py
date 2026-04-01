from __future__ import annotations

import os

from pymongo import ASCENDING

from core.text import normalize_email, normalize_search_text, normalize_text, normalize_username
from repositories.mongo_repository import MongoRepository

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
        for user in repo.find_many({}, {"_id": 1, "username": 1, "email": 1, "display_name": 1}):
            username = normalize_username(user.get("username"))
            email = normalize_email(user.get("email"))
            display_name = normalize_text(user.get("display_name") or username)
            updates = {
                "username": username,
                "username_key": normalize_search_text(username),
                "username_search": normalize_search_text(username),
                "email": email,
                "email_key": normalize_email(email),
                "display_name": display_name,
                "display_name_search": normalize_search_text(display_name),
            }
            repo.update_fields({"_id": user["_id"]}, updates)

        repo.create_index([("username", ASCENDING)], unique=True)
        repo.create_index([("email", ASCENDING)], unique=True)
        repo.create_index([("display_name", ASCENDING)])
        repo.create_index([("username_key", ASCENDING)], unique=True, sparse=True)
        repo.create_index([("email_key", ASCENDING)], unique=True, sparse=True)
        repo.create_index([("username_search", ASCENDING)])
        repo.create_index([("display_name_search", ASCENDING)])
    except Exception:
        pass
    return repo


def get_auth_user_repository() -> MongoRepository:
    return _create_repository()
