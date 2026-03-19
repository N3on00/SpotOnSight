from __future__ import annotations

import unicodedata
from typing import Any


_USERNAME_PUNCTUATION = {".", "_", "-"}


def _as_str(value: Any) -> str:
    return str(value or "")


def normalize_text(value: Any) -> str:
    return unicodedata.normalize("NFC", _as_str(value)).strip()


def normalize_email(value: Any) -> str:
    return normalize_text(value).lower()


def normalize_username(value: Any) -> str:
    return normalize_text(value).lower()


def normalize_login(value: Any) -> str:
    text = normalize_text(value)
    if "@" in text:
        return normalize_email(text)
    return normalize_username(text)


def normalize_search_text(value: Any) -> str:
    text = normalize_text(value)
    if not text:
        return ""

    folded = unicodedata.normalize("NFKD", text.casefold())
    without_marks = "".join(ch for ch in folded if not unicodedata.combining(ch))
    return " ".join(without_marks.split())


def is_valid_username(value: Any) -> bool:
    text = normalize_username(value)
    if len(text) < 3 or len(text) > 40:
        return False

    for ch in text:
        if ch in _USERNAME_PUNCTUATION:
            continue
        if ch.isalnum():
            continue
        return False
    return True
