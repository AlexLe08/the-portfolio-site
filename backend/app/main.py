from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import contact, projects

app = FastAPI(title="Portfolio API", version="0.1.0")

# The frontend (Next.js, on a different origin) needs explicit permission
# to call this API from a browser. allowed_origins_list comes from the
# ALLOWED_ORIGINS env var -- localhost in dev, your real Vercel/production
# domain in prod. An open ("*") policy on a write-capable API would let
# any website's JavaScript submit to /projects or /contact on a visitor's
# behalf; this keeps that door shut to everything except domains we name.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(contact.router)


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}
