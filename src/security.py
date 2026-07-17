"""Secure-engineering helpers shared across the app (Step 7b of the plan).

No user auth here — that was explicitly descoped. This covers: secret
loading, input sanitization before HTML rendering, bounded numeric
validation, and rate limiting around the local/cloud LLM calls.
"""

from __future__ import annotations

import html
import os
import re
import time

from dotenv import load_dotenv

load_dotenv()  # reads .env if present; safe no-op if it doesn't exist

BUDGET_MIN = 1000
BUDGET_MAX = 300000
SAFE_REDIRECT = (
    "I can help you choose a Samsung Galaxy phone. Tell me your budget and "
    "what matters most, such as camera, gaming, battery, display, or value."
)
_ABUSE_RE = re.compile(
    r"\b(?:fuck(?:ing|ed)?|shit(?:ty)?|bitch|asshole|bastard|dumbass|idiot|moron|stupid|"
    r"dumb|loser|pathetic|jerk|trash|garbage|useless|worthless|suck(?:s|ed)?)\b"
    r"|\bshut\s+up\b|\bscrew\s+you\b",
    re.IGNORECASE,
)
_THREAT_RE = re.compile(
    r"\b(?:kill|hurt|attack|bomb|shoot)\s+(?:you|yourself|me|someone|people)\b",
    re.IGNORECASE,
)
# Racial, ethnic, homophobic, and ableist slurs -- checked separately from
# _ABUSE_RE and always a strike, mirrored identically in api/safety.js and
# web/engine.js so no input path lets a slur through unscreened.
_SLUR_RE = re.compile(
    r"\b(?:n[i1]gg(?:er|a|ers|as)?|f[a4]gg?[o0]t|ch[i1]nk|sp[i1]c|wetback|g[o0]{2}k|"
    r"k[i1]ke|c[o0]{2}n|r[e3]t[a4]rd(?:ed)?|tr[a4]nny|p[a4]ki)\b",
    re.IGNORECASE,
)
# Mirrors api/safety.js's COMPETITOR_RE. Without this, "recommend me an
# iPhone" matches none of personas.py's keyword buckets, falls into the
# default weights, and _extract_rule_based quietly returns a Samsung phone —
# reading as a random answer to an off-topic request rather than a refusal.
_COMPETITOR_RE = re.compile(
    r"\b(?:iphone|apple|pixel|google pixel|oneplus|xiaomi|redmi|oppo|vivo|realme)\b",
    re.IGNORECASE,
)


def get_secret(name: str) -> str | None:
    """Reads an optional cloud-provider API key from the environment/.env.
    Never hardcode a key — this is the only place that should read one."""
    return os.environ.get(name)


def sanitize_for_html(text: str) -> str:
    """Escapes user-supplied text before it's interpolated into any HTML
    string that gets rendered in notebook output — prevents HTML/script
    injection via the free-text/refine boxes."""
    return html.escape(text)


def redact_pii(text: str) -> str:
    """Remove common contact details before user text reaches an LLM."""
    text = re.sub(
        r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}",
        "[email removed]",
        str(text),
        flags=re.IGNORECASE,
    )
    return re.sub(r"(?:\+?\d[\d .()\-]{7,}\d)", "[phone removed]", text)


def extract_budget_inr(text: str) -> int | None:
    """Parse explicit Indian budget forms without asking an LLM to guess."""
    value = str(text or "").replace(",", "")
    lakh = re.search(r"(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b", value, re.IGNORECASE)
    if lakh:
        return round(float(lakh.group(1)) * 100000)
    thousand = re.search(r"(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand)\b", value, re.IGNORECASE)
    if thousand:
        return round(float(thousand.group(1)) * 1000)
    currency = re.search(r"(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)", value, re.IGNORECASE)
    if currency:
        return round(float(currency.group(1)))
    contextual = re.search(
        r"(?:budget|spend|price|under|upto|up to|maximum|max|around|within)\s*"
        r"(?:is|of|:)?\s*(?:₹|rs\.?|inr)?\s*(\d{4,7})\b",
        value,
        re.IGNORECASE,
    )
    return int(contextual.group(1)) if contextual else None


def screen_user_text(text: str) -> dict[str, str | bool | None]:
    """Apply length, abuse, and basic privacy controls to free text.

    The returned text is the only version that should be sent to a model.
    Matched abusive text is never echoed back to the user or logged.

    `reason` says WHY a request was blocked, because callers use it to decide
    whether this counts as a strike toward the abuse escalation (warn once,
    then restrict repeat offenders) -- competitor-phone and length blocks are
    not abuse and must never count toward that.
    """
    raw = str(text or "").strip()
    if len(raw) > 1000:
        return {
            "blocked": True,
            "text": "",
            "message": "Please keep your description under 1,000 characters so I can process it safely.",
            "reason": "length",
        }
    if _ABUSE_RE.search(raw) or _SLUR_RE.search(raw) or _THREAT_RE.search(raw):
        return {"blocked": True, "text": "", "message": SAFE_REDIRECT, "reason": "abuse"}
    if _COMPETITOR_RE.search(raw):
        return {"blocked": True, "text": "", "message": SAFE_REDIRECT, "reason": "competitor"}
    return {"blocked": False, "text": redact_pii(raw), "message": "", "reason": None}


def validate_grounded_output(text: str, phone_row=None, min_facts: int = 2) -> bool:
    """Reject unsafe or ungrounded customer-facing model prose."""
    clean = str(text or "").strip()
    if not clean or len(clean) > 700:
        return False
    if re.search(
        r"\b(?:iphone|apple|pixel|oneplus|xiaomi|redmi|oppo|vivo|realme)\b|"
        r"match\s+score|\bscore\b|out\s+of\s+10|/\s*10",
        clean,
        flags=re.IGNORECASE,
    ):
        return False
    if re.search(r"https?://|[\[\]{}<>]", clean):
        return False
    if re.search(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", clean, flags=re.IGNORECASE):
        return False
    if phone_row is None:
        return True

    def value(name: str):
        try:
            return phone_row[name]
        except (KeyError, TypeError):
            return None

    facts = [
        value("processor"),
        value("display_type"),
        value("ram_gb") is not None and f"{value('ram_gb')} GB",
        value("storage_gb") is not None and f"{value('storage_gb')} GB",
        value("camera_mp") is not None and f"{value('camera_mp')} MP",
        value("battery_mah") is not None and f"{value('battery_mah')} mAh",
        value("screen_size_inch") is not None and f"{value('screen_size_inch')} inch",
        value("refresh_rate_hz") is not None and f"{value('refresh_rate_hz')} Hz",
        value("charging_w") is not None and f"{value('charging_w')} W",
        value("os_support_years") is not None and f"{value('os_support_years')} years",
    ]
    return sum(bool(fact) and str(fact).lower() in clean.lower() for fact in facts) >= min_facts


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
