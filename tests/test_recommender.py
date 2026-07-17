import pandas as pd

from src.recommender import (
    calculate_score,
    calculate_score_breakdown,
    confidence_label,
)


def sample_phone():
    return pd.Series(
        {
            "camera_score": 9.0,
            "performance_score": 8.0,
            "battery_score": 7.0,
            "display_score": 8.0,
            "value_score": 6.0,
        }
    )


def sample_weights():
    # 5-dimension weights (display added in the merge), summing to 1.0
    return {
        "camera": 0.4,
        "performance": 0.2,
        "battery": 0.15,
        "display": 0.15,
        "value": 0.1,
    }


def test_weighted_sum_score():

    score = calculate_score(
        sample_phone(),
        sample_weights(),
    )

    expected = (
        9 * 0.4
        + 8 * 0.2
        + 7 * 0.15
        + 8 * 0.15
        + 6 * 0.1
    )

    assert round(score, 2) == round(expected, 2)


def test_score_breakdown():

    breakdown = calculate_score_breakdown(
        sample_phone(),
        sample_weights(),
    )

    assert breakdown["camera_contribution"] == 3.6
    assert breakdown["performance_contribution"] == 1.6
    assert breakdown["battery_contribution"] == 1.05
    assert breakdown["display_contribution"] == 1.2
    assert breakdown["value_contribution"] == 0.6


def test_confidence_labels():

    assert confidence_label(97) == "⭐⭐⭐⭐⭐ Perfect Match"
    assert confidence_label(92) == "⭐⭐⭐⭐ Excellent Match"
    assert confidence_label(84) == "⭐⭐⭐ Great Match"
    assert confidence_label(74) == "⭐⭐ Good Match"
    assert confidence_label(60) == "⭐ Fair Match"