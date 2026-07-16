# Per-member prompts for the capstone deck

One prompt per member. Each is built from the six elements the course teaches
(Role · Goal · Context · Constraints · Style · Output Format) and is **grounded
in real facts from this repo**, so whatever tool you paste it into can't invent
your architecture. If you strip the CONTEXT block out, you'll get a confident,
generic, wrong deck — which is the exact failure this project is about.

**Before sending:** fill in the GitHub URL, the Vercel URL, and your name.

Deliverables (from the brief): Project Brief (1–2 page `.md`) · PPT
(Architecture Diagram, Tech Stack, Live Demo, Challenges/Fixes) · all code on
GitHub with `readme.md`.

---

## Member 1 — Dev Verma · Dataset & EDA

````text
[ROLE]
You are a data engineer presenting the dataset layer of an engineering capstone
to instructors who will read the code.

[GOAL]
Write my 2 slides for the team deck: the dataset, and how it is cleaned and
validated.

[CONTEXT — real facts. Use ONLY these; invent no numbers.]
File: data/phones.csv — 20 Samsung Galaxy phones x 20 columns.
Columns:
- Identity: model_name, series (S/Z/A/M/F), processor, display_type,
  target_segment, release_year
- Numeric specs: price_inr, ram_gb, storage_gb, camera_mp, battery_mah,
  screen_size_inch, refresh_rate_hz, charging_w, os_support_years
- Pre-engineered scores (0-10): camera_score, performance_score,
  battery_score, display_score, value_score
Price range: Rs 15,999 (Galaxy M16 5G) to Rs 174,999 (Galaxy Z Fold7).
Segments: Flagship (S Pen), Foldable Flagship, Upper Mid-range, Mid-range, Budget.

Cleaning pipeline — src/data_pipeline.py, load_and_clean():
- asserts every required column is present, raises ValueError if not
- dropna on required columns
- drop_duplicates on model_name
- validates target_segment against an allowed set
- enforces every score is within 0-10
- flags suspicious price/segment combinations

Why the schema matters downstream: the 5 score columns are the only fields the
recommender ranks on; the other 15 became the grounding context that is fed to
Gemini, so an incorrect spec here becomes a confidently-stated wrong answer in
the product. The dataset is the source of truth.

Known issue to state honestly, not hide:
- The EDA notebook does not reproduce. Its chart code was reduced to no-op
  comments (a literal "\n" inside a comment string), it loads
  data/cleaned_dataset.csv which does not exist (the pipeline writes
  cleaned_phone_data.csv), and its prose describes 15 phones when the CSV has
  20. The charts currently visible are stale saved PNGs.
- data/EDA.ipynb is a byte-identical duplicate of notebooks/EDA.ipynb.

[CONSTRAINTS]
- Exactly 2 slides. Max 6 bullets each, max 12 words per bullet.
- Every number must come from the CONTEXT. Invent nothing.
- Name the real validation rules, not "we cleaned the data".

[STYLE]
Engineering-honest. An instructor should be able to check any claim in the repo.

[OUTPUT FORMAT]
  Slide N — <title>
  - bullet
  Speaker notes: <2 sentences>
````

---

## Member 2 — Devansh Singh · Recommendation Engine

````text
[ROLE]
You are the engineer who built the scoring model, presenting it to instructors
who will read the code.

[GOAL]
Write my 2 slides: how ranking works, and why it is explainable.

[CONTEXT — real facts. Use ONLY these.]
File: src/recommender.py

calculate_score(phone_row, weights) — a weighted sum across 5 dimensions:
  camera*w + performance*w + battery*w + display*w + value*w
Scores are 0-10; weights sum to 1.0; so match_score lands in 0-10.

calculate_score_breakdown() returns each dimension's score x weight as its own
contribution, merged back as real DataFrame columns. That means every ranking
is fully decomposable — the UI's "Why this score?" panel reads these directly.
There is no black box: the same arithmetic explains the result.

confidence_label(match_pct) buckets into 5 tiers:
  >=95 Perfect, >=90 Excellent, >=80 Great, >=70 Good, else Fair
rank_results() computes match_pct = match_score / 10 * 100, clipped at 99.

Persona weights live in src/personas.py, e.g.:
  Riya (creator): camera 0.40, performance 0.08, battery 0.16, display 0.20, value 0.16
  Kabir (gamer):  camera 0.08, performance 0.40, battery 0.24, display 0.20, value 0.08
  Mukesh (budget): camera 0.09, performance 0.09, battery 0.27, display 0.10, value 0.45

Why a weighted sum, not ML: 20 rows is far too little to train on, and the
requirement was explainability. A transparent formula that a customer can be
shown beats an accurate model nobody can question.

Tests: tests/test_recommender.py — 3 tests covering the weighted sum, the
per-dimension breakdown, and the 5 confidence thresholds. Pure unit tests, no
I/O, no LLM.

