from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import contact, projects

app = FastAPI(title="Portfolio API", version="0.1.0")

# The frontend (Next.js, on a different origin/port) needs explicit
# permission to call this API from a browser. In production this should
# be your real domain, not "*" — an open CORS policy on a write-capable
# API is a real vulnerability, not just a lint warning.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"] if settings.environment == "development" else [],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(projects.router)
app.include_router(contact.router)


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}
