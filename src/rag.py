"""
Grounding layer — step 3 of the RAG flow.

    1. Query      -> personas.extract_preferences_from_text() / a persona
    2. Retrieve   -> recommender.recommend_phone() + rank_results()
    3. Build      -> this module
    4. Generate   -> llm_client.call_llm()

Step 2 already existed; its output was being discarded before step 4, so the
model was asked to praise a phone's features while being told only its name.
This module hands those retrieved rows to the prompt instead.

Everything here is pure string formatting: no LLM call, no I/O. That is what
makes the grounding claim testable — see tests/test_rag.py.
"""

from __future__ import annotations

import pandas as pd

# Facts, straight from data/phones.csv. Kept apart from the scores below
# because a spec is a property of the phone and a score is our opinion of it.
SPEC_FIELDS = [
    "model_name", "release_year", "series", "price_inr", "processor",
    "ram_gb", "storage_gb", "camera_mp", "battery_mah", "screen_size_inch",
    "display_type", "refresh_rate_hz", "charging_w", "os_support_years",
    "target_segment",
]

SCORE_FIELDS = [
    ("camera_score", "Camera"),
    ("performance_score", "Performance"),
    ("battery_score", "Battery"),
    ("display_score", "Display"),
    ("value_score", "Value"),
]

_DIMENSIONS = ["camera", "performance", "battery", "display", "value"]


def _fmt(row: pd.Series, key: str) -> str | None:
    if key not in row or pd.isna(row[key]):
        return None
    v = row[key]
    if key == "price_inr":
        return f"Price: Rs {int(v):,}"
    if key == "model_name":
        return f"Model: {v}"
    if key == "processor":
        return f"Processor: {v}"
    if key == "ram_gb":
        return f"RAM: {int(v)} GB"
    if key == "storage_gb":
        return f"Storage: {int(v)} GB"
    if key == "camera_mp":
        return f"Main camera: {int(v)} MP"
    if key == "battery_mah":
        return f"Battery: {int(v)} mAh"
    if key == "screen_size_inch":
        return f"Screen size: {v} inch"
    if key == "display_type":
        return f"Display panel: {v}"
    if key == "refresh_rate_hz":
        return f"Refresh rate: {int(v)} Hz"
    if key == "charging_w":
        return f"Charging: {int(v)} W"
    if key == "os_support_years":
        return f"OS support: {int(v)} years"
    if key == "release_year":
        return f"Released: {int(v)}"
    if key == "series":
        return f"Series: {v}"
    if key == "target_segment":
        return f"Segment: {v}"
    return f"{key}: {v}"


def build_phone_context(phone_row: pd.Series, include_scores: bool = True) -> str:
    """Format one retrieved phone as a grounding block for the prompt.

    The two blocks are labelled separately on purpose. Given a bare
    "Camera Score: 10.0" and no camera spec, a model will invent a megapixel
    count to justify the number. Naming the scores as our ranking output —
    not as facts about the hardware — lets the prompt forbid quoting them
    and force every claim back onto the specification block.
    """
    specs = [line for key in SPEC_FIELDS if (line := _fmt(phone_row, key))]

    block = (
        "RETRIEVED SPECIFICATIONS (source: data/phones.csv — authoritative)\n"
        + "\n".join(f"- {s}" for s in specs)
    )

    if not include_scores:
        return block

    scores = ", ".join(
        f"{label} {phone_row[col]:.1f}"
        for col, label in SCORE_FIELDS
        if col in phone_row and not pd.isna(phone_row[col])
    )

    return (
        block
        + "\n\nINTERNAL MATCH SCORES (GalaxyMatch's own 0-10 ranking — our opinion, "
        "NOT specifications, and not facts about the phone)\n"
        + f"- {scores}"
    )


def build_user_profile(
    weights: dict,
    budget_min: int | None = None,
    budget_max: int | None = None,
) -> str:
    """Format the query side of the RAG flow: what this shopper cares about."""
    ranked = sorted(
        ((d, weights.get(d, 0.0)) for d in _DIMENSIONS),
        key=lambda kv: kv[1],
        reverse=True,
    )
    lines = [f"- {d.title()}: {w:.0%} of their priority" for d, w in ranked]
    if budget_min is not None and budget_max is not None:
        lines.append(f"- Budget: Rs {budget_min:,} to Rs {budget_max:,}")
    return "USER PROFILE (what this shopper asked for)\n" + "\n".join(lines)
