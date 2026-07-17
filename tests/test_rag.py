"""
Tests for the grounding layer.

These are the proof behind the claim "our explanations are grounded". They
assert that the specifications retrieved by recommender.recommend_phone()
actually reach the prompt text — which is exactly what used to be missing.

Pure string checks: no API key, no network.
"""

import pandas as pd
import pytest

from src import rag
from src.prompts import EXPLANATION_PROMPT


@pytest.fixture
def phone():
    return pd.Series({
        "model_name": "Galaxy S26 Ultra",
        "release_year": 2026,
        "series": "S Series",
        "price_inr": 139999,
        "processor": "Snapdragon 8 Elite Gen 5 for Galaxy",
        "ram_gb": 12,
        "storage_gb": 256,
        "camera_mp": 200,
        "battery_mah": 5000,
        "screen_size_inch": 6.9,
        "display_type": "Dynamic AMOLED 2X",
        "refresh_rate_hz": 120,
        "charging_w": 60,
        "os_support_years": 7,
        "target_segment": "Flagship (S Pen)",
        "camera_score": 10.0,
        "performance_score": 10.0,
        "battery_score": 9.0,
        "display_score": 10.0,
        "value_score": 2.3,
    })


@pytest.fixture
def weights():
    return {"camera": 0.40, "performance": 0.08, "battery": 0.16,
            "display": 0.20, "value": 0.16}


def test_context_carries_the_real_specs(phone):
    """The regression this whole change exists to prevent: specs must reach
    the prompt. Before, only model_name did, so any spec the model mentioned
    was necessarily invented."""
    ctx = rag.build_phone_context(phone)
    for expected in ["200", "5000", "139,999", "Snapdragon 8 Elite Gen 5",
                     "12 GB", "120 Hz", "6.9", "7 years"]:
        assert expected in ctx, f"{expected!r} never reached the prompt"


def test_specs_and_scores_are_labelled_separately(phone):
    """Scores are our ranking opinion, not facts about the hardware. If the
    two blocks blur together the model justifies a 10.0 by inventing specs."""
    ctx = rag.build_phone_context(phone)
    assert "RETRIEVED SPECIFICATIONS" in ctx
    assert "INTERNAL MATCH SCORES" in ctx
    assert ctx.index("RETRIEVED SPECIFICATIONS") < ctx.index("INTERNAL MATCH SCORES")


def test_scores_can_be_withheld(phone):
    ctx = rag.build_phone_context(phone, include_scores=False)
    assert "INTERNAL MATCH SCORES" not in ctx
    assert "200 MP" in ctx


def test_missing_columns_do_not_raise(weights):
    """Callers hand us whatever the retriever returned; a thin row must
    degrade to fewer spec lines rather than KeyError mid-render."""
    thin = pd.Series({"model_name": "Galaxy A16 5G", "camera_score": 6.0})
    ctx = rag.build_phone_context(thin)
    assert "Galaxy A16 5G" in ctx
    assert "Camera 6.0" in ctx


def test_user_profile_ranks_by_priority(weights):
    profile = rag.build_user_profile(weights, 45000, 70000)
    assert profile.index("Camera") < profile.index("Performance")  # 40% before 8%
    assert "Rs 45,000 to Rs 70,000" in profile


def test_explanation_prompt_assembles_with_context(phone, weights):
    """Guards the .format() contract between prompts.py and ai_assistant.py —
    a renamed placeholder is a KeyError at render time, per card."""
    prompt = EXPLANATION_PROMPT.format(
        profile=rag.build_user_profile(weights),
        phone_context=rag.build_phone_context(phone),
    )
    assert "200 MP" in prompt
    assert "[OUTPUT FORMAT]" in prompt
    assert "[CONTEXT]" in prompt
