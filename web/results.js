/* results.js — "Your Top 3 Matches" page. Reads the choice from the URL
   (?persona=arjun or ?q=<free text>) so results are shareable. */

let state = { weights: null, budget: [0, 1e9], personaId: null, label: "" };

function readParams() {
  const params = new URLSearchParams(location.search);
  const q = params.get("q");
  const persona = params.get("persona");
  if (q) {
    const prefs = extractPreferences(q);
    return { weights: prefs.weights, budget: [prefs.budget_min, prefs.budget_max],
      personaId: null, label: "Based on what you told us" };
  }
  const id = persona && PERSONAS[persona] ? persona : "arjun";
  const p = PERSONAS[id];
  return { weights: p.weights, budget: [p.budget_min, p.budget_max],
    personaId: id, label: `For ${p.name} — ${p.need}` };
}

function paint() {
  const [bmin, bmax] = state.budget;
  const top3 = rankResults(recommend(state.weights, bmin, bmax, PHONES), 3);
  const host = document.getElementById("cards");
  host.innerHTML = top3.map((p, i) => renderCard(i, p, state.weights)).join("");
  document.getElementById("matches-sub").textContent = state.label;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    host.querySelectorAll(".sub-fill").forEach(el => el.style.width = el.dataset.w + "%");
  }));
  host.querySelectorAll(".why-btn").forEach(btn => btn.addEventListener("click", () => {
    btn.nextElementSibling.classList.toggle("open");
  }));
}

function renderChips() {
  const host = document.getElementById("persona-chips");
  host.innerHTML = Object.entries(PERSONAS).map(([id, p]) =>
    `<button class="persona-chip" data-id="${id}" aria-pressed="${id === state.personaId}">${p.name}</button>`).join("");
  host.querySelectorAll(".persona-chip").forEach(chip => chip.addEventListener("click", () => {
    const id = chip.dataset.id, p = PERSONAS[id];
    state = { weights: p.weights, budget: [p.budget_min, p.budget_max], personaId: id, label: `For ${p.name} — ${p.need}` };
    history.replaceState(null, "", `?persona=${id}`);
    host.querySelectorAll(".persona-chip").forEach(c => c.setAttribute("aria-pressed", c.dataset.id === id));
    paint();
  }));
}

function initChrome() {
  document.getElementById("nav-icons").innerHTML = ICON.search + ICON.cart + ICON.user;
  document.getElementById("hero-eyebrow-icon").innerHTML = ICON.spark;
  document.getElementById("hero-phone").innerHTML = heroPhoneVisual();
  document.getElementById("trust-icon").innerHTML = ICON.shield;
  const feats = [["shield", "Transparent Scoring", "See why each phone ranks higher."],
    ["check", "No Bias, Just Facts", "Data-driven. User-focused."],
    ["lock", "Your Priorities", "Matches based on what matters to you."],
    ["spark", "Smart. Simple. Samsung.", "Technology that works for you."]];
  document.getElementById("features").innerHTML = feats.map(([ic, t, s]) =>
    `<div class="feature"><div class="feature-ic">${ICON[ic]}</div><div><b>${t}</b><span>${s}</span></div></div>`).join("");
}

async function boot() {
  await loadPhones();
  state = readParams();
  initChrome();
  renderChips();
  paint();
}
boot();
