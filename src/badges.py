"""Badge assignment (Step 6 of the plan) — tags the catalogue-wide leader
in each score dimension, independent of any one persona's ranking."""

from __future__ import annotations

import pandas as pd

_BADGE_META = {
    "camera_score": (
        "camera",
        "🏆 Best Camera"
    ),

    "performance_score": (
        "bolt",
        "🎮 Gaming Beast"
    ),

    "battery_score": (
        "battery",
        "🔋 Battery Champion"
    ),

    "display_score": (
        "display",
        "✨ Best Display"
    ),

    "value_score": (
        "balance",
        "💰 Best Value"
    ),
}


def assign_badges(df: pd.DataFrame) -> dict:
    badges: dict = {name: [] for name in df["model_name"]}
    for score_col, (icon_name, label) in _BADGE_META.items():
        top_model = df.loc[df[score_col].idxmax(), "model_name"]
        badges[top_model].append((icon_name, label))
    return badges
