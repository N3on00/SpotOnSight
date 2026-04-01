from __future__ import annotations

from typing import Any

from bson import ObjectId
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

from .token_service import token_service


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_auth_repository(request: Request):
    return request.app.state.auth_repository


def _find_user_by_id(repository, user_id: str) -> dict[str, Any] | None:
    text = str(user_id or "").strip()
    if not ObjectId.is_valid(text):
        return None
    return repository.find_one({"_id": ObjectId(text)})


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
) -> dict[str, Any]:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = token_service.decode_access_token(token)
    except JWTError as exc:
        raise credentials_error from exc

    user_id = str(payload.get("sub") or "").strip()
    if not user_id:
        raise credentials_error

    user_doc = _find_user_by_id(get_auth_repository(request), user_id)
    if not user_doc:
        raise credentials_error
    if str(user_doc.get("account_status") or "active").strip().lower() == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been banned",
        )

    return user_doc
