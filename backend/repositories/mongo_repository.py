from bson import ObjectId
from pymongo import MongoClient
from pydantic import BaseModel
from typing import Any, TypeVar, Type, Optional
import os

T = TypeVar('T', bound=BaseModel)

class MongoRepository:
    """Generic MongoDB repository for CRUD operations"""
    
    def __init__(self, collection_name: str, model_type: Type[T], db_name: str | None = None):
        """Initialize repository with collection and model type"""
        mongo_url = os.getenv("MONGO_URL", "mongodb://localhost:27017")
        server_selection_timeout_ms = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "2000"))
        self.client = MongoClient(mongo_url, serverSelectionTimeoutMS=server_selection_timeout_ms)
        resolved_db = str(db_name or os.getenv("MONGO_DB", "spot_on_sight")).strip() or "spot_on_sight"
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

    def find_one(self, query: dict[str, Any], projection: dict[str, int] | None = None):
        return self.collection.find_one(query, projection)

    def find_many(self, query: dict[str, Any], projection: dict[str, int] | None = None, limit: int = 0):
        cursor = self.collection.find(query, projection)
        if limit and limit > 0:
            cursor = cursor.limit(int(limit))
        return list(cursor)

    def insert_one(self, document: dict[str, Any]) -> str:
        result = self.collection.insert_one(document)
        return str(result.inserted_id)

    def update_fields(self, query: dict[str, Any], fields: dict[str, Any], upsert: bool = False):
        return self.collection.update_one(query, {"$set": fields}, upsert=upsert)

    def delete_many(self, query: dict[str, Any]):
        return self.collection.delete_many(query)

    def count_documents(self, query: dict[str, Any], limit: int = 0) -> int:
        if limit and limit > 0:
            return self.collection.count_documents(query, limit=int(limit))
        return self.collection.count_documents(query)
