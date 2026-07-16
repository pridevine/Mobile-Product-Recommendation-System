/* results.js — "Your Top 3 Matches": ranked list + CardSwap deck.
   Reads the choice from the URL (?persona=riya or ?q=<free text>) so
   results stay shareable. Re-renders (and re-inits the deck) on chip switch. */

let state = { weights: null, budget: [0, 1e9], personaId: null, label: "" };
let deck = null; // active CardSwap instance

const SUBS = [["camera_score", "Camera"], ["performance_score", "Performance"],
  ["battery_score", "Battery"], ["display_score", "Display"], ["value_score", "Value"]];

function readParams() {
  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  const persona = params.get("persona");
  if (q) {
    const prefs = extractPreferences(q);
    return { weights: prefs.weights, budget: [prefs.budget_min, prefs.budget_max],
      personaId: null, label: "Based on what you told us" };
  }
  // Track PERSONAS rather than hardcoding an id — a stale hardcoded "arjun"
  // is exactly what left the notebook dropdown throwing TraitError for two days
  // after Member 2 renamed the personas.
  const id = persona && PERSONAS[persona] ? persona : Object.keys(PERSONAS)[0];
  const p = PERSONAS[id];
  return { weights: p.weights, budget: [p.budget_min, p.budget_max],
    personaId: id, label: `For ${p.name} — ${p.need}` };
}

function inr(n) { return "₹" + n.toLocaleString("en-IN"); }

// Progressive enhancement: the card already shows the local template. Ask the
// serverless function (which holds the API key) for a grounded Gemini
// explanation and swap it in if it comes back. Any failure leaves the template
// in place — the card is never blank, and the page never blocks on this.
async function enhanceTopExplanation(p) {
  const el = document.getElementById("rec-explain");
  if (!el || !p) return;
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
    }
  } catch (_) {
    /* offline, or no /api (e.g. opened as a file): keep the template */
  } finally {
    el.classList.remove("rec-why-loading");
  }
}

function recRow(rank, p) {
  const subRows = SUBS.map(([col, label]) =>
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
        <span class="rec-rank">${rank + 1}</span>
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
  const top3 = rankResults(recommend(state.weights, bmin, bmax, PHONES), 3);

  document.getElementById("matches-sub").textContent = state.label;

  const list = document.getElementById("rec-list");
  list.innerHTML = top3.map((p, i) => recRow(i, p)).join("");
  requestAnimationFrame(() => requestAnimationFrame(() =>
    list.querySelectorAll(".sub-fill").forEach(el => el.style.width = el.dataset.w + "%")));
  list.querySelectorAll(".rec-why").forEach(btn =>
    btn.addEventListener("click", () => btn.nextElementSibling.classList.toggle("open")));

  enhanceTopExplanation(top3[0]);

  const stage = document.getElementById("cs-stage");
  if (deck) deck.destroy();
  stage.innerHTML = top3.map((p, i) => deckCard(i, p)).join("");
  deck = initCardSwap(stage, {
    cardDistance: 55, verticalDistance: 64, delay: 4500,
    pauseOnHover: true, skewAmount: 5, easing: "elastic",
    onCardClick: (idx) => {
      // clicking a card highlights + opens its row
      list.querySelectorAll(".rec-row").forEach(r => r.classList.remove("hot"));
      const row = list.querySelector(`.rec-row[data-rank="${idx}"]`);
      if (row) {
        row.classList.add("hot");
        row.querySelector(".breakdown").classList.add("open");
        if (window.__lenis) window.__lenis.scrollTo(row, { offset: -80 });
        else row.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
  });
}

function renderChips() {
  const host = document.getElementById("persona-chips");
  host.innerHTML = Object.entries(PERSONAS).map(([id, p]) =>
    `<button class="chip" data-id="${id}" aria-pressed="${id === state.personaId}">${p.name}</button>`).join("");
  host.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => {
    const id = chip.dataset.id, p = PERSONAS[id];
    state = { weights: p.weights, budget: [p.budget_min, p.budget_max],
      personaId: id, label: `For ${p.name} — ${p.need}` };
    history.replaceState(null, "", `?persona=${id}`);
    host.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.id === id));
    paint();
  }));
}

async function boot() {
  await loadPhones();
  state = readParams();
  renderChips();
  paint();
}
boot();
