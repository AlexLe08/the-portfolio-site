from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.monitoring import init_sentry
from app.routers import admin, auth, character_sheet, contact, content, media, projects

init_sentry()

app = FastAPI(title="Portfolio API", version="0.1.0")

# Only browser calls need this, and ContactForm's POST /contact is the only
# one: pages and Server Actions call the API from the frontend's server.
# Named origins rather than "*", so other sites can't post on a visitor's
# behalf.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
    # Cross-origin JavaScript can read only "safelisted" headers otherwise,
    # and ContactForm reads Retry-After on a 429.
    expose_headers=["Retry-After"],
)

app.include_router(projects.router)
app.include_router(contact.router)
app.include_router(content.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(media.router)
app.include_router(character_sheet.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "environment": settings.environment,
        "commit": settings.render_git_commit or None,
    }
