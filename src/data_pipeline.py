"""Loads phones.csv and engineers the four 0-10 comparison scores.

Per the official brief: raw specs aren't directly comparable, so every
phone is converted into camera_score / performance_score / battery_score /
value_score, all min-max scaled to 0-10.

Run as a script (`python -m src.data_pipeline`) to (re)generate the CSVs
that recommender.py reads from.
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from sklearn.preprocessing import MinMaxScaler

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "phones.csv"
CLEANED_PATH = DATA_DIR / "cleaned_phone_data.csv"
SCORES_PATH = DATA_DIR / "normalized_scores.csv"

_REQUIRED_COLUMNS = [
    "model_name", "price_inr", "ram_gb", "storage_gb",
    "camera_mp", "battery_mah", "screen_size_inch", "target_segment",
]
_VALID_SEGMENTS = {"gaming", "photography", "business", "budget"}


def load_and_clean(raw_path: Path = RAW_PATH) -> pd.DataFrame:
    """Loads phones.csv and applies the brief's cleaning checks:
    drop exact duplicates, drop rows missing required fields, and flag
    (rather than silently fix) any segment/price mismatches that look like
    data errors."""
    df = pd.read_csv(raw_path)
    missing_cols = set(_REQUIRED_COLUMNS) - set(df.columns)
    if missing_cols:
        raise ValueError(f"phones.csv is missing required columns: {missing_cols}")

    df = df.dropna(subset=_REQUIRED_COLUMNS).drop_duplicates(subset=["model_name"])

    bad_segments = set(df["target_segment"].str.lower()) - _VALID_SEGMENTS
    if bad_segments:
        raise ValueError(f"Unexpected target_segment values (not in {_VALID_SEGMENTS}): {bad_segments}")

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


def engineer_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Adds camera_score / performance_score / battery_score / value_score (0-10)."""
    df = df.copy()
    scaler = MinMaxScaler(feature_range=(0, 10))

    df["camera_score"] = scaler.fit_transform(df[["camera_mp"]])
    df["battery_score"] = scaler.fit_transform(df[["battery_mah"]])

    perf_raw = df["ram_gb"] * 0.6 + df["storage_gb"] * 0.02
    df["performance_score"] = scaler.fit_transform(perf_raw.to_frame())

    quality_avg = df[["camera_score", "performance_score", "battery_score"]].mean(axis=1)
    price_norm = scaler.fit_transform(df[["price_inr"]]).flatten()
    value_raw = quality_avg / (price_norm + 0.1)
    df["value_score"] = scaler.fit_transform(value_raw.to_frame())

    return df


def run_pipeline(raw_path: Path = RAW_PATH) -> pd.DataFrame:
    """Convenience entry point: clean + engineer in one call, without touching disk.
    Used by the notebook so it works even if the CSVs haven't been (re)generated yet."""
    return engineer_scores(load_and_clean(raw_path))


if __name__ == "__main__":
    cleaned = load_and_clean()
    cleaned.to_csv(CLEANED_PATH, index=False)

    scored = engineer_scores(cleaned)
    scored.to_csv(SCORES_PATH, index=False)

    print(f"Wrote {CLEANED_PATH} ({len(cleaned)} phones)")
    print(f"Wrote {SCORES_PATH}")
    print(scored[["model_name", "camera_score", "performance_score", "battery_score", "value_score"]].round(2))
