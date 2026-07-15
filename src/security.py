"""Secure-engineering helpers shared across the app (Step 7b of the plan).

No user auth here — that was explicitly descoped. This covers: secret
loading, input sanitization before HTML rendering, bounded numeric
validation, and rate limiting around the local/cloud LLM calls.
"""

from __future__ import annotations

import html
import os
import time

from dotenv import load_dotenv

load_dotenv()  # reads .env if present; safe no-op if it doesn't exist

BUDGET_MIN = 1000
BUDGET_MAX = 300000


def get_secret(name: str) -> str | None:
    """Reads an optional cloud-provider API key from the environment/.env.
    Never hardcode a key — this is the only place that should read one."""
    return os.environ.get(name)


def sanitize_for_html(text: str) -> str:
    """Escapes user-supplied text before it's interpolated into any HTML
    string that gets rendered in notebook output — prevents HTML/script
    injection via the free-text/refine boxes."""
    return html.escape(text)


def clamp_budget(value: float) -> int:
    """Bounds a budget number parsed out of free text — no eval/exec on
    user input anywhere, just a strict numeric clamp."""
    return int(max(BUDGET_MIN, min(BUDGET_MAX, value)))


class RateLimiter:
    """Simple min-interval guard so rapid slider changes or repeated clicks
    can't queue up overlapping LLM calls and stall the UI."""

    def __init__(self, min_interval_seconds: float = 0.5):
        self._min_interval = min_interval_seconds
        self._last_call = 0.0

    def allow(self) -> bool:
        now = time.monotonic()
        if now - self._last_call < self._min_interval:
            return False
        self._last_call = now
        return True
