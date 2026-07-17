# GalaxyMatch AI — Samsung Galaxy Recommendation System

A capstone project: an AI shopping assistant that recommends the right Samsung
Galaxy phone using a transparent weighted-sum model (camera / performance /
battery / display / value), with AI-generated explanations layered on top —
grounded in the catalogue's real specifications rather than invented ones.

**Live site:** [galaxymatch-five.vercel.app](https://galaxymatch-five.vercel.app)

Two deliverables live in this repo:

| Part | Where | What |
|------|-------|------|
| Jupyter notebook app | `notebooks/`, `src/`, `data/` | The graded Anaconda/Jupyter deliverable — data pipeline, recommender, personas, Gemini explanations, ipywidgets UI |
| Web app | `web/`, `api/` | Static site on Vercel — hero landing page + persona picker + results page, running the same engine ported to JavaScript, with serverless functions for the AI calls |

## Getting started on a fresh machine

```bash
git clone https://github.com/pridevine/Mobile-Product-Recommendation-System.git
cd Mobile-Product-Recommendation-System
```

### Run the web app (no installs needed)

Any static file server works. With Python:

```bash
cd web
python -m http.server 8080
# open http://127.0.0.1:8080/
```

Everything the site needs (fonts, images, data, JS) is inside `web/` — no
build step, no npm.

### Deploy the web app with live AI explanations

The static site has Vercel serverless functions at `api/parse.js` and
`api/explain.js`. The free-text description is interpreted into preference
weights, and the selected catalogue model is explained with grounded
specifications. **API keys stay server-side** — never in `web/`, never in
client-side JavaScript, or a static site ships them to every visitor.

Two providers are supported, selected by which key is present:

| Provider | Env var | Models | Free tier |
|---|---|---|---|
| Groq (used when its key is set) | `GROQ_API_KEY` | `llama-3.1-8b-instant` (explanations), `llama-3.3-70b-versatile` (parsing) | ~14,400 req/day |
| Gemini (default, and the fallback) | `GEMINI_API_KEY` | `gemini-3.5-flash`, `gemini-3-flash-preview` | 20 req/day per model |

`api/providers.js` routes through Groq automatically when `GROQ_API_KEY` is
set, and falls back across providers if one is unreachable or out of quota.
To go back to Gemini only, remove `GROQ_API_KEY` and redeploy — env var
changes only take effect on a new deployment.

Parsing deliberately uses Groq's 70B model rather than the faster 8B one:
this endpoint needs a guaranteed flat JSON shape, and `response_format:
json_object` only guarantees valid JSON *syntax*, not a structure. Tested
live, the 8B model returned a differently-shaped object on 6/6 calls; the
70B model held the shape on 8/8. Gemini's typed `responseSchema` enforces
the shape at the API level, so it needs no such workaround.

Add the key(s) in Vercel project settings, then deploy from the repo root:

```bash
npx vercel deploy
npx vercel deploy --prod
```

The site still shows its local explanation template if no key is set or a
provider is unavailable — a recommendation is never blank.

### Run the notebook app

1. Install [Anaconda](https://www.anaconda.com/download), then:

```bash
conda env create -f environment.yml
conda activate galaxymatch
pip install google-genai
```

2. Create a `.env` file in the repo root (never commit it):

```
GEMINI_API_KEY=your-key-here
```

Get a key from [Google AI Studio](https://aistudio.google.com/). The key is
optional: the notebook imports and runs without one, and AI calls fall back
to the rule-based templates in `src/ai_assistant.py`. Set
`GALAXYMATCH_STRICT_AI=1` to make AI failures raise instead of falling back
silently — useful when demoing, so a dead key is visible rather than hidden.

3. Regenerate the processed data and launch:

```bash
python -m src.data_pipeline
jupyter lab   # open notebooks/GalaxyMatch_AI.ipynb, Run All
```

### Tests

```bash
pytest tests/
```

21 tests covering the recommender, personas, RAG context building, and the
safety guardrails (abuse/slur screening, competitor deflection, unknown-model
refusal, PII redaction, grounded-output validation).

## Team

| Member | Area |
|--------|------|
| Member 1 | Dataset + cleaning (`data/phones.csv`, EDA) |
| Member 2 | Recommendation engine (`src/recommender.py`, tests) |
| Member 3 | UI — notebook widgets + the `web/` site |
| Member 4 | AI features (`src/llm_client.py`, `src/prompts.py`) + presentation |

Work happens on the `member3-ui` branch; `main` is merged via PR.

---
*GalaxyMatch AI is a student capstone project, not an official Samsung product.*
