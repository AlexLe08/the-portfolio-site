import re
from typing import Self
from urllib.parse import urlsplit

from argon2 import extract_parameters
from argon2.exceptions import InvalidHashError
from pydantic import PositiveInt, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_ADMIN_API_KEY = "dev-only-change-me"


class Settings(BaseSettings):
    """
    All environment-driven config lives here, and nowhere else.
    Reading os.environ directly anywhere else in the app is a code smell —
    it means config validation only happens at the moment of use, instead
    of at startup, so a missing/misspelled env var fails loudly and early
    instead of causing a confusing 500 later.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Defaults to a local SQLite file so `uvicorn app.main:app` just works
    # with zero setup. Production sets DATABASE_URL to a Postgres URL.
    database_url: str = "sqlite:///./dev.db"

    # Webhook receives contact form info from database
    discord_webhook_url: str = ""

    # Email notification for new contact messages, sent through Resend's HTTP
    # API (Render's free tier blocks outbound SMTP). Both the key and the
    # recipient must be set for email to be sent; otherwise it is skipped.
    # Without a verified Resend domain, the sender must stay
    # onboarding@resend.dev and the recipient must be the address on your
    # Resend account.
    resend_api_key: str = ""
    notify_email_to: str = ""
    email_from: str = "Portfolio Contact <onboarding@resend.dev>"

    # Per-visitor limit on POST /contact. Visitors are told apart by the value
    # of this request header when it is set (e.g. CF-Connecting-IP on Render),
    # otherwise by the socket's peer address. Behind a proxy that address is
    # the proxy's, so production must set this or all visitors share one
    # limit. Only name a header the platform overwrites: a header a caller can
    # forge lets them dodge the limit. See docs/render-runbook.md.
    # The rate-limit numbers here and below must be positive: a limit of 0
    # would crash the limiter on every request, and a window of 0 would
    # quietly turn it off, so either fails at startup instead.
    client_ip_header: str = ""
    contact_rate_limit: PositiveInt = 5
    contact_rate_window_seconds: PositiveInt = 3600

    # Shared-secret auth for the single-admin write endpoints, sent as the
    # X-Admin-Key header from curl or /docs. See core/security.py. Production
    # refuses the default and an empty key (see admin_api_key_set_in_production).
    admin_api_key: str = DEFAULT_ADMIN_API_KEY

    # Browser login for the admin UI (POST /auth/login). The password is
    # stored only as an argon2 hash (make one with `python hash_password.py`),
    # and a successful login returns a JWT signed with jwt_secret. Login is
    # turned off until both are set; the admin key keeps working either way.
    admin_password_hash: str = ""
    jwt_secret: str = ""
    admin_session_minutes: int = 480
    # One shared limit on all login attempts, not per visitor: logins arrive
    # through the frontend's server, so every attempt has the same address.
    login_rate_limit: PositiveInt = 5
    login_rate_window_seconds: PositiveInt = 900

    environment: str = "development"

    # Error reporting (see core/monitoring.py). Off when empty. A DSN only
    # lets someone send events to the project, not read them, but keep it
    # out of git anyway so nobody can fill the free quota with junk.
    sentry_dsn: str = ""

    # Media uploads go to Cloudinary (see docs/roadmap.md). Copy the "API
    # environment variable" from the Cloudinary Console's API Keys page:
    # cloudinary://<api_key>:<api_secret>@<cloud_name>. Uploads are off when
    # empty. SecretStr keeps the API secret out of reprs, logs, and
    # validation errors; read it with .get_secret_value().
    cloudinary_url: SecretStr = SecretStr("")

    # Set by Render on every deploy (it's not in render.yaml). /health
    # reports it so the smoke-test workflow can wait until the commit it
    # tests is the one actually serving. Empty when running locally.
    render_git_commit: str = ""

    # Comma-separated list, e.g. "https://your-site.vercel.app,https://yourdomain.com"
    # Kept as a single string (not a list) because env vars are always
    # strings -- pydantic-settings would need a custom parser to accept a
    # list directly from an environment variable, which is unnecessary
    # complexity for something this simple to split ourselves.
    allowed_origins: str = "http://localhost:3000"

    @field_validator("jwt_secret")
    @classmethod
    def jwt_secret_long_enough(cls, value: str) -> str:
        # HS256 keys shorter than its 32-byte output are guessable faster
        # than the hash itself (RFC 7518 section 3.2). Fail at startup
        # rather than sign tokens with a weak key.
        if value and len(value.encode()) < 32:
            raise ValueError("JWT_SECRET must be at least 32 bytes (try `openssl rand -hex 32`)")
        return value

    @field_validator("cloudinary_url")
    @classmethod
    def cloudinary_url_well_formed(cls, value: SecretStr) -> SecretStr:
        # A mangled paste (e.g. "CLOUDINARY_URL=" pasted twice) would
        # otherwise only show up as a failed upload much later.
        url = value.get_secret_value()
        if url and not re.fullmatch(r"cloudinary://[^:@\s]+:[^@\s]+@[^@\s/]+", url):
            raise ValueError(
                "CLOUDINARY_URL must look like cloudinary://<api_key>:<api_secret>@<cloud_name>"
            )
        return value

    @field_validator("admin_password_hash")
    @classmethod
    def admin_password_hash_is_argon2(cls, value: str) -> str:
        # A hash pasted with its quotes, or with its `$` segments eaten by a
        # shell, would otherwise only show up as a 500 at login.
        if value:
            try:
                extract_parameters(value)
            except InvalidHashError:
                raise ValueError(
                    "ADMIN_PASSWORD_HASH must be an argon2 hash starting with $argon2 "
                    "(output of hash_password.py, without quotes on Render)"
                ) from None
        return value

    @field_validator("allowed_origins")
    @classmethod
    def allowed_origins_are_bare_origins(cls, value: str) -> str:
        # Browsers send Origin as scheme://host[:port] and CORS compares it
        # exactly, so a trailing slash or path never matches and the contact
        # form fails with a CORS error instead of a startup error.
        for origin in (entry.strip() for entry in value.split(",")):
            if not origin:
                continue
            parts = urlsplit(origin)
            if parts.scheme not in ("http", "https") or not parts.hostname:
                raise ValueError(f"ALLOWED_ORIGINS entry {origin!r} must be http(s)://host[:port]")
            if parts.path or parts.query or parts.fragment or "@" in parts.netloc:
                raise ValueError(
                    f"ALLOWED_ORIGINS entry {origin!r} must be just scheme://host[:port], "
                    "with no trailing slash or path"
                )
        return value

    @model_validator(mode="after")
    def admin_api_key_set_in_production(self) -> Self:
        # Runs after every field is parsed, because it needs two of them.
        # The default key is in the public repo, so it must never guard prod.
        if self.environment == "production" and self.admin_api_key in ("", DEFAULT_ADMIN_API_KEY):
            raise ValueError("ADMIN_API_KEY must be set to a real secret when ENVIRONMENT=production")
        return self

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
