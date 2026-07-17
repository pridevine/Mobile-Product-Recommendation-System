# Per-member prompts for the capstone deck

Updated for the current state of the repo — the web app went from "no AI,
deterministic engine only" to "live, grounded, guardrailed Gemini" tonight.
If you're using an older copy of this file, throw it out; Members 3 and 4
changed the most.

One prompt per member, grounded in real facts from this repo, built from the
six elements the course teaches (Role · Goal · Context · Constraints · Style ·
Output Format). Paste each into whatever tool generates your slides.

**Before sending:** fill in the GitHub URL, the live demo URL
(`https://galaxymatch-five.vercel.app`), and your name.

Deliverables from the brief: Project Brief (`docs/project-brief.md`, already
written) · PPT (Architecture Diagram, Tech Stack, Live Demo, Challenges/Fixes)
· all code on GitHub with `readme.md`.

---

## Member 1 — Dev Verma · Dataset & EDA

````text
[ROLE]
You are a data engineer presenting the dataset layer of an engineering capstone
to instructors who will read the code.

[GOAL]
Write my 2 slides: the dataset, and how it is cleaned and validated.

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

Why the schema matters downstream: the 5 score columns are what the
recommender ranks on; the other 15 columns are what src/rag.py and
api/explain.js retrieve and hand to Gemini as grounding context. A wrong spec
here becomes a confidently-stated wrong answer two layers downstream, in both
the notebook and the live website.

Known issue to state honestly, not hide:
- The EDA notebook does not reproduce. Its chart code was reduced to no-op
  comments, it loads data/cleaned_dataset.csv which does not exist (the
  pipeline writes cleaned_phone_data.csv), and its prose describes 15 phones
  when the CSV has 20.

[CONSTRAINTS]
- Exactly 2 slides. Max 6 bullets each, max 12 words per bullet.
- Every number must come from the CONTEXT. Invent nothing.

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
contribution, merged back as real DataFrame columns — the UI's "Why this
score?" panel reads these directly. No black box.

confidence_label(match_pct) buckets into 5 tiers:
  >=95 Perfect, >=90 Excellent, >=80 Great, >=70 Good, else Fair

Persona weights + budgets live in src/personas.py, e.g.:
  Riya (creator): camera 0.40, performance 0.08, battery 0.16, display 0.20,
    value 0.16, budget Rs 38,000-47,000
  Kabir (gamer): camera 0.08, performance 0.40, battery 0.24, display 0.20,
    value 0.08, budget Rs 25,000-38,000
  Ananya (consultant): camera 0.16, performance 0.16, battery 0.32, display
    0.20, value 0.16, budget Rs 87,000-175,000
  Mukesh (budget): camera 0.09, performance 0.09, battery 0.27, display 0.10,
    value 0.45, budget Rs 15,000-23,000

Why a weighted sum, not ML: 20 rows is far too little to train on, and the
requirement was explainability. A transparent formula a customer can be shown
beats an accurate model nobody can question.

Tests: tests/test_recommender.py — 3 unit tests on the weighted sum, the
per-dimension breakdown, and the 5 confidence thresholds.

A bug we found and fixed: recommend_phone() falls back to ranking the FULL
catalogue when fewer than 3 phones fit a persona's budget, with no flag on
the result — so Riya could be shown a Rs 139,999 phone against a Rs 45-70k
budget, labelled a Perfect Match. Fixed by widening Riya's and Ananya's
budget ranges so their real top match now falls inside their own stated
range, rather than silently discarding the budget filter.

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

## Member 3 — Akhilan · UI (notebook + live web app)

````text
[ROLE]
You are the front-end engineer presenting the two interfaces of a capstone
project, including the live demo, to instructors who will click through it.

[GOAL]
Write my 3 slides: the notebook UI, the web app (now with LIVE Gemini), and
the Live Demo script.

[CONTEXT — real facts. Use ONLY these.]

Two interfaces over one engine, both now AI-enabled:

1. notebooks/GalaxyMatch_AI.ipynb — the graded Jupyter deliverable.
   ipywidgets: persona Dropdown, free-text Textarea, Tab switcher, "Find My
   Galaxy" button, 5 live What-If weight sliders (one per dimension —
   including display, which was missing and crashed the feature until fixed),
   Compare Mode, All-Personas overview, Conversational Refine. Cards show a
   match meter, sub-score bars, badge chips, and a "Why this score?"
   breakdown. Calls Gemini directly via src/llm_client.py.

