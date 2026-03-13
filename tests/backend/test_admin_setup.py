from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models.schemas import AuthUserRecord
from core.admin_setup import is_admin_user, ADMIN_DEFAULT_USERNAME


class TestAuthUserRecordAdminField:
    def test_auth_user_record_has_is_admin_field(self):
        user = AuthUserRecord(
            username="testuser",
            email="test@example.com",
            password_hash="hash123",
            display_name="Test User",
            is_admin=True,
        )
        assert user.is_admin is True

    def test_auth_user_record_defaults_to_non_admin(self):
        user = AuthUserRecord(
            username="regularuser",
            email="regular@example.com",
            password_hash="hash123",
            display_name="Regular User",
        )
        assert user.is_admin is False


class TestAdminSetup:
    def test_is_admin_user_returns_true_for_admin(self):
        user_doc = {"username": "admin", "is_admin": True}
        assert is_admin_user(user_doc) is True

    def test_is_admin_user_returns_false_for_regular_user(self):
        user_doc = {"username": "regular", "is_admin": False}
        assert is_admin_user(user_doc) is False

    def test_is_admin_user_returns_false_for_missing_field(self):
        user_doc = {"username": "regular"}
        assert is_admin_user(user_doc) is False

    def test_admin_default_username(self):
        assert ADMIN_DEFAULT_USERNAME == "admin"
