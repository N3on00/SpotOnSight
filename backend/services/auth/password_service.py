from __future__ import annotations

from passlib.context import CryptContext


_PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")


class PasswordService:
    @staticmethod
    def hash_password(password: str) -> str:
        return _PWD_CONTEXT.hash(str(password or ""))

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return _PWD_CONTEXT.verify(str(plain_password or ""), str(hashed_password or ""))


password_service = PasswordService()
