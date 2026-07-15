"""Shared local Ollama client, used by personas.py and ai_assistant.py.

Not yet installed on this machine (Ollama + `ollama pull llama3.2` are a
build-phase prerequisite, see the plan). Every caller treats a `None`
return as "fall back to the rule-based/template path" — so the app works
identically whether or not Ollama happens to be running.
"""

from __future__ import annotations

import json

import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.2"


def call_local_llm(prompt: str, expect_json: bool = False, timeout: float = 5.0):
    """Returns the model's text (or parsed dict if expect_json=True), or None
    on any failure — connection refused, timeout, or unparseable output —
    so callers always have a clean fallback signal instead of a crash."""
    payload = {"model": MODEL_NAME, "prompt": prompt, "stream": False}
    if expect_json:
        payload["format"] = "json"

    try:
        response = requests.post(OLLAMA_URL, json=payload, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException:
        return None

    text = response.json().get("response", "").strip()
    if not expect_json:
        return text or None

    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
