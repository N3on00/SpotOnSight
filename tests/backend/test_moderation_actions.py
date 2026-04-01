from __future__ import annotations

import sys
from datetime import UTC, datetime
from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException
import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import core.social.actions as social_actions_module
import core.social.moderation_actions as moderation_actions_module
from core.social.actions import SocialActions
from models.schemas import ModerationReportReviewRequest


class FakeCursor:
    def __init__(self, docs: list[dict]):
        self.docs = list(docs)

    def __iter__(self):
        return iter(self.docs)

    def sort(self, field: str, direction: int):
        reverse = int(direction) < 0
        return FakeCursor(sorted(self.docs, key=lambda item: item.get(field) or datetime.min.replace(tzinfo=UTC), reverse=reverse))

    def limit(self, limit: int):
        return FakeCursor(self.docs[:limit])


class FakeCollection:
    def __init__(self, docs: list[dict]):
        self.docs = docs

    def find(self, query: dict | None = None):
        return FakeCursor([doc for doc in self.docs if _matches(doc, query or {})])

    def find_one(self, query: dict):
        for doc in self.docs:
            if _matches(doc, query):
                return doc
        return None

    def insert_one(self, document: dict):
        self.docs.append(document)
        return type("InsertResult", (), {"inserted_id": document.get("_id")})()

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        existing = self.find_one(query)
        if existing:
            existing.update(update.get("$set", {}))
            return type("UpdateResult", (), {"modified_count": 1})()
        if upsert:
            doc = {**query, **update.get("$set", {})}
            self.docs.append(doc)
            return type("UpdateResult", (), {"modified_count": 1})()
        return type("UpdateResult", (), {"modified_count": 0})()

    def delete_one(self, query: dict):
        for index, doc in enumerate(self.docs):
            if _matches(doc, query):
                self.docs.pop(index)
                return type("DeleteResult", (), {"deleted_count": 1})()
        return type("DeleteResult", (), {"deleted_count": 0})()

    def count_documents(self, query: dict, limit: int = 0):
        matches = [doc for doc in self.docs if _matches(doc, query)]
        return len(matches[:limit or None])


class FakeRepo:
    def __init__(self, docs: list[dict] | None = None):
        self.docs = docs or []
        self.collection = FakeCollection(self.docs)

    def find_one(self, query: dict, projection: dict | None = None):
        return self.collection.find_one(query)

    def find_many(self, query: dict, projection: dict | None = None, limit: int = 0):
        matches = [doc for doc in self.docs if _matches(doc, query)]
        return matches[:limit or None]

    def find_many_sorted(self, query: dict, *, sort_field: str, sort_direction: int, projection: dict | None = None, limit: int = 0):
        reverse = int(sort_direction) < 0
        matches = [doc for doc in self.docs if _matches(doc, query)]
        matches.sort(key=lambda item: item.get(sort_field) or datetime.min.replace(tzinfo=UTC), reverse=reverse)
        return matches[:limit or None]

    def find_all_sorted(self, *, sort_field: str, sort_direction: int, projection: dict | None = None, limit: int = 0):
        return self.find_many_sorted({}, sort_field=sort_field, sort_direction=sort_direction, projection=projection, limit=limit)

    def insert_one(self, document: dict):
        if "_id" not in document:
            document["_id"] = ObjectId()
        self.docs.append(document)
        return str(document["_id"])

    def update_fields(self, query: dict, fields: dict, upsert: bool = False):
        existing = self.find_one(query)
        if existing:
            existing.update(fields)
            return
        if upsert:
            self.docs.append({**query, **fields})

    def set_on_insert(self, query: dict, fields: dict):
        existing = self.find_one(query)
        if existing:
            return
        self.docs.append({**query, **fields})

    def delete_one_by_query(self, query: dict):
        return self.collection.delete_one(query)

    def delete_many(self, query: dict):
        self.docs[:] = [doc for doc in self.docs if not _matches(doc, query)]

    def create_index(self, keys, **kwargs):
        return None

    def count_documents(self, query: dict, limit: int = 0):
        return self.collection.count_documents(query, limit=limit)


