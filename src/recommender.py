"""Weighted-sum recommendation engine (Step 5 of the plan).

Transparent by design: every phone's match score is a plain weighted sum
of its four normalized scores, auditable by hand — see the worked example
in the presentation.
"""

from __future__ import annotations

import pandas as pd


def calculate_score(phone_row: pd.Series, weights: dict) -> float:
    return (
        phone_row["camera_score"] * weights["camera"]
        + phone_row["performance_score"] * weights["performance"]
        + phone_row["battery_score"] * weights["battery"]
        + phone_row["display_score"] * weights["display"]
        + phone_row["value_score"] * weights["value"]
    )


def recommend_phone(weights: dict, budget_min: float, budget_max: float, df: pd.DataFrame) -> pd.DataFrame:
    scored = df.copy()
    scored["match_score"] = scored.apply(lambda row: calculate_score(row, weights), axis=1)

    in_budget = scored[(scored["price_inr"] >= budget_min) & (scored["price_inr"] <= budget_max)]
    # Widen instead of hard-failing if too few phones fall inside budget.
    result = in_budget if len(in_budget) >= 3 else scored
    return result.sort_values("match_score", ascending=False)


def rank_results(scored_df: pd.DataFrame, top_n: int = 3) -> pd.DataFrame:
    top = scored_df.head(top_n).copy()
    max_possible = 10.0  # each sub-score is 0-10, weights sum to 1
    top["match_pct"] = (top["match_score"] / max_possible * 100).round().clip(upper=99).astype(int)
    return top


def recommend_all_personas(personas: dict, df: pd.DataFrame) -> dict:
    summary = {}
    for persona_id, persona in personas.items():
        scored = recommend_phone(persona["weights"], persona["budget_min"], persona["budget_max"], df)
        top1 = rank_results(scored, top_n=1)
        summary[persona_id] = top1.iloc[0]
    return summary


def compare_phones(model_names: list, df: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "model_name", "price_inr", "camera_score", "performance_score",
        "battery_score", "display_score", "value_score",
    ]
    return df[df["model_name"].isin(model_names)][cols].set_index("model_name")
