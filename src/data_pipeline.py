"""Loads phones.csv and validates it.

Update: phones.csv now arrives with camera_score / performance_score /
battery_score / display_score / value_score already engineered (Member
1/2's real work — accounts for things like chipset quality, not just raw
camera_mp), so this module cleans + validates rather than recomputing
scores from scratch.

Run as a script (`python -m src.data_pipeline`) to (re)generate the
cleaned CSVs other modules read from.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "phones.csv"
CLEANED_PATH = DATA_DIR / "cleaned_phone_data.csv"
SCORES_PATH = DATA_DIR / "normalized_scores.csv"

_RAW_SPEC_COLUMNS = [
    "model_name", "price_inr", "ram_gb", "storage_gb",
    "camera_mp", "battery_mah", "screen_size_inch", "target_segment", "processor",
]
_SCORE_COLUMNS = [
    "camera_score", "performance_score", "battery_score", "display_score", "value_score",
]
# Tier labels used by the 2025-2026 dataset (Member 1's phones.csv)
_VALID_SEGMENTS = {
    "flagship", "flagship (s pen)", "foldable flagship", "foldable (value)",
    "upper mid-range", "mid-range", "budget",
}


def load_and_clean(raw_path: Path = RAW_PATH) -> pd.DataFrame:
    """Loads phones.csv and applies the brief's cleaning checks: drop exact
    duplicates, drop rows missing required fields, validate segment values
    and score ranges, and flag (rather than silently fix) price/segment
    mismatches that look like data errors."""
    df = pd.read_csv(raw_path)

    required = _RAW_SPEC_COLUMNS + _SCORE_COLUMNS
    missing_cols = set(required) - set(df.columns)
    if missing_cols:
        raise ValueError(f"phones.csv is missing required columns: {missing_cols}")

    df = df.dropna(subset=required).drop_duplicates(subset=["model_name"])

    bad_segments = set(df["target_segment"].str.lower()) - _VALID_SEGMENTS
    if bad_segments:
        raise ValueError(f"Unexpected target_segment values (not in {_VALID_SEGMENTS}): {bad_segments}")

    out_of_range = df[(df[_SCORE_COLUMNS] < 0).any(axis=1) | (df[_SCORE_COLUMNS] > 10).any(axis=1)]
    if not out_of_range.empty:
        raise ValueError(
            f"Score columns must be within 0-10; check: {out_of_range['model_name'].tolist()}"
        )

    # Sanity flags matching the brief's example error cases — a budget phone
    # priced above 80k or a flagship-ish phone under 15k would be suspicious.
    suspicious = df[
        ((df["target_segment"] == "budget") & (df["price_inr"] > 80000))
        | ((df["price_inr"] < 15000) & (df["target_segment"] != "budget"))
    ]
    if not suspicious.empty:
        print(f"Warning: {len(suspicious)} row(s) look like they might need a manual price/segment check:")
        print(suspicious[["model_name", "price_inr", "target_segment"]].to_string(index=False))

    return df.reset_index(drop=True)


def run_pipeline(raw_path: Path = RAW_PATH) -> pd.DataFrame:
    """Convenience entry point used by the notebook — clean + validate in
    one call, without requiring the CSVs to have been (re)generated first."""
    return load_and_clean(raw_path)


if __name__ == "__main__":
    cleaned = load_and_clean()
    cleaned.to_csv(CLEANED_PATH, index=False)
    cleaned.to_csv(SCORES_PATH, index=False)  # scores already engineered upstream; same table

    print(f"Wrote {CLEANED_PATH} and {SCORES_PATH} ({len(cleaned)} phones)")
    print(cleaned[["model_name"] + _SCORE_COLUMNS])
