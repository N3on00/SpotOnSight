from __future__ import annotations

from datetime import UTC, datetime, timedelta
import os
from typing import Any

from jose import jwt


class TokenService:
    def __init__(self) -> None:
        self.secret_key = str(os.getenv("JWT_SECRET") or "change-this-secret").strip() or "change-this-secret"
        self.algorithm = str(os.getenv("JWT_ALGORITHM") or "HS256").strip() or "HS256"
        self.expire_minutes = int(os.getenv("JWT_EXPIRE_MINUTES") or "60")

    def issue_access_token(self, *, user_id: str, username: str) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": str(user_id),
            "username": str(username or ""),
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=self.expire_minutes)).timestamp()),
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)

    def decode_access_token(self, token: str) -> dict[str, Any]:
        return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])


token_service = TokenService()
