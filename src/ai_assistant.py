"""Explanation generation (Step 7 of the plan) — local LLM first, falls
back to a rule-based template if Ollama isn't reachable."""

from __future__ import annotations

import pandas as pd

from src import llm_client, security

_TEMPLATES = {
    "camera": "{name}'s camera score leads the shortlist while staying within budget.",
    "performance": "{name} keeps up with demanding use and won't slow down mid-task.",
    "battery": "{name} offers strong all-day battery life for your routine.",
    "display": "{name}'s display is the standout here — great for photos, video, or long reading sessions.",
    "value": "{name} gives the best overall spec-for-price balance in range.",
}

_rate_limiter = security.RateLimiter()


def _generate_template(weights: dict, phone_row: pd.Series) -> str:
    dominant = max(weights, key=weights.get)
    return _TEMPLATES[dominant].format(name=phone_row["model_name"])


def generate_explanation_llm(weights: dict, phone_row: pd.Series) -> str | None:
    if not _rate_limiter.allow():
        return None

    prompt = (
        "You are a Samsung shopping assistant. Explain in under 40 words, "
        "friendly tone, why this phone suits the customer's priorities.\n"
        f"Priorities (0-1 weights): {weights}\n"
        f"Phone: {phone_row['model_name']}, camera={phone_row['camera_score']:.1f}, "
        f"performance={phone_row['performance_score']:.1f}, "
        f"battery={phone_row['battery_score']:.1f}, display={phone_row['display_score']:.1f}, "
        f"value={phone_row['value_score']:.1f}\n"
        "Return ONLY the sentence, no preamble."
    )
    return llm_client.call_local_llm(prompt, expect_json=False)


def generate_explanation(weights: dict, phone_row: pd.Series) -> str:
    text = generate_explanation_llm(weights, phone_row) or _generate_template(weights, phone_row)
    return security.sanitize_for_html(text)
