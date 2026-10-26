#!/usr/bin/env python3
"""A fake backend for testing how the frontend handles outages, plus a fake
Sentry endpoint for checking what gets reported. Standard library only.

Serves /health, /projects, /projects/<slug>, and /content with fixed data
shaped like the real API. Switch how they behave at any time:

    curl localhost:8765/__mode/500                  # every route returns 500
    curl "localhost:8765/__mode/down?path=/projects" # one route drops the connection
    curl localhost:8765/__mode/ok                   # back to normal (clears per-path modes)

`down` closes the socket without a response, which is what fetch sees when
the backend is unreachable (openapi-fetch throws instead of returning
{ error }).

Sentry: point the frontend at http://public@127.0.0.1:<port>/1 (set
NEXT_PUBLIC_SENTRY_DSN before `next dev`, or before `next build` for a
production build) and each envelope is appended, decoded, to the log file
with its request headers. The Node SDK sends chunked bodies, sometimes
gzipped; both are handled.

Usage: python3 scripts/fake-backend.py [port] [sentry_log]
       (defaults: 8765, .logs/sentry-envelopes.log)
"""

import gzip
import json
import pathlib
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = pathlib.Path(__file__).resolve().parent.parent
LOG = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / ".logs" / "sentry-envelopes.log"

PROJECTS = [
    {
        "slug": "demo-project",
        "title": "Demo project",
        "summary": "A project served by scripts/fake-backend.py.",
        "stack": ["Python", "TypeScript"],
        "case_study_md": "## Overview\n\nFixed case study text from the fake backend.",
        "repo_url": None,
        "created_at": "2026-01-01T00:00:00Z",
    }
]
SUMMARY_FIELDS = ("slug", "title", "summary", "stack")

# path prefix -> mode; "" applies to every route.
modes = {"": "ok"}


def mode_for(path):
    matches = [prefix for prefix in modes if path.startswith(prefix)]
    return modes[max(matches, key=len)]


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self):
        if self.headers.get("Transfer-Encoding", "").lower() == "chunked":
            body = b""
            while size := int(self.rfile.readline().strip(), 16):
                body += self.rfile.read(size)
                self.rfile.readline()
            self.rfile.readline()
        else:
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.headers.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        return body

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.startswith("/__mode/"):
            prefix = parse_qs(url.query).get("path", [""])[0]
            if not prefix:
                modes.clear()  # a global mode replaces per-path ones
            modes[prefix] = url.path.rsplit("/", 1)[1]
            return self._json(200, modes)

        mode = mode_for(url.path)
        if mode == "down":
            self.close_connection = True
            self.connection.close()
            return
        if mode == "500":
            return self._json(500, {"detail": "Internal Server Error"})

        if url.path == "/health":
            return self._json(200, {"status": "ok", "environment": "fake", "commit": None})
        if url.path == "/content":
            return self._json(200, {})
        if url.path == "/projects":
            return self._json(200, [{k: p[k] for k in SUMMARY_FIELDS} for p in PROJECTS])
        if url.path.startswith("/projects/"):
            slug = url.path.removeprefix("/projects/")
            project = next((p for p in PROJECTS if p["slug"] == slug), None)
            if project:
                return self._json(200, project)
        self._json(404, {"detail": "Not Found"})

    def do_POST(self):
        body = self._body()
        if "/envelope/" in self.path:
            LOG.parent.mkdir(parents=True, exist_ok=True)
            with LOG.open("ab") as f:
                f.write(f"POST {self.path} {dict(self.headers)}\n".encode() + body + b"\n----\n")
            return self._json(200, {})
        self._json(404, {"detail": "Not Found"})

    def log_message(self, *args):
        pass


print(f"fake backend on http://127.0.0.1:{PORT}, Sentry envelopes to {LOG}", flush=True)
ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