2. web/ — a static site on Vercel, deployed at
   https://galaxymatch-five.vercel.app, but NOT purely static anymore:
   - index.html: hero locked to exactly one viewport, no scroll.
   - personas.html: 4 persona cards + free-text search.
   - results.html: ranked top-3, an animated CardSwap deck, and the #1
     match's explanation is LIVE Gemini text — served through a Vercel
     serverless function (api/explain.js) so the API key never reaches the
     browser. The local rule-based template shows instantly, then is
     upgraded in place if the live call succeeds — the card is never blank
     and the page never blocks on the network. A real Galaxy S26 Ultra
     photo now renders in the hero and top-match card; the other 19 phones
     still use drawn SVG fallbacks (a deliberate choice: matching by exact
     filename means a wrong photo can never appear mislabelled).
   - The free-text box on personas.html also calls a serverless function
     (api/parse.js) to turn "budget 30000, I play BGMI" into real weights
     via Gemini, with a local regex fallback if that's unavailable.
   Stack: vanilla HTML/CSS/JS, GSAP, Lenis smooth scroll, no build step, no
   framework. State passes via URL query params so any result is shareable.

Why the API key is still safe on a static site: it lives only in a Vercel
serverless function's environment variable, never in the shipped JS bundle.
The browser POSTs a phone name + weights (already public data); the server
builds the grounded prompt and returns only the resulting text.

Fixes I made tonight:
- Notebook's persona dropdown hardcoded value="arjun" after personas were
  renamed to riya/kabir/ananya/mukesh — TraitError killed Run All.
- What-If sliders raised KeyError('display') on first drag: the slider list
  omitted a dimension calculate_score reads.
- results.html's nav still linked to index.html#personas, an anchor that had
  moved to personas.html when the hero was split into its own page — the
  links silently did nothing.
- Phone thumbnails now render on every ranked row, not just the CardSwap deck.

Live Demo script (3 minutes):
1. index.html — one-screen hero, click Find My Galaxy
2. personas.html — pick Priya (camera-led), or type a free-text description
3. results.html — top 3 ranked; watch the #1 card's explanation upgrade from
   template to live Gemini text; open "Why this score?" for the weighted-sum
   breakdown
4. Switch persona chip — re-ranks instantly, URL stays shareable
5. Type "I want an iPhone" in the free-text box — the app refuses and asks
   for Samsung-relevant priorities instead of guessing a random phone

[CONSTRAINTS]
- Exactly 3 slides (notebook, web app, live demo). Max 6 bullets, 12 words each.
- The demo slide must be a numbered click path someone else could follow.
- State plainly that the web app now calls Gemini live — do not undersell
  this as "static site, no backend."

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
You are the engineer who owns the Gemini integration — across the notebook
AND the live website — presenting the AI layer to instructors assessing
prompt engineering and safety specifically.

[GOAL]
Write my 4 slides: the RAG architecture (now duplicated across two runtimes),
the prompt engineering, the safety/guardrail layer, and Challenges/Fixes.

[CONTEXT — real facts. Use ONLY these.]

Two independent, mirrored implementations of the same grounded pipeline:
- Python (notebook): src/rag.py -> src/prompts.py -> src/llm_client.py
- JavaScript (live website): api/explain.js, api/parse.js, api/safety.js —
  Vercel serverless functions, since a static site can never hold the key.
Both build the SAME two-block context (RETRIEVED SPECIFICATIONS vs INTERNAL
MATCH SCORES) and the SAME system instruction, independently, because there
is no shared runtime between a Jupyter kernel and a Vercel function. This is
a real engineering cost we chose to pay for symmetry, and a real risk (keep
them in sync) we chose to accept.

Model: gemini-3.5-flash, falling back to gemini-3-flash-preview on 503/429.

The RAG four-step map, both runtimes:
  1 query      -> persona weights, or free-text extraction
  2 retrieve   -> filter by budget, rank by weighted sum (already existed)
  3 build      -> format the retrieved phone's real specs into two labelled
                  blocks: facts vs our own ranking opinion
  4 generate   -> call Gemini with a system instruction + grounded prompt

