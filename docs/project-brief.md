# GalaxyMatch AI — Project Brief

**A Samsung Galaxy phone recommendation system with grounded, explainable AI.**

- **Live demo:** https://galaxymatch-five.vercel.app
- **Code:** https://github.com/pridevine/Mobile-Product-Recommendation-System (branch `member3-ui`)
- **Capstone for:** Samsung Innovation Campus — Generative AI (Prompt Engineering + Foundation Models)

---

## Problem statement

A phone buyer faces 20+ Samsung Galaxy models and no honest way to compare
them. Retail "recommendations" are usually opaque — a ranked list with no
reason attached, or marketing copy that invents features. We set out to build a
recommender that (a) ranks phones by a **transparent, explainable** score the
customer can inspect, and (b) explains each pick in plain language that is
**grounded in the phone's real specifications**, never fabricated.

## Business context

For a brand, a recommender that states wrong specs is worse than none — it
erodes trust and creates returns. The design constraint that drove every
decision: **the system must never state a fact it cannot support from its own
catalogue.** That single rule is also the core lesson of the course chapters
(prompt Context, and RAG grounding), so the project and the syllabus point the
same way.

## Approach

A two-stage pipeline, deliberately splitting *ranking* from *explanation*:

1. **Deterministic ranking (no AI).** A weighted-sum model scores every phone
   across five dimensions — camera, performance, battery, display, value — with
   per-persona weights. The result is fully decomposable: the UI's "Why this
   score?" panel shows each dimension's contribution. No black box.

2. **Grounded explanation (AI).** The ranked phone's *real specifications* are
   retrieved from the dataset and injected into the prompt, and Gemini writes a
   short explanation citing those specs. This is Retrieval-Augmented Generation:
   query → retrieve → build prompt with retrieved docs → generate.

The key architectural finding: **the retrieval step already existed** in the
recommender; its output was being discarded before the prompt. The prompt was
handed only a model name and five 0–10 scores while being told to "mention its
strongest features" and "do not invent specifications" — an impossible pair.
A ~70-line grounding module (`src/rag.py`) closed that gap and is the difference
between real RAG and a model guessing.

Two interfaces run on the same engine: a **Jupyter/ipywidgets notebook** (the
graded deliverable, with live weight sliders, compare mode, and Gemini
explanations) and a **static web app** (deployed on Vercel, no backend). The
website calls Gemini through a serverless function so the API key stays
server-side and never ships to the browser.

## Tools used

| Layer | Tools |
|---|---|
| Language / data | Python 3.11, pandas, numpy |
| Notebook UI | Jupyter Lab, ipywidgets |
| AI | Google Gemini (`gemini-3.5-flash`, fallback `gemini-3-flash-preview`) via `google-genai` |
| Testing | pytest (9 tests; 6 assert specs actually reach the prompt) |
| Web | vanilla HTML/CSS/JS, GSAP, Lenis; Vercel serverless function for AI |
| Hosting | Vercel (static site + one Node function); GitHub |

**Deliberately *not* used**, each for a stated reason:
- **Fine-tuning** — 20 rows, catalogue changes every launch, and it changes
  *behaviour* when our gap was *knowledge*.
- **Vector database** — the longest free-text field is a processor name; nothing
  to embed. A CSV queried by a predicate *is* a knowledge base.
- **Agents / ReAct** — control flow is fixed (filter budget, then rank); no
  decision for an agent to make.

## Challenges and fixes

Every one of these was found by auditing our own code, and each is a concept
from the course made concrete:

1. **Prompts had no Context** → `src/rag.py` injects 15 real spec fields. On a
   live A/B test, the old prompt cited **zero** specs and leaked our internal
   0–10 scores to the customer; the grounded prompt cited three real specs and
   leaked none.
2. **A dead API was invisible** — a bare `except` returned `None`, which every
   caller read as "use the template", so the app looked functional while running
   zero AI → typed error handling + a `GALAXYMATCH_STRICT_AI` mode.
3. **The notebook wouldn't open** — the API client was built at import scope, so
   a missing key raised before any cell ran → build it lazily and fall back.
4. **`gemini-3.5-flash` returned 503/429 under load** and the free tier is 20
   requests/day → automatic fallback to a second free model with its own quota.
5. **A cost guard truncated every answer** — `max_output_tokens=400` was
   consumed by the model's own reasoning tokens, cutting explanations off
   mid-sentence → raised to 2048.
6. **PII leaks into budget parsing** (known, documented) — a regex reads a
   phone number or the year in an email as the user's budget. The fix is to
   scrub PII before parsing.

## Team

| Member | Area |
|---|---|
| Dev Verma | Dataset & cleaning (`data/phones.csv`, EDA) |
| Devansh Singh | Recommendation engine (`src/recommender.py`, tests) |
| Akhilan | UI — notebook widgets + the `web/` site |
| Krish Pandoh | AI features (`src/llm_client.py`, `src/prompts.py`) |

*GalaxyMatch AI is a student capstone project, not an official Samsung product.*