class FakeRepos:
    def __init__(self, *, users: list[dict], spots: list[dict], reports: list[dict]):
        self.users = FakeRepo(users)
        self.spots = FakeRepo(spots)
        self.moderation_reports = FakeRepo(reports)
        self.moderation_strikes = FakeRepo([])
        self.moderation_notifications = FakeRepo([])
        self.comments = FakeRepo([])
        self.meetup_comments = FakeRepo([])
        self.favorites = FakeRepo([])
        self.follows = FakeRepo([])
        self.follow_requests = FakeRepo([])
        self.blocks = FakeRepo([])
        self.shares = FakeRepo([])
        self.support_tickets = FakeRepo([])
        self.meetups = FakeRepo([])
        self.meetup_invites = FakeRepo([])


def _matches(doc: dict, query: dict) -> bool:
    if not query:
        return True
    for key, value in query.items():
        if key == "$or":
            return any(_matches(doc, item) for item in value)
        if isinstance(value, dict) and "$gte" in value:
            if doc.get(key) < value["$gte"]:
                return False
            continue
        if doc.get(key) != value:
            return False
    return True


@pytest.fixture(autouse=True)
def _disable_index_initialization(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(social_actions_module, "ensure_indexes", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(moderation_actions_module, "ensure_indexes", lambda *_args, **_kwargs: None)


def test_admin_can_see_hidden_spots_but_regular_users_cannot():
    now = datetime.now(UTC)
    user_id = ObjectId()
    admin_id = ObjectId()
    repos = FakeRepos(
        users=[
            {"_id": user_id, "username": "user", "email": "user@example.com", "display_name": "User", "created_at": now},
            {"_id": admin_id, "username": "admin", "email": "admin@example.com", "display_name": "Admin", "is_admin": True, "created_at": now},
        ],
        spots=[
            {"_id": ObjectId(), "owner_id": str(user_id), "title": "Visible", "visibility": "public", "moderation_status": "visible", "created_at": now},
            {"_id": ObjectId(), "owner_id": str(user_id), "title": "Hidden", "visibility": "public", "moderation_status": "hidden", "created_at": now},
        ],
        reports=[],
    )
    actions = SocialActions(repos)

    regular = actions.list_visible_spots({"_id": user_id})
    admin = actions.list_visible_spots({"_id": admin_id, "is_admin": True})

    assert [spot.title for spot in regular] == ["Visible"]
    assert [spot.title for spot in admin] == ["Visible", "Hidden"]


def test_upheld_report_hides_content_creates_strike_and_timeout():
    now = datetime.now(UTC)
    offender_id = ObjectId()
    admin_id = ObjectId()
    spot_id = ObjectId()
    report_id = ObjectId()
    repos = FakeRepos(
        users=[
            {
                "_id": offender_id,
                "username": "offender",
                "email": "offender@example.com",
                "display_name": "Offender",
                "account_status": "active",
                "created_at": now,
            },
            {
                "_id": admin_id,
                "username": "admin",
                "email": "admin@example.com",
                "display_name": "Admin",
                "is_admin": True,
                "created_at": now,
            },
        ],
        spots=[
            {
                "_id": spot_id,
                "owner_id": str(offender_id),
                "title": "Spam spot",
                "visibility": "public",
                "moderation_status": "visible",
                "created_at": now,
            },
        ],
        reports=[
            {
                "_id": report_id,
                "reporter_user_id": str(ObjectId()),
                "target_type": "spot",
                "target_id": str(spot_id),
                "target_owner_user_id": str(offender_id),
                "reason": "spam",
                "details": "Repeated spam upload.",
                "status": "open",
                "created_at": now,
            },
        ],
    )
    actions = SocialActions(repos)

    reviewed = actions.review_moderation_report(
        str(report_id),
        ModerationReportReviewRequest(status="upheld", action="hide_content", severity="high", admin_notes="Confirmed spam."),
        {"_id": admin_id, "is_admin": True},
    )

    assert reviewed.status == "upheld"
    assert repos.spots.docs[0]["moderation_status"] == "hidden"
    assert len(repos.moderation_strikes.docs) == 1
    assert repos.users.docs[0]["posting_timeout_until"] is not None
    assert repos.users.docs[0]["account_status"] == "watch"
    assert repos.moderation_notifications.docs[0]["user_id"] == str(offender_id)

    with pytest.raises(HTTPException):
        actions.ensure_can_post({"_id": offender_id, "posting_timeout_until": repos.users.docs[0]["posting_timeout_until"]})