Known issue to state honestly:
- recommend_phone() falls back to ranking the FULL catalogue when fewer than 3
  phones fit the budget, with no flag on the returned frame. So Riya
  (Rs 45k-70k) can be shown the Galaxy S26 Ultra at Rs 139,999 — 2x her stated
  maximum — labelled a Perfect Match. The honest fix is to return a partial
  result, or add a budget_relaxed column the UI can surface.

[CONSTRAINTS]
- Exactly 2 slides. Max 6 bullets each, max 12 words per bullet.
- Show the weighted-sum formula on the first slide.
- Every number from the CONTEXT. Invent no accuracy metrics — there are none.

[STYLE]
Precise and quantitative. Explainability is the selling point, not accuracy.

[OUTPUT FORMAT]
  Slide N — <title>
  - bullet
  Speaker notes: <2 sentences>
````

---

## Member 3 — Akhilan · UI (notebook + web)

````text
[ROLE]
You are the front-end engineer presenting the two interfaces of a capstone
project, including the live demo.

[GOAL]
Write my 3 slides: the notebook UI, the web app, and the Live Demo script.

[CONTEXT — real facts. Use ONLY these.]

Two interfaces over one engine:
1. notebooks/GalaxyMatch_AI.ipynb — the graded Jupyter deliverable.
   ipywidgets: persona Dropdown, free-text Textarea, Tab switcher,
   "Find My Galaxy" button, live What-If weight sliders (5, one per
   dimension), Compare Mode checkboxes, All-Personas overview,
   Conversational Refine box.
   Cards show a match meter, per-dimension sub-score bars, badge chips, and a
   "Why this score?" breakdown fed by calculate_score_breakdown().
   src/theme.py injects a Material-3-inspired dark theme with a base64-inlined
   variable font and procedurally drawn SVG phone illustrations — deliberately
   script-free so it renders identically in any notebook viewer.
2. web/ — a static site, no backend, no build step, deployed on Vercel.
   index.html is a hero locked to exactly one viewport (no scroll).
   personas.html holds the 4 persona cards and the free-text search.
   results.html shows the ranked top-3 plus an animated CardSwap deck.
   web/engine.js is a JavaScript port of the Python weighted-sum engine, so the
   site runs entirely client-side from data/phones.json.
   Stack: vanilla HTML/CSS/JS, GSAP, Lenis smooth scroll, self-hosted vendor
   files (no CDN). State passes via URL query params (?persona= / ?q=) so any
   result is shareable.

Why the web app has no backend: a static site ships every file to every
visitor, so an API key could never live there safely. The deployed site runs
the deterministic engine only; all Gemini calls stay in the notebook.

Live Demo script (3 minutes):
1. index.html — one-screen hero, click Find My Galaxy
2. personas.html — pick Priya (camera-led)
3. results.html — top 3 ranked, open "Why this score?" to show the weighted-sum
   breakdown, note the phone thumbnails and the CardSwap deck
4. Switch persona chip — ranking re-sorts instantly, URL stays shareable
5. Notebook — same engine, plus Gemini explanations grounded in real specs

Fixes I made:
- The notebook's persona dropdown defaulted to value="arjun", but the personas
  had been renamed to riya/kabir/ananya/mukesh in an earlier merge — every
  Run All died on a TraitError before a single widget rendered.
- The What-If sliders raised KeyError('display') on first drag: the slider list
  omitted a dimension that calculate_score reads. The headline interactive
  feature was dead on touch.
- Phone thumbnails now render on the ranked rows, reusing the same visual as
  the deck. 19 of 20 fall back to drawn SVG because the photo files are a
  product generation behind the catalogue — matching is by exact filename, so a
  Galaxy S24 photo can never appear mislabelled as an S26.

[CONSTRAINTS]
- Exactly 3 slides (notebook, web app, live demo). Max 6 bullets, 12 words each.
- The demo slide must be a numbered click path someone else could follow.
- Invent no user research or usability metrics — there are none.

[STYLE]
Concrete and visual. Describe what is on screen, not adjectives about it.

[OUTPUT FORMAT]
  Slide N — <title>
  - bullet
  Speaker notes: <2 sentences>
````

---

## Member 4 — Krish Pandoh · AI features & presentation

````text
[ROLE]
You are the engineer who owns the Gemini integration, presenting the AI layer
to instructors who are assessing prompt engineering specifically.

[GOAL]
Write my 3 slides: the RAG architecture, the prompt engineering, and the
Challenges/Fixes slide for the whole team.

[CONTEXT — real facts. Use ONLY these.]

Stack: google-genai SDK, model gemini-3.5-flash (free tier). Key in a
gitignored .env — never in git, verified across every commit on every branch.

The architecture is the course's RAG four steps, and three of them already
existed:
  1 query      -> src/personas.py   (persona weights, or free-text extraction)
  2 retrieve   -> src/recommender.py recommend_phone() filters budget + ranks
  3 build      -> src/rag.py        build_phone_context() formats the specs
  4 generate   -> src/llm_client.py call_llm(prompt, config=GROUNDED_CFG)

