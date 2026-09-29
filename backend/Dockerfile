FROM python:3.12-slim

WORKDIR /app

# Copy dependency manifest first, install, THEN copy the rest of the code.
# This ordering matters for build speed: Docker caches each layer, and
# only rebuilds a layer (and everything after it) when its inputs change.
# Since pyproject.toml changes far less often than application code, this
# means most rebuilds skip the (slow) dependency install entirely.
COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY . .

EXPOSE 8000
# alembic upgrade head runs first, every single container start -- this
# is what stands in for Render's preDeployCommand, which is paid-plan-only
# (see render.yaml). It's safe to run repeatedly, including on every
# free-tier sleep/wake cycle: alembic checks the database's recorded
# migration version and no-ops if there's nothing new to apply. If a
# migration genuinely fails, `&&` stops the chain before uvicorn starts,
# the container never becomes healthy, and Render's own health-check-gated
# rollout keeps the previous (working) version serving traffic instead of
# replacing it with a broken one -- so most of preDeployCommand's real
# safety property survives even without the dedicated feature.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
