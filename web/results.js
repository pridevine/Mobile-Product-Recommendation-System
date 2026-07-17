/* results.js — "Your Top 3 Matches": ranked list + CardSwap deck.
   Reads the choice from the URL (?persona=riya or ?q=<free text>) so
   results stay shareable. Re-renders (and re-inits the deck) on chip switch. */

let state = { weights: null, budget: [0, 1e9], personaId: null, label: "", requireSPen: false };
let deck = null; // active CardSwap instance

const RESULT_SUBS = [["camera_score", "Camera"], ["performance_score", "Performance"],
  ["battery_score", "Battery"], ["display_score", "Display"], ["value_score", "Value"]];

function readParams() {
  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  const persona = params.get("persona");
  if (q) {
    // Checked before any processing: a banned browser sees the restriction
    // message here too, even if it lands on this URL directly (shared link,
    // or /api/parse having already redirected here with no profile).
    if (typeof AIGuard !== "undefined" && AIGuard.isBanned()) {
      return { blocked: true, message: AIGuard.banMessage() };
    }
    let prefs = null;
    try {
      const profile = JSON.parse(params.get("profile") || "null");
      if (profile && profile.weights && Array.isArray(profile.weights) === false) {
        prefs = { weights: profile.weights, budget_min: profile.budget_min, budget_max: profile.budget_max };
      }
    } catch (_) { /* malformed profile falls back to local extraction */ }
    // Only screen here when falling back to the local extractor: a `profile`
    // already present means /api/parse succeeded and screened it server-side.
    if (!prefs) {
      const screened = screenQuery(q);
      if (screened.blocked) {
        // Only "abuse" counts as a strike -- competitor/off-topic asks never should.
        const message = screened.reason === "abuse" ? AIGuard.recordAbuseStrike().message : screened.message;
        return { blocked: true, message };
      }
      prefs = extractPreferences(q);
    }
    // Checked on the raw query independent of where prefs came from (server
    // AI parse or local extraction) -- neither path carries a "requires S
    // Pen" concept, and this is a hard filter, not a weight to infer.
    const requireSPen = SPEN_RE.test(q);
    return { weights: prefs.weights, budget: [prefs.budget_min, prefs.budget_max],
      personaId: null, label: "Based on your description", requireSPen };
  }
  // Track PERSONAS rather than hardcoding an id — a stale hardcoded "arjun"
  // is exactly what left the notebook dropdown throwing TraitError for two days
  // after Member 2 renamed the personas.
  const id = persona && PERSONAS[persona] ? persona : Object.keys(PERSONAS)[0];
  const p = PERSONAS[id];
  return { weights: p.weights, budget: [p.budget_min, p.budget_max],
    personaId: id, label: `For ${p.name} — ${p.need}`, requireSPen: false };
}

function inr(n) { return "₹" + n.toLocaleString("en-IN"); }

// Progressive enhancement: the card already shows the local template. Ask the
// serverless function (which holds the API key) for a grounded AI
// explanation and swap it in if it comes back. Any failure leaves the template
// in place — the card is never blank, and the page never blocks on this.
//
// Guarded by AIGuard so re-selecting the same persona during a demo reuses
// the cached answer, and once quota is exhausted the site stops asking for a
// few minutes rather than eating a failing round-trip on every render.
async function enhanceTopExplanation(p) {
  const el = document.getElementById("rec-explain");
  if (!el || !p) return;

  const cacheKey = `explain:${p.model_name}:${JSON.stringify(state.weights)}`;
  const cached = AIGuard.cacheGet(cacheKey);
  if (cached) {
    el.textContent = cached;
    el.classList.add("rec-why-ai");
    return;
  }
  if (AIGuard.isDown()) return; // known-exhausted this session — keep the template, skip the network call

  el.classList.add("rec-why-loading");
  try {
    const res = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: p, weights: state.weights }),
    });
    const data = await res.json();
    if (data && data.text) {
      el.textContent = data.text;
      el.classList.add("rec-why-ai");      // shows the "✦ Gemini" tag via CSS
      AIGuard.cacheSet(cacheKey, data.text);
      AIGuard.noteResult(true);
    } else {
      AIGuard.noteResult(false);
    }
  } catch (_) {
    /* offline, or no /api (e.g. opened as a file): keep the template */
    AIGuard.noteResult(false);
  } finally {
    el.classList.remove("rec-why-loading");
  }
}

function recRow(rank, p) {
  const subRows = RESULT_SUBS.map(([col, label]) =>
    `<div class="sub-row"><span class="sub-label">${label}</span>
       <div class="sub-track"><div class="sub-fill" data-w="${p[col] * 10}"></div></div>
       <span class="sub-val">${p[col].toFixed(1)}</span></div>`).join("");
  // The #1 match gets an explanation: the local template shows instantly, then
  // enhanceTopExplanation() upgrades it to grounded Gemini text if /api/explain
  // succeeds. The page is never blank and never blocks on the network.
  const explain = rank === 0
    ? `<p class="rec-why-text" id="rec-explain">${generateExplanation(state.weights, p)}</p>`
    : "";
  // Same phoneVisual() as the deck, so a phone looks identical in both places.
  return `<article class="rec-row${rank === 0 ? " hot" : ""}" data-rank="${rank}">
    <div class="rec-thumb">${phoneVisual(p)}</div>
    <div class="rec-main">
      <div class="rec-top">
        <button class="rec-rank" type="button" aria-label="Select match ${rank + 1}" title="Show match ${rank + 1}">${rank + 1}</button>
        <span class="rec-name">${p.model_name}</span>
        <span class="rec-seg">${segShort(p.target_segment)}</span>
        <span class="rec-pct">${p.match_pct}%</span>
      </div>
      <div class="rec-meta">
        <span><b>${inr(p.price_inr)}</b></span>
        <span>${p.camera_mp}MP camera</span>
        <span>${p.battery_mah}mAh</span>
        <span>${p.screen_size_inch}&Prime; ${p.refresh_rate_hz || 120}Hz</span>
      </div>
      ${explain}
      <button class="rec-why">Why this score?</button>
      <div class="breakdown"><div class="breakdown-inner">${subRows}</div></div>
    </div>
  </article>`;
}

function deckCard(rank, p) {
  return `<div class="cs-card" data-rank="${rank}">
    <div class="csc-photo">${phoneVisual(p)}</div>
    <div class="csc-body">
      <h3 class="csc-name">${p.model_name}</h3>
      <span class="csc-seg">${segShort(p.target_segment)}</span>
    </div>
    <div class="csc-foot">
      <span class="csc-price">${inr(p.price_inr)}</span>
      <span class="csc-pct"><b>${p.match_pct}%</b> match</span>
    </div>
    <span class="csc-select">Select ${p.model_name.replace("Galaxy ", "")}</span>
  </div>`;
}

function paint() {
  const [bmin, bmax] = state.budget;
  // A hard filter, not a weight: "with S Pen" narrows the candidate pool to
  // the Ultra/Fold tiers (the only real S Pen-capable models in the
  // catalogue) before ranking, rather than hoping a heavier weight happens
  // to surface one.
  const candidates = state.requireSPen ? PHONES.filter(p => SPEN_MODELS_RE.test(p.model_name)) : PHONES;
  const top3 = rankResults(recommend(state.weights, bmin, bmax, candidates), 3);

  document.getElementById("matches-sub").textContent =
    state.requireSPen ? `${state.label} · S Pen models only` : state.label;

  const list = document.getElementById("rec-list");
  list.innerHTML = top3.map((p, i) => recRow(i, p)).join("");
  requestAnimationFrame(() => requestAnimationFrame(() =>
    list.querySelectorAll(".sub-fill").forEach(el => el.style.width = el.dataset.w + "%")));
  list.querySelectorAll(".rec-why").forEach(btn =>
    btn.addEventListener("click", () => btn.nextElementSibling.classList.toggle("open")));

  const selectResult = (index) => {
    if (!Number.isInteger(index) || index < 0 || index >= top3.length) return;
    if (deck && typeof deck.select === "function") deck.select(index);
    list.querySelectorAll(".rec-row").forEach((row) => {
      const selected = Number(row.dataset.rank) === index;
      row.classList.toggle("hot", selected);
      row.setAttribute("aria-current", selected ? "true" : "false");
      row.querySelector(".breakdown")?.classList.toggle("open", selected);
    });
    document.getElementById("cs-stage")?.querySelectorAll(".cs-card").forEach((card) => {
      card.classList.toggle("is-selected", Number(card.dataset.rank) === index);
    });
    const row = list.querySelector(`.rec-row[data-rank="${index}"]`);
    if (row && window.matchMedia("(max-width: 1020px)").matches) {
      if (window.__lenis) window.__lenis.scrollTo(row, { offset: -80 });
      else row.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  list.querySelectorAll(".rec-row").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest(".rec-why") || event.target.closest(".breakdown")) return;
      selectResult(Number(row.dataset.rank));
    });
  });

  enhanceTopExplanation(top3[0]);

  const stage = document.getElementById("cs-stage");
  if (deck) deck.destroy();
  stage.innerHTML = top3.map((p, i) => deckCard(i, p)).join("");
  deck = initCardSwap(stage, {
    cardDistance: 55, verticalDistance: 64, delay: 4500,
    pauseOnHover: true, skewAmount: 5, easing: "elastic",
    onCardClick: (idx) => selectResult(idx),
  });
  selectResult(0);
}

function renderChips() {
  const host = document.getElementById("persona-chips");
  host.innerHTML = Object.entries(PERSONAS).map(([id, p]) =>
    `<button class="chip" data-id="${id}" aria-pressed="${id === state.personaId}">${p.name}</button>`).join("");
  host.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => {
    const id = chip.dataset.id, p = PERSONAS[id];
    state = { weights: p.weights, budget: [p.budget_min, p.budget_max],
      personaId: id, label: `For ${p.name} — ${p.need}`, requireSPen: false };
    history.replaceState(null, "", `?persona=${id}`);
    host.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.id === id));
    paint();
  }));
}

async function boot() {
  await loadPhones();
  state = readParams();
  renderChips(); // leave the persona chips available as a recovery path
  if (state.blocked) {
    document.getElementById("matches-sub").textContent = state.message;
    document.getElementById("rec-list").innerHTML = "";
    document.getElementById("cs-stage").innerHTML = "";
    return;
  }
  paint();
}
boot();
