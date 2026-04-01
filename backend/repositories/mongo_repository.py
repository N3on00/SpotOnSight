import os
from typing import Any, Optional, Type, TypeVar

from bson import ObjectId
from pydantic import BaseModel
from pymongo import MongoClient

T = TypeVar('T', bound=BaseModel)


def mongo_url() -> str:
    return str(os.getenv("MONGO_URL") or "mongodb://localhost:27017").strip() or "mongodb://localhost:27017"


def mongo_server_selection_timeout_ms() -> int:
    return int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS") or "2000")


def default_db_name() -> str:
    return str(os.getenv("MONGO_DB") or "spot_on_sight").strip() or "spot_on_sight"


def create_mongo_client() -> MongoClient:
    return MongoClient(
        mongo_url(),
        serverSelectionTimeoutMS=mongo_server_selection_timeout_ms(),
    )


def ping_mongo() -> bool:
    client = create_mongo_client()
    try:
        client.admin.command("ping")
        return True
    finally:
        client.close()


class MongoRepository:
    """Generic MongoDB repository for CRUD operations"""
    
    def __init__(self, collection_name: str, model_type: Type[T], db_name: str | None = None):
        """Initialize repository with collection and model type"""
        self.client = create_mongo_client()
        resolved_db = str(db_name or default_db_name()).strip() or "spot_on_sight"
        self.db = self.client[resolved_db]
        self.collection = self.db[collection_name]
        self.model_type = model_type

    @staticmethod
    def _to_object_id(entity_id: ObjectId | str) -> ObjectId:
        if isinstance(entity_id, ObjectId):
            return entity_id
        text = str(entity_id or "").strip()
        if not ObjectId.is_valid(text):
            raise ValueError("Invalid ObjectId")
        return ObjectId(text)

    def create(self, entity: T) -> str:
        """Insert new entity and return its ID"""
        result = self.collection.insert_one(entity.model_dump(exclude_none=True))
        return str(result.inserted_id)

    def read(self, entity_id: ObjectId | str) -> Optional[T]:
        """Find single entity by ID"""
        oid = self._to_object_id(entity_id)
        return self.collection.find_one({"_id": oid})

    def read_all(self):
        """Retrieve all entities in collection"""
        return self.collection.find()

    def update(self, entity_id: ObjectId | str, entity: T):
        """Update existing entity"""
        oid = self._to_object_id(entity_id)
        return self.collection.update_one(
            {"_id": oid},
            {"$set": entity.model_dump(exclude_none=True)}
        )

    def delete(self, entity_id: ObjectId | str):
        """Remove entity by ID"""
        oid = self._to_object_id(entity_id)
        return self.collection.delete_one({"_id": oid})

    def delete_one_by_query(self, query: dict[str, Any]):
        return self.collection.delete_one(query)

    def find_one(self, query: dict[str, Any], projection: dict[str, int] | None = None):
        return self.collection.find_one(query, projection)

    def find_many(self, query: dict[str, Any], projection: dict[str, int] | None = None, limit: int = 0):
        cursor = self.collection.find(query, projection)
        if limit and limit > 0:
            cursor = cursor.limit(int(limit))
        return list(cursor)

    def find_many_sorted(
        self,
        query: dict[str, Any],
        *,
        sort_field: str,
        sort_direction: int,
        projection: dict[str, int] | None = None,
        limit: int = 0,
    ):
        cursor = self.collection.find(query, projection).sort(sort_field, sort_direction)
        if limit and limit > 0:
            cursor = cursor.limit(int(limit))
        return list(cursor)

    def find_all_sorted(
        self,
        *,
        sort_field: str,
        sort_direction: int,
        projection: dict[str, int] | None = None,
        limit: int = 0,
    ):
        return self.find_many_sorted({}, sort_field=sort_field, sort_direction=sort_direction, projection=projection, limit=limit)

    def insert_one(self, document: dict[str, Any]) -> str:
        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    def update_fields(self, query: dict[str, Any], fields: dict[str, Any], upsert: bool = False):
        return self.collection.update_one(query, {"$set": fields}, upsert=upsert)

    def set_on_insert(self, query: dict[str, Any], fields: dict[str, Any]):
        return self.collection.update_one(query, {"$setOnInsert": fields}, upsert=True)

    def delete_many(self, query: dict[str, Any]):
        return self.collection.delete_many(query)

    def create_index(self, keys, **kwargs):
        return self.collection.create_index(keys, **kwargs)

    def count_documents(self, query: dict[str, Any], limit: int = 0) -> int:
        if limit and limit > 0:
            return self.collection.count_documents(query, limit=int(limit))
        return self.collection.count_documents(query)
