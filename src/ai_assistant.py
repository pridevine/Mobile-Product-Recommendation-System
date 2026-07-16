"""
Explanation generation (Step 7 of the plan)

Enhanced Version

Features
--------
✔ Gemini AI support
✔ Rule-based fallback
✔ Uses persona priorities
✔ Uses phone strengths
✔ Human-friendly explanations
✔ Safe HTML output
"""

from __future__ import annotations

import pandas as pd

from google.genai import types

from src import llm_client, rag, security
from src.prompts import (
    EXPLANATION_PROMPT,
    BADGE_PROMPT,
    COMPARISON_PROMPT,
    SUMMARY_PROMPT,
    SYSTEM_INSTRUCTION,
)

# The always-on rules ride on every call rather than being restated in each
# template. seed keeps the notebook's A/B comparison reproducible for a marker
# re-running it.
GROUNDED_CFG = types.GenerateContentConfig(
    system_instruction=SYSTEM_INSTRUCTION,
    # Gemini 3 models think before answering, and those reasoning tokens count
    # against max_output_tokens. At 400 the model spent the budget thinking and
    # returned a sentence cut off mid-clause. The prompt already caps length at
    # 60 words; this is only a runaway guard, so keep it well clear.
    max_output_tokens=2048,
    seed=7,
)

# Guards user-initiated bursts (Find / Refine), not the per-card render loop:
# results render three cards back to back, so a per-call limiter let only the
# first card reach Gemini and silently templated the other two.
_rate_limiter = security.RateLimiter()


# ---------------------------------------------------------
# RULE-BASED EXPLANATIONS
# ---------------------------------------------------------

def _strongest_feature(phone_row: pd.Series) -> tuple[str, float]:
    features = {
        "camera": phone_row["camera_score"],
        "performance": phone_row["performance_score"],
        "battery": phone_row["battery_score"],
        "display": phone_row["display_score"],
        "value": phone_row["value_score"],
    }

    feature = max(features, key=features.get)

    return feature, features[feature]


def _generate_template(weights: dict, phone_row: pd.Series) -> str:

    dominant_priority = max(weights, key=weights.get)

    strongest_feature, feature_score = _strongest_feature(phone_row)

    model = phone_row["model_name"]

    # Ideal case
    if dominant_priority == strongest_feature:

        templates = {
            "camera":
                f"{model} is an excellent choice because its outstanding camera quality perfectly matches your photography priorities.",

            "performance":
                f"{model} delivers powerful performance that makes gaming and multitasking smooth and responsive.",

            "battery":
                f"{model} offers impressive battery life, making it ideal for long workdays and travel.",

            "display":
                f"{model} has a standout display that's great for photos, video, and long reading sessions.",

            "value":
                f"{model} provides excellent value for money while delivering balanced overall performance.",
        }

        return templates[dominant_priority]

    # Mixed strengths

    return (
        f"{model} provides a balanced combination of "
        f"{strongest_feature} performance while still aligning well "
        f"with your personal preferences."
    )


# ---------------------------------------------------------
# LLM EXPLANATION
# ---------------------------------------------------------

def generate_explanation_llm(
    weights: dict,
    phone_row: pd.Series,
) -> str | None:

    # RAG step 3: hand the retrieved row's real specifications to the prompt.
    # recommend_phone() already selected this row (step 2) — until now its
    # specs were dropped here and only the model name survived.
    prompt = EXPLANATION_PROMPT.format(
        profile=rag.build_user_profile(weights),
        phone_context=rag.build_phone_context(phone_row),
    )

    return llm_client.call_llm(
        prompt,
        expect_json=False,
        config=GROUNDED_CFG,
    )


# ---------------------------------------------------------
# PUBLIC FUNCTION
# ---------------------------------------------------------

def generate_explanation(
    weights: dict,
    phone_row: pd.Series,
) -> str:

    explanation = generate_explanation_llm(
        weights,
        phone_row,
    )

    if not explanation:

        explanation = _generate_template(
            weights,
            phone_row,
        )

    return security.sanitize_for_html(explanation)




def generate_badge_reason(phone_row, badge):

    prompt = BADGE_PROMPT.format(
        phone_context=rag.build_phone_context(phone_row),
    )

    reason = llm_client.call_llm(
        prompt,
        expect_json=False,
        config=GROUNDED_CFG,
    )

    if reason:
        return reason

    fallback = {
        "🏆 Best Camera":
            "Outstanding camera capabilities make this phone ideal for photography.",

        "🎮 Gaming Beast":
            "High performance delivers a smooth gaming and multitasking experience.",

        "🔋 Battery Champion":
            "Long-lasting battery makes it suitable for heavy daily use.",

        "✨ Best Display":
            "A vivid, smooth display that stands out for video and everyday browsing.",

        "💰 Best Value":
            "Excellent balance between price and overall performance.",
    }

    return fallback.get(
        badge,
        "A well-balanced Samsung smartphone."
    )

def compare_phones_ai(phone1, phone2):
    """
    Generates an AI comparison between two phones.
    Falls back to a rule-based comparison if Gemini
    is unavailable.
    """

    prompt = COMPARISON_PROMPT.format(
        phone1_context=rag.build_phone_context(phone1),
        phone2_context=rag.build_phone_context(phone2),
    )

    comparison = llm_client.call_llm(
        prompt,
        expect_json=False,
        config=GROUNDED_CFG,
    )

    if comparison:
        return security.sanitize_for_html(comparison)

    # ---------- Rule-based fallback ----------

    winner = []

    for feature in [
        "camera_score",
        "performance_score",
        "battery_score",
        "value_score",
    ]:

        if phone1[feature] > phone2[feature]:
            winner.append(
                f"{phone1['model_name']} has better {feature.replace('_score','')}."
            )

        elif phone2[feature] > phone1[feature]:
            winner.append(
                f"{phone2['model_name']} has better {feature.replace('_score','')}."
            )

    return " ".join(winner)

def generate_recommendation_summary(weights, top_phones):
    """
    Generates an AI summary for the top recommended phones.
    Falls back to a rule-based summary if Gemini is unavailable.
    """

    prompt = SUMMARY_PROMPT.format(
        profile=rag.build_user_profile(weights),
        phones_context="\n\n".join(
            rag.build_phone_context(p, include_scores=False)
            for p in top_phones[:3]
        ),
    )

    summary = llm_client.call_llm(
        prompt,
        expect_json=False,
        config=GROUNDED_CFG,
    )

    if summary:
        return security.sanitize_for_html(summary)

    return (
        f"Based on your preferences, "
        f"{top_phones[0]['model_name']} is the strongest recommendation. "
        f"{top_phones[1]['model_name']} is an excellent alternative, while "
        f"{top_phones[2]['model_name']} offers another balanced Samsung option."
    )



    