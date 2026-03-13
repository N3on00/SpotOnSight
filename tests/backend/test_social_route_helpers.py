from __future__ import annotations

from bson import ObjectId

from api.routes.social import _spot_lookup_query


def test_spot_lookup_query_supports_objectid_and_legacy_string_ids() -> None:
    oid_text = str(ObjectId())
    oid_query = _spot_lookup_query(oid_text)
    assert "$or" in oid_query
    assert {"_id": oid_text} in oid_query["$or"]
    assert any(isinstance(entry.get("_id"), ObjectId) for entry in oid_query["$or"])

    legacy_query = _spot_lookup_query("legacy-spot-1")
    assert legacy_query == {"_id": "legacy-spot-1"}
