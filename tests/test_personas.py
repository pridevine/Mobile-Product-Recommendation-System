import json

from src.personas import PERSONAS, _extract_rule_based


def test_personas_are_ordered_by_budget_and_have_three_catalogue_matches():
    with open("web/data/phones.json", encoding="utf-8") as file:
        phones = json.load(file)

    ids = list(PERSONAS)
    assert ids == ["mukesh", "kabir", "riya", "ananya"]

    previous_max = 0
    for persona_id in ids:
        persona = PERSONAS[persona_id]
        assert persona["budget_min"] >= previous_max or persona_id == "ananya"
        matches = [
            phone for phone in phones
            if persona["budget_min"] <= phone["price_inr"] <= persona["budget_max"]
        ]
        assert len(matches) >= 3, f"{persona_id} has only {len(matches)} catalogue matches"
        previous_max = persona["budget_max"]


def test_free_text_lakh_budget_becomes_a_high_end_window():
    result = _extract_rule_based("I have a budget of 1 lakh")
    assert result["budget_min"] == 85000
    assert result["budget_max"] == 115000
