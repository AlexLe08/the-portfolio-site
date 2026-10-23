from pydantic import PositiveInt, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    # X-Admin-Key header from curl or /docs. See core/security.py.
    admin_api_key: str = "dev-only-change-me"

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

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
