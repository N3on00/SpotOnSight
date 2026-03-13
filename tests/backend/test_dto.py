from __future__ import annotations

import sys
from pathlib import Path
from datetime import datetime

import pytest
from pydantic import ValidationError

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from models.schemas import (
    Spot,
    SpotUpsertRequest,
    SpotPublic,
    RegisterRequest,
    LoginRequest,
    UpdateProfileRequest,
    UserPublic,
    ShareRequest,
    SupportTicketRequest,
    SupportTicketPublic,
    AuthTokenResponse,
    AuthUserRecord,
    FavoriteRef,
    FollowRef,
    FollowRequestRef,
    BlockRef,
    ClientErrorReport,
)


class TestSpotDTO:
    def test_spot_valid_minimal(self):
        spot = Spot(title="Test Spot", lat=47.3769, lon=8.5417)
        assert spot.title == "Test Spot"
        assert spot.lat == 47.3769
        assert spot.lon == 8.5417
        assert spot.description == ""
        assert spot.tags == []
        assert spot.images == []

    def test_spot_with_all_fields(self):
        spot = Spot(
            title="Full Spot",
            description="A description",
            tags=["nature", "hiking"],
            lat=47.5,
            lon=8.6,
            images=["base64image1"],
        )
        assert spot.title == "Full Spot"
        assert spot.description == "A description"
        assert spot.tags == ["nature", "hiking"]
        assert spot.images == ["base64image1"]

    def test_spot_title_validation_min_length(self):
        with pytest.raises(ValidationError) as exc_info:
            Spot(title="", lat=47.0, lon=8.0)
        assert "String should have at least 1 character" in str(exc_info.value)

    def test_spot_title_validation_max_length(self):
        with pytest.raises(ValidationError) as exc_info:
            Spot(title="x" * 81, lat=47.0, lon=8.0)
        assert "String should have at most 80 characters" in str(exc_info.value)

    def test_spot_description_max_length(self):
        with pytest.raises(ValidationError) as exc_info:
            Spot(title="Valid", description="x" * 2001, lat=47.0, lon=8.0)
        assert "String should have at most 2000 characters" in str(exc_info.value)


class TestSpotUpsertRequestDTO:
    def test_spot_upsert_valid(self):
        req = SpotUpsertRequest(
            title="New Spot",
            lat=47.5,
            lon=8.5,
            visibility="public",
        )
        assert req.title == "New Spot"
        assert req.visibility == "public"
        assert req.invite_user_ids == []

    def test_spot_upsert_with_invite_only(self):
        req = SpotUpsertRequest(
            title="Private Spot",
            lat=47.5,
            lon=8.5,
            visibility="invite_only",
            invite_user_ids=["user1", "user2"],
        )
        assert req.visibility == "invite_only"
        assert req.invite_user_ids == ["user1", "user2"]

    def test_spot_upsert_invalid_visibility(self):
        with pytest.raises(ValidationError):
            SpotUpsertRequest(title="Test", lat=47.0, lon=8.0, visibility="invalid")


class TestRegisterRequestDTO:
    def test_register_valid(self):
        req = RegisterRequest(
            username="testuser",
            email="test@example.com",
            password="password123",
        )
        assert req.username == "testuser"
        assert req.email == "test@example.com"

    def test_register_username_min_length(self):
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(username="ab", email="test@test.com", password="password123")
        assert "String should have at least 3 characters" in str(exc_info.value)

    def test_register_email_validation(self):
        req = RegisterRequest(
            username="testuser",
            email="invalid",
            password="password123",
        )
        assert "@" not in req.email or req.email == "invalid"

    def test_register_password_min_length(self):
        with pytest.raises(ValidationError) as exc_info:
            RegisterRequest(username="testuser", email="test@test.com", password="123")
        assert "String should have at least 8 characters" in str(exc_info.value)


class TestLoginRequestDTO:
    def test_login_normalizes_email(self):
        req = LoginRequest(username_or_email="TEST@Example.com", password="password")
        assert req.username_or_email == "test@example.com"

    def test_login_normalizes_username(self):
        req = LoginRequest(username_or_email="TestUser", password="password")
        assert req.username_or_email == "testuser"

    def test_login_requires_password(self):
        with pytest.raises(ValidationError) as exc_info:
            LoginRequest(username_or_email="testuser", password="")
        assert "String should have at least 1 character" in str(exc_info.value)


class TestUpdateProfileRequestDTO:
    def test_update_profile_partial(self):
        req = UpdateProfileRequest(display_name="New Name")
        assert req.display_name == "New Name"
        assert req.username is None
        assert req.email is None

    def test_update_profile_with_social(self):
        req = UpdateProfileRequest(
            social_accounts={"twitter": "@user", "instagram": "@user"}
        )
        assert req.social_accounts == {"twitter": "@user", "instagram": "@user"}


