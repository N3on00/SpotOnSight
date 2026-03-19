from __future__ import annotations

from core.text import is_valid_username, normalize_login, normalize_search_text, normalize_text, normalize_username


def test_normalize_text_uses_nfc_for_display_content():
    raw = "Cafe\u0301 🚀  "
    assert normalize_text(raw) == "Caf\u00e9 🚀"


def test_normalize_search_text_folds_accents_for_search():
    assert normalize_search_text("J\u00f6rg 🚀") == "jorg 🚀"
    assert normalize_search_text("Cafe\u0301") == "cafe"


def test_username_normalization_keeps_umlauts_but_rejects_emoji():
    assert normalize_username(" J\u00d6rg ") == "j\u00f6rg"
    assert is_valid_username("j\u00f6rg") is True
    assert is_valid_username("j\u00f6rg🚀") is False


def test_login_normalization_matches_folded_username_lookup():
    assert normalize_login("J\u00d6rg") == "j\u00f6rg"
    assert normalize_search_text(normalize_login("J\u00d6rg")) == "jorg"
