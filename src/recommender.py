"""
Weighted-sum recommendation engine (Step 5 of the plan).

Enhanced Version
----------------
Features Added:
1. Weighted Sum Model (WSM)
2. Budget-aware filtering
3. Explainable score breakdown
4. Confidence labels
5. Ranked recommendations
6. Phone comparison
"""

from __future__ import annotations

import pandas as pd

from src.version import ENGINE_VERSION

# ----------------------------------------------------------
# CORE WEIGHTED SUM MODEL
# ----------------------------------------------------------

def calculate_score(phone_row: pd.Series, weights: dict) -> float:
    """
    Calculates the final weighted score of a phone.
    """

    return (
        phone_row["camera_score"] * weights["camera"]
        + phone_row["performance_score"] * weights["performance"]
        + phone_row["battery_score"] * weights["battery"]
        + phone_row["display_score"] * weights["display"]
        + phone_row["value_score"] * weights["value"]
    )


# ----------------------------------------------------------
# EXPLAINABLE AI
# ----------------------------------------------------------

def calculate_score_breakdown(phone_row: pd.Series, weights: dict) -> dict:
    """
    Returns contribution of every feature to the final score.
    """

    return {
        "camera_contribution": round(
            phone_row["camera_score"] * weights["camera"], 2
        ),
        "performance_contribution": round(
            phone_row["performance_score"] * weights["performance"], 2
        ),
        "battery_contribution": round(
            phone_row["battery_score"] * weights["battery"], 2
        ),
        "display_contribution": round(
            phone_row["display_score"] * weights["display"], 2
        ),
        "value_contribution": round(
            phone_row["value_score"] * weights["value"], 2
        ),
    }


# ----------------------------------------------------------
# CONFIDENCE LABELS
# ----------------------------------------------------------

def confidence_label(match_pct: int) -> str:
    """
    Converts percentage into a user-friendly label.
    """

    if match_pct >= 95:
        return "⭐⭐⭐⭐⭐ Perfect Match"

    if match_pct >= 90:
        return "⭐⭐⭐⭐ Excellent Match"

    if match_pct >= 80:
        return "⭐⭐⭐ Great Match"

    if match_pct >= 70:
        return "⭐⭐ Good Match"

    return "⭐ Fair Match"


# ----------------------------------------------------------
# RECOMMENDATION ENGINE
# ----------------------------------------------------------

def recommend_phone(
    weights: dict,
    budget_min: float,
    budget_max: float,
    df: pd.DataFrame,
) -> pd.DataFrame:

    scored = df.copy()

    scored["match_score"] = scored.apply(
        lambda row: calculate_score(row, weights),
        axis=1,
    )

    # Add explainability columns
    breakdowns = scored.apply(
        lambda row: pd.Series(
            calculate_score_breakdown(row, weights)
        ),
        axis=1,
    )

    scored = pd.concat([scored, breakdowns], axis=1)

    # Budget filtering
    in_budget = scored[
        (scored["price_inr"] >= budget_min)
        & (scored["price_inr"] <= budget_max)
    ]

    # If fewer than 3 phones satisfy budget,
    # recommend from complete catalogue.
    result = in_budget if len(in_budget) >= 3 else scored

    return result.sort_values(
        by="match_score",
        ascending=False,
    )


# ----------------------------------------------------------
# TOP RESULTS
# ----------------------------------------------------------

def rank_results(
    scored_df: pd.DataFrame,
    top_n: int = 3,
) -> pd.DataFrame:

    top = scored_df.head(top_n).copy()

    max_possible = 10.0

    top["match_pct"] = (
        top["match_score"] / max_possible * 100
    ).round().clip(upper=99).astype(int)

    top["confidence"] = top["match_pct"].apply(
        confidence_label
    )

    return top


# ----------------------------------------------------------
# SUMMARY FOR ALL PERSONAS
# ----------------------------------------------------------

def recommend_all_personas(
    personas: dict,
    df: pd.DataFrame,
) -> dict:

    summary = {}

    for persona_id, persona in personas.items():

        scored = recommend_phone(
            persona["weights"],
            persona["budget_min"],
            persona["budget_max"],
            df,
        )

        top1 = rank_results(scored, top_n=1)

        summary[persona_id] = top1.iloc[0]

    return summary


# ----------------------------------------------------------
# PHONE COMPARISON
# ----------------------------------------------------------

def compare_phones(
    model_names: list,
    df: pd.DataFrame,
) -> pd.DataFrame:

    cols = [
        "model_name",
        "price_inr",
        "camera_score",
        "performance_score",
        "battery_score",
        "display_score",
        "value_score",
    ]

    return (
        df[df["model_name"].isin(model_names)][cols]
        .set_index("model_name")
    )


# ----------------------------------------------------------
# OPTIONAL HELPER
# ----------------------------------------------------------

def get_best_feature(phone_row: pd.Series) -> str:
    """
    Returns the strongest feature of a phone.
    Useful for future UI enhancements.
    """

    features = {
        "Camera": phone_row["camera_score"],
        "Performance": phone_row["performance_score"],
        "Battery": phone_row["battery_score"],
        "Display": phone_row["display_score"],
        "Value": phone_row["value_score"],
    }

    return max(features, key=features.get)
