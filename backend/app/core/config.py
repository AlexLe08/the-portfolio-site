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

    # Simple shared-secret auth for the single-admin write endpoints.
    # See Step 3's routers/projects.py for how this gets used — and the
    # note there on why this is enough auth for a site with one admin.
    admin_api_key: str = "dev-only-change-me"

    environment: str = "development"

    # Comma-separated list, e.g. "https://your-site.vercel.app,https://yourdomain.com"
    # Kept as a single string (not a list) because env vars are always
    # strings -- pydantic-settings would need a custom parser to accept a
    # list directly from an environment variable, which is unnecessary
    # complexity for something this simple to split ourselves.
    allowed_origins: str = "http://localhost:3000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


settings = Settings()
