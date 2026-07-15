"""4 personas + free-text preference extraction (Step 2 / Step 2b of the plan).

Personas map ~1:1 onto the official target_segment categories:
Priya->photography, Arjun->gaming, Neha->business, Ravi->budget.
"""

from __future__ import annotations

import re

from src import llm_client, security

PERSONAS = {
    "priya": {
        "name": "Priya", "avatar": "P", "age": 24,
        "need": "Wedding photographer — camera & battery first",
        "budget_min": 45000, "budget_max": 70000,
        "weights": {"camera": 0.5, "performance": 0.1, "battery": 0.2, "value": 0.2},
    },
    "arjun": {
        "name": "Arjun", "avatar": "A", "age": 21,
        "need": "Engineering student, BGMI player",
        "budget_min": 20000, "budget_max": 35000,
        "weights": {"camera": 0.1, "performance": 0.5, "battery": 0.3, "value": 0.1},
    },
    "neha": {
        "name": "Neha", "avatar": "N", "age": 29,
        "need": "Consultant, travels weekly",
        "budget_min": 55000, "budget_max": 100000,
        "weights": {"camera": 0.2, "performance": 0.2, "battery": 0.4, "value": 0.2},
    },
    "ravi": {
        "name": "Mr. Ravi", "avatar": "R", "age": 48,
        "need": "Small business owner, keeps it simple",
        "budget_min": 8000, "budget_max": 20000,
        "weights": {"camera": 0.1, "performance": 0.1, "battery": 0.3, "value": 0.5},
    },
}

_KEYWORD_BUCKETS = {
    "performance": r"bgmi|pubg|gam(e|ing)|fps|fortnite",
    "camera": r"camera|photo|wedding|shoot|photograph",
    "battery": r"travel|consult|client|business trip|meeting|battery",
    "value": r"simple|whatsapp|upi|affordable|small business|budget|calls",
}

_rate_limiter = security.RateLimiter()


def _extract_rule_based(description: str) -> dict:
    text = description.lower()
    budget_match = re.search(r"(\d{4,6})", text)
    budget = int(budget_match.group(1)) if budget_match else 40000
    budget_min = security.clamp_budget(budget * 0.7)
    budget_max = security.clamp_budget(budget * 1.15)

    weights = {"camera": 0.2, "performance": 0.2, "battery": 0.3, "value": 0.3}
    for dimension, pattern in _KEYWORD_BUCKETS.items():
        if re.search(pattern, text):
            weights = {k: (0.5 if k == dimension else 0.5 / 3) for k in weights}
            break

    return {"weights": weights, "budget_min": budget_min, "budget_max": budget_max}


def call_llm_extract(description: str) -> dict | None:
    """Asks the local model to return weights+budget as JSON. Returns None
    (triggering the rule-based fallback) if Ollama isn't reachable or the
    output isn't valid JSON in the expected shape."""
    if not _rate_limiter.allow():
        return None

    prompt = (
        "You are a Samsung shopping assistant. A customer described themselves as: "
        f'"{description}"\n\n'
        "Return ONLY a JSON object with this exact shape, weights summing to 1.0:\n"
        '{"weights": {"camera": 0.0, "performance": 0.0, "battery": 0.0, "value": 0.0}, '
        '"budget_min": 0, "budget_max": 0}'
    )
    result = llm_client.call_local_llm(prompt, expect_json=True)
    if not result or "weights" not in result:
        return None

    weights = result["weights"]
    if abs(sum(weights.values()) - 1.0) > 0.05:
        return None  # malformed — let the rule-based path handle it

    return {
        "weights": weights,
        "budget_min": security.clamp_budget(result.get("budget_min", 20000)),
        "budget_max": security.clamp_budget(result.get("budget_max", 60000)),
    }


def extract_preferences_from_text(description: str) -> dict:
    return call_llm_extract(description) or _extract_rule_based(description)


def refine_preferences(current_weights: dict, refinement_text: str) -> dict:
    text = refinement_text.lower()
    new_weights = dict(current_weights)
    for dimension, pattern in _KEYWORD_BUCKETS.items():
        if re.search(pattern, text):
            new_weights[dimension] = new_weights.get(dimension, 0.25) + 0.15
    total = sum(new_weights.values())
    return {k: v / total for k, v in new_weights.items()}
