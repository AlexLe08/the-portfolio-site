import pytest
from argon2 import PasswordHasher
from pydantic import ValidationError

from app.core.config import DEFAULT_ADMIN_API_KEY, Settings

PASSWORD_HASH = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash("password")


@pytest.mark.parametrize(
    "origins",
    [
        "https://the-portfolio-site-flax.vercel.app",
        "http://localhost:3000",
        "https://a.example.com, https://b.example.com:8443",
        # A trailing comma leaves an empty entry, which is skipped.
        "https://a.example.com,",
    ],
)
def test_bare_origins_are_accepted(origins):
    assert Settings(allowed_origins=origins).allowed_origins == origins


@pytest.mark.parametrize(
    "origins, message",
    [
        # The browser's Origin header never ends in a slash, so this one
        # would never match and CORS would block the contact form.
        ("https://a.example.com/", "no trailing slash"),
        ("https://a.example.com/contact", "no trailing slash"),
        ("https://a.example.com?x=1", "no trailing slash"),
        ("https://user@a.example.com", "no trailing slash"),
        ("http://localhost:3000, https://a.example.com/", "no trailing slash"),
        ("a.example.com", "must be http"),
        ("ftp://a.example.com", "must be http"),
        ("https://", "must be http"),
    ],
)
def test_origin_with_more_than_scheme_and_host_fails_at_startup(origins, message):
    with pytest.raises(ValidationError, match=message):
        Settings(allowed_origins=origins)


def test_argon2_password_hash_is_accepted():
    assert Settings(admin_password_hash=PASSWORD_HASH).admin_password_hash == PASSWORD_HASH


def test_password_hash_may_be_empty():
    assert Settings(admin_password_hash="").admin_password_hash == ""


@pytest.mark.parametrize(
    "value",
    [
        # Pasted with the quotes a local .env needs.
        f"'{PASSWORD_HASH}'",
        # An unquoted `$argon2id$v=19$m=...` in a shell expands each `$name`
        # to nothing.
        "=19=65536,t=3,p=4$c2FsdA$aGFzaA",
        "$argon2id$garbage",
        "not-a-hash",
    ],
)
def test_malformed_password_hash_fails_at_startup(value):
    with pytest.raises(ValidationError, match="must be an argon2 hash"):
        Settings(admin_password_hash=value)


@pytest.mark.parametrize("key", [DEFAULT_ADMIN_API_KEY, ""])
def test_production_refuses_default_or_empty_admin_key(key):
    with pytest.raises(ValidationError, match="ADMIN_API_KEY must be set"):
        Settings(environment="production", admin_api_key=key)


def test_production_accepts_a_real_admin_key():
    assert Settings(environment="production", admin_api_key="generated-by-render").admin_api_key


def test_development_allows_the_default_admin_key():
    settings = Settings(environment="development", admin_api_key=DEFAULT_ADMIN_API_KEY)

    assert settings.admin_api_key == DEFAULT_ADMIN_API_KEY