The central finding: step 2 already worked and its output was thrown away at
step 3. recommend_phone() selected the right phone row, then the prompt was
handed only that phone's model_name and five 0-10 scores. The 15 specification
columns sitting in the same row were dropped.

So EXPLANATION_PROMPT instructed Gemini to "Mention its strongest features" AND
"Do not invent specifications" while supplying no specifications. Those two
instructions cannot both be obeyed. Every concrete spec in the output was, of
necessity, invented. src/rag.py is ~70 lines and is the whole difference
between RAG and guessing.

Prompt engineering applied (Ch2 Unit 2.1's six elements):
- We audited our own 5 prompts first. Output Format was missing from 4 of 5,
  Style from 3 of 5, Context was weak or absent in all 5.
- Context now comes from build_phone_context(), which labels two blocks
  separately: RETRIEVED SPECIFICATIONS (facts from phones.csv) and INTERNAL
  MATCH SCORES (our ranking opinion). Blurring them is what invites the model
  to invent a megapixel count to justify a 10.0 — so the prompt forbids quoting
  the scores and forces every claim onto the specs.
- "Do not invent specifications" had been copy-pasted into two templates — Ch2
  slide 110's "Bad Case: Rules Inside the Instruction Prompt" exactly. It now
  lives once in SYSTEM_INSTRUCTION, passed via GenerateContentConfig. That same
  refactor also delivers Vertical AI (only Galaxy phones in the catalogue) and
  the System > User > Document priority rule.
- Few-shot exemplars cost nothing: the rule-based template fallback already
  held the house style, so two of its sentences became the [EXAMPLES] block.
- COMPARISON_PROMPT now returns a spec table. Ch2 slide 48 uses "Compare Galaxy
  S24 and iPhone 15 specs" as its worked example of Output Format — prose bad,
  table good. The chapter's own example was our bug.

Rejected on purpose, each with a reason:
- Fine-tuning: 20 rows; the catalogue changes every launch so a fine-tune is
  stale on release day; and it is the wrong tool — it changes behaviour, our
  gap was knowledge.
- Vector DB: the longest free-text field is a processor name. Nothing to embed.
  A CSV queried by a predicate IS a knowledge database.
- ReAct / agents: control flow is fixed (filter budget, then rank). No decision
  for an agent to make.

Challenges and fixes, for the team slide:
1. Prompt with no Context -> src/rag.py injects 15 real spec fields
2. Specs and scores blurred -> label them as separate blocks
3. A dead API was invisible: a bare `except` returned None, and every caller
   read None as "use the template", so the app looked fine while running zero
   AI -> catch by error type; GALAXYMATCH_STRICT_AI=1 re-raises for demos
4. The notebook could not open: the client was built at import scope, so a
   missing key raised before any cell ran -> build it lazily, warn once, fall back
5. A 0.5s rate limiter sat in the per-card render loop, so only 1 of 3 result
   cards ever reached Gemini -> remove it from the render path
6. Known, not fixed: budget parsed with regex \d{4,6}, so "call me at
   9876543210" parses a budget of 987654, and "riya1998@gmail.com" parses 1998
   -> a Rs 2,297 budget -> zero matches. Ch2 Unit 1.2's Data/Security risk,
   live in our code. Fix is to scrub PII before parsing.

Verification: 9 pytest tests. 6 assert the retrieved specs actually appear in
the prompt text — so "our answers are grounded" is tested, not asserted.

Honest note worth a slide bullet: gemini-3.5-flash returned 503 UNAVAILABLE
under load while we tested. The rule-based fallback means the product degrades
to templates rather than failing.

[CONSTRAINTS]
- Exactly 3 slides. Max 6 bullets, 12 words each.
- The architecture slide must render the 4 RAG steps as a Mermaid
  `flowchart LR`, labelling which step already existed.
- Challenges must read problem -> fix, not "we had bugs".
- Every claim checkable in the repo. Invent nothing.

[STYLE]
Engineering-honest. The strongest material is what we found wrong in our own
code and fixed — lead with that, don't bury it.

[OUTPUT FORMAT]
  Slide N — <title>
  - bullet
  Speaker notes: <2 sentences>
  Plus the Mermaid diagram for the architecture slide.
````

---

## Assembly order

| Slides | Owner | Content |
|---|---|---|
| 1 | Any | Title, team, problem statement |
| 2–3 | Member 1 | Dataset, cleaning & validation |
| 4–5 | Member 2 | Weighted-sum engine, explainability |
| 6 | Member 4 | Architecture diagram (the 4 RAG steps) |
| 7 | Member 4 | Prompt engineering: the six-element audit |
| 8–10 | Member 3 | Notebook UI, web app, live demo |
| 11 | Member 4 | Challenges & fixes |
| 12 | Any | Links: GitHub, Vercel |

**Slide 11 is the best slide in the deck.** Most teams write "we had merge
conflicts." Ours says: *we found an instruction pair the model could not obey,
and here is the test that proves the fix.*