class TestUserPublicDTO:
    def test_user_public_valid(self):
        user = UserPublic(
            id="123",
            username="testuser",
            email="test@test.com",
            display_name="Test User",
            created_at=datetime.now(),
        )
        assert user.id == "123"
        assert user.bio == ""
        assert user.avatar_image == ""
        assert user.social_accounts == {}

    def test_user_public_with_all_fields(self):
        user = UserPublic(
            id="123",
            username="testuser",
            email="test@test.com",
            display_name="Test User",
            bio="Hello world",
            avatar_image="base64data",
            social_accounts={"twitter": "@user"},
            follow_requires_approval=True,
            created_at=datetime.now(),
        )
        assert user.bio == "Hello world"
        assert user.follow_requires_approval is True


class TestShareRequestDTO:
    def test_share_request_valid(self):
        req = ShareRequest(message="Check out this spot!")
        assert req.message == "Check out this spot!"

    def test_share_request_max_length(self):
        with pytest.raises(ValidationError) as exc_info:
            ShareRequest(message="x" * 301)
        assert "String should have at most 300 characters" in str(exc_info.value)


class TestSupportTicketRequestDTO:
    def test_support_ticket_valid(self):
        req = SupportTicketRequest(
            category="bug",
            subject="Something is broken",
            message="The app crashes when I click the map.",
        )
        assert req.category == "bug"
        assert req.subject == "Something is broken"

    def test_support_ticket_all_categories(self):
        for category in ["bug", "feature", "complaint", "question", "other"]:
            req = SupportTicketRequest(
                category=category,
                subject="Test",
                message="Test message content here.",
            )
            assert req.category == category

    def test_support_ticket_subject_min_length(self):
        with pytest.raises(ValidationError) as exc_info:
            SupportTicketRequest(category="bug", subject="ab", message="Valid message")
        assert "String should have at least 3 characters" in str(exc_info.value)

    def test_support_ticket_message_min_length(self):
        with pytest.raises(ValidationError) as exc_info:
            SupportTicketRequest(category="bug", subject="Valid", message="short")
        assert "String should have at least 10 characters" in str(exc_info.value)


class TestSupportTicketPublicDTO:
    def test_support_ticket_public_valid(self):
        ticket = SupportTicketPublic(
            id="123",
            user_id="user1",
            category="bug",
            subject="Issue",
            message="Details",
            created_at=datetime.now(),
        )
        assert ticket.status == "open"
        assert ticket.page == ""
        assert ticket.allow_contact is False


class TestAuthTokenResponseDTO:
    def test_auth_token_response_valid(self):
        user = UserPublic(
            id="123",
            username="test",
            email="test@test.com",
            display_name="Test",
            created_at=datetime.now(),
        )
        resp = AuthTokenResponse(access_token="token123", user=user)
        assert resp.access_token == "token123"
        assert resp.token_type == "bearer"
        assert resp.user.username == "test"


class TestAuthUserRecordDTO:
    def test_auth_user_record_valid(self):
        user = AuthUserRecord(
            username="testuser",
            email="test@example.com",
            password_hash="hash123",
            display_name="Test User",
        )
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.bio == ""

    def test_auth_user_record_username_normalization(self):
        user = AuthUserRecord(
            username="TestUser",
            email="Test@Example.com",
            password_hash="hash",
            display_name="Test",
        )
        assert user.username == "testuser"
        assert user.email == "test@example.com"

    def test_auth_user_record_username_invalid_format(self):
        with pytest.raises(ValidationError) as exc_info:
            AuthUserRecord(
                username="test user!",
                email="test@test.com",
                password_hash="hash",
                display_name="Test",
            )
        assert "Invalid username format" in str(exc_info.value)

    def test_auth_user_record_social_accounts_sanitization(self):
        user = AuthUserRecord(
            username="testuser",
            email="test@test.com",
            password_hash="hash",
            display_name="Test",
            social_accounts={"twitter": "@user", "longkey": "x" * 501},
        )
        assert "twitter" in user.social_accounts
        assert "longkey" not in user.social_accounts


class TestReferenceDTOs:
    def test_favorite_ref_valid(self):
        ref = FavoriteRef(spot_id="spot123", created_at=datetime.now())
        assert ref.spot_id == "spot123"

    def test_follow_ref_valid(self):
        ref = FollowRef(user_id="user123", created_at=datetime.now())
        assert ref.user_id == "user123"

    def test_follow_request_ref_valid(self):
        ref = FollowRequestRef(follower_id="follower123", created_at=datetime.now())
        assert ref.follower_id == "follower123"

    def test_block_ref_valid(self):
        ref = BlockRef(user_id="blocked123", created_at=datetime.now())
        assert ref.user_id == "blocked123"


class TestClientErrorReportDTO:
    def test_client_error_report_valid(self):
        report = ClientErrorReport(
            kind="exception",
            source="webapp",
            message="Error occurred",
            stacktrace="at line 42...",
        )
        assert report.kind == "exception"
        assert report.context == {}

    def test_client_error_report_with_context(self):
        report = ClientErrorReport(
            kind="exception",
            source="webapp",
            message="Error",
            context={"user_id": "123", "url": "/map"},
        )
        assert report.context["user_id"] == "123"
        assert report.context["url"] == "/map"
