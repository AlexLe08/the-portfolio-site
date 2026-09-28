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
# Shell form (not exec-array form) is required here so $PORT actually
# expands -- the array form ["uvicorn", ...] passes the literal string
# "${PORT:-8000}" to uvicorn with no shell to interpret it. Render sets
# $PORT dynamically per-service (commonly 10000, not 8000); locally, with
# no $PORT set, this falls back to 8000 -- the same port docker-compose
# and our local `uvicorn --reload` commands already expect.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
