# GalaxyMatch AI — Samsung Galaxy Recommendation System

A capstone project: an AI shopping assistant that recommends the right Samsung
Galaxy phone using a transparent weighted-sum model (camera / performance /
battery / display / value), with Gemini-powered explanations layered on top.

Two deliverables live in this repo:

| Part | Where | What |
|------|-------|------|
| Jupyter notebook app | `notebooks/`, `src/`, `data/` | The graded Anaconda/Jupyter deliverable — data pipeline, recommender, personas, Gemini explanations, ipywidgets UI |
| Web app | `web/` | Static site (deployable to Vercel) — dark hero landing page + results page running the same engine ported to JavaScript |

## Getting started on a fresh machine

```bash
git clone https://github.com/pridevine/Mobile-Product-Recommendation-System.git
cd Mobile-Product-Recommendation-System
git checkout member3-ui
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

### Deploy the web app with live Gemini explanations

The static site has Vercel serverless functions at `api/parse.js` and
`api/explain.js`. The free-text description is interpreted by Gemini, and the
selected catalogue model is explained with grounded specifications. The Gemini
key stays server-side. In Vercel project settings, add
`GEMINI_API_KEY` as an environment variable for Preview and Production, then
deploy from the repository root:

```bash
npx vercel deploy
npx vercel deploy --prod
```

The site still shows its local explanation template if the key is missing or
Gemini is temporarily unavailable. Do not put `GEMINI_API_KEY` in `web/` or in
client-side JavaScript.

**Optional second provider — Groq.** Gemini's free tier is 20 requests/day
per model; Groq's is 14,400/day on `llama-3.1-8b-instant`, useful if you want
headroom for a live demo without watching the quota. Add `GROQ_API_KEY` as a
Vercel environment variable and redeploy — `api/providers.js` routes both
functions through Groq automatically when that key is present, with no other
change needed. To go back to Gemini, remove `GROQ_API_KEY` and redeploy; env
var changes only take effect on a new deployment. Same key stays server-side
rule applies: never in `web/`, never in client-side JavaScript.

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

Get a key from [Google AI Studio](https://aistudio.google.com/). Note:
`src/llm_client.py` currently *requires* this key to import — without a
`.env` the notebook will not start. AI calls fail gracefully at runtime
(rule-based fallbacks take over), so a placeholder key is enough to run
without live Gemini.

3. Regenerate the processed data and launch:

```bash
python -m src.data_pipeline
jupyter lab   # open notebooks/GalaxyMatch_AI.ipynb, Run All
```

### Tests

```bash
pytest tests/
```

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
