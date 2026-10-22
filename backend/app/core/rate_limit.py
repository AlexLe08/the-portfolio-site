import threading
import time
from collections import deque

from fastapi import HTTPException


class SlidingWindowLimiter:
    """Allow at most `limit` hits per key within the last `window` seconds.

    State lives in this process's memory: fine for a single instance (Render's
    free tier), but it resets on restart and isn't shared between instances.
    Moving to several instances means moving this to Redis or the database.

    Keys can come from a client-controlled header, so memory is bounded:
    expired keys are pruned, and past `max_keys` the oldest key is dropped.
    """

    def __init__(self, limit: int, window: float, max_keys: int = 10_000):
        self.limit = limit
        self.window = window
        self.max_keys = max_keys
        # key -> times of allowed hits, oldest first. Insertion order doubles
        # as "oldest key first" for eviction.
        self._hits: dict[str, deque[float]] = {}
        # FastAPI runs sync route handlers in a thread pool.
        self._lock = threading.Lock()

    def check(self, key: str, now: float | None = None) -> float:
        """Record a hit for `key`. Returns 0 if allowed, otherwise the seconds
        until it would be. Rejected hits aren't recorded, so retrying early
        doesn't extend the wait.
        """
        now = time.monotonic() if now is None else now
        cutoff = now - self.window
        with self._lock:
            hits = self._hits.get(key)
            if hits is None:
                self._make_room(cutoff)
                hits = self._hits[key] = deque()
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                return hits[0] + self.window - now
            hits.append(now)
            return 0

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()

    def _make_room(self, cutoff: float) -> None:
        if len(self._hits) < self.max_keys:
            return
        self._hits = {k: h for k, h in self._hits.items() if h and h[-1] > cutoff}
        if len(self._hits) >= self.max_keys:
            del self._hits[next(iter(self._hits))]


def enforce_rate_limit(limiter: SlidingWindowLimiter, key: str, detail: str) -> None:
    """Record a hit for `key`, or raise a 429 whose Retry-After says when to
    try again (rounded up, so retrying right on time isn't still early)."""
    retry_after = limiter.check(key)
    if retry_after:
        raise HTTPException(
            status_code=429,
            detail=detail,
            headers={"Retry-After": str(int(retry_after) + 1)},
        )