The central finding: step 2 already worked and its output was thrown away at
step 3. The prompt used to receive only a phone's name and five 0-10 scores.
So it was told "mention its strongest features" AND "do not invent
specifications" while being given no specifications — an instruction pair
that cannot both be obeyed. What we found it actually did, run live: it
recited our INTERNAL scores back to the customer ("a perfect 10.0 camera
score") rather than inventing fake specs — a more interesting failure than
hallucination, and exactly what the two-block context design now prevents.

Prompt engineering (Ch2 Unit 2.1's six elements):
- Audited our own 5 prompts first: Output Format missing from 4 of 5, Style
  from 3 of 5, Context weak or absent in all 5.
- "Do not invent specifications" was copy-pasted into two templates — Ch2
  slide 110's "Bad Case: Rules Inside the Instruction Prompt" exactly. Now
  lives once in a system instruction on both runtimes.
- COMPARISON_PROMPT now returns a spec table, not prose — Ch2 slide 48's own
  worked example was our bug.

The safety/guardrail layer — three separate concerns, each with its own fix:

1. Content safety, checked BEFORE every free-text request reaches Gemini
   (api/safety.js screenUserText, src/security.py screen_user_text — kept in
   sync by hand, same regexes): blocks abuse/threats, redacts PII (email,
   phone) before it ever reaches Google, caps input at 1000 chars, and sets
   Gemini's own safety_settings to BLOCK_LOW_AND_ABOVE as defense in depth.

2. Off-topic refusal, a bug we found live: typing "I want an iPhone" matched
   none of our keyword buckets, fell into default weights, and the app
   quietly recommended a Samsung phone as if it had understood the
   request — reading as a random, unrelated answer. A COMPETITOR_RE regex
   already existed but was only checked against Gemini's OUTPUT, never the
   user's input. Fixed by adding the same input check to THREE independent
   code paths that turn free text into a recommendation: the server
   (api/safety.js), the notebook (src/security.py), and — the one that had
   NO screening at all — the client-only fallback engine.js uses when the
   live API is skipped or down. Proven with a regression test.

3. Output validation: validateExplanation() rejects Gemini's own response if
   it doesn't cite >=2 real specs from the retrieved context, or if it
   mentions a competitor or states an internal score — the grounding
   contract is enforced on the way OUT, not just assumed from the prompt.

The quota story — diagnosed with real server logs, not guessed:
- Free tier is 20 requests/DAY per model, not per minute. Production started
  returning {text:null, source:"error"} for both endpoints; we pulled
  Vercel's runtime logs directly (`vercel logs`) rather than assume a code
  bug, and found real 429 RESOURCE_EXHAUSTED on both the primary and
  fallback model — the code was correct, the key was just spent from a full
  day of testing.
- Fixed the actual waste, not just the symptom: added a small
  sessionStorage-backed guard (web/ai-guard.js) shared by both entry points.
  It caches identical asks so re-clicking the same persona during a demo
  rehearsal reuses the prior answer instead of re-spending quota, and trips
  a circuit breaker after 2 consecutive failures so the site stops paying a
  doomed network round-trip on every render once the day's quota is dead.

Rejected on purpose, each with a reason:
- Fine-tuning: 20 rows; catalogue changes every launch; wrong tool anyway —
  it changes behaviour, our gap was knowledge.
- Vector DB: the longest free-text field is a processor name. Nothing to
  embed. A CSV queried by a predicate IS a knowledge database.
- ReAct/agents: control flow is fixed (filter budget, then rank). No
  decision for an agent to make.

Verification: 17 pytest tests. 6 assert retrieved specs actually reach the
prompt text; 1 proves the competitor-phone refusal; the grounding claim and
the safety claim are both tested, not just asserted.

[CONSTRAINTS]
- Exactly 4 slides. Max 6-7 bullets, 12 words each.
- The architecture slide must show a Mermaid `flowchart LR` with TWO parallel
  paths (Python/notebook, JS/Vercel) converging on the same Gemini call,
  labelled to show they are independently maintained.
- Challenges must read problem -> fix, not "we had bugs."
- Every claim checkable in the repo. Invent nothing.

[STYLE]
Engineering-honest. The strongest material is what we found wrong in our own
code, live, and fixed with evidence — lead with that.

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
| 6 | Member 4 | Architecture diagram (dual RAG, Python + JS) |
| 7 | Member 4 | Prompt engineering: the six-element audit |
| 8 | Member 4 | Safety & guardrails (content, off-topic refusal, quota) |
| 9–11 | Member 3 | Notebook UI, live web app, live demo |
| 12 | Member 4 | Challenges & fixes |
| 13 | Any | Links: GitHub, live demo |

**The safety/guardrail slide (8) is the strongest slide in the deck now.**
Most teams' Challenges section says "we had merge conflicts." Ours says: we
watched the app confidently answer a question it didn't understand, traced
it to a check that existed but was wired to the wrong side of the request,
fixed it in three independent code paths because one alone wasn't enough,
and wrote a test that proves it stays fixed.
