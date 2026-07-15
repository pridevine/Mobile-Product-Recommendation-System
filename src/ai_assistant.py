"""
Explanation generation (Step 7 of the plan)

Enhanced Version

Features
--------
✔ Local LLM support
✔ Rule-based fallback
✔ Uses persona priorities
✔ Uses phone strengths
✔ Human-friendly explanations
✔ Safe HTML output
"""

from __future__ import annotations

import pandas as pd

from src import llm_client, security


_rate_limiter = security.RateLimiter()


# ---------------------------------------------------------
# RULE-BASED EXPLANATIONS
# ---------------------------------------------------------

def _strongest_feature(phone_row: pd.Series) -> tuple[str, float]:
    features = {
        "camera": phone_row["camera_score"],
        "performance": phone_row["performance_score"],
        "battery": phone_row["battery_score"],
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

    if not _rate_limiter.allow():
        return None

    prompt = f"""
You are Samsung's AI shopping assistant.

Customer priorities:

Camera: {weights['camera']}

Performance: {weights['performance']}

Battery: {weights['battery']}

Value: {weights['value']}

Recommended Phone:

{phone_row['model_name']}

Specifications

Camera Score: {phone_row['camera_score']:.1f}

Performance Score: {phone_row['performance_score']:.1f}

Battery Score: {phone_row['battery_score']:.1f}

Value Score: {phone_row['value_score']:.1f}

Generate ONE friendly sentence (under 35 words).

Explain WHY this phone matches the user's needs.

Do not mention numerical scores.

Do not use bullet points.
"""

    return llm_client.call_local_llm(
        prompt,
        expect_json=False,
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