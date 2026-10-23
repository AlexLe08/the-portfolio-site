import sentry_sdk

from app.core.config import settings


def init_sentry() -> bool:
    """
    Report unhandled errors (500s) to Sentry. Off until SENTRY_DSN is set.
    Returns whether it was turned on.

    Call before creating the FastAPI app: the SDK hooks into FastAPI and
    Starlette when it starts, and finds them by itself (no integrations
    list needed). 4xx responses are not reported; they're the API working.

    data_collection turns off what would send secrets or visitors' data to
    a third party. Anything not listed keeps the SDK's default.
    - http_bodies: the default keeps request bodies, so a crash in /contact
      would send the visitor's name, email, and message.
    - stack_frame_variables: the default captures each frame's local
      variables. Starlette's ASGI scope is one of them and holds the raw
      request headers, so this alone would leak X-Admin-Key even with
      header filtering. A Settings object's repr also lists every secret.
    - user_info, cookies: visitor IP addresses and cookie values.
    Request headers are still sent, but the SDK always filters any whose
    name contains "auth" or "key", which covers Authorization and
    X-Admin-Key. tests/test_monitoring.py checks all of this.
    """
    if not settings.sentry_dsn:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        # The deployed commit, so an error can be traced to the change
        # that caused it. None (not "") outside Render.
        release=settings.render_git_commit or None,
        data_collection={
            "http_bodies": [],
            "stack_frame_variables": False,
            "user_info": False,
            "cookies": {"mode": "off"},
        },
    )
    return True
