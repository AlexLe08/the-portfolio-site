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
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
