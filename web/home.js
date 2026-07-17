/* home.js — shared wiring for index.html (hero only) and personas.html.
   Each page carries only a subset of these elements, so every hook is
   guarded. Nav and CTA links are plain <a href> now and need no JS. */

// personas.html — a card click routes to results (results.js reads the param).
document.querySelectorAll(".p-card").forEach((card) => {
  card.addEventListener("click", () => {
    location.href = `results.html?persona=${card.dataset.persona}`;
  });
});

// personas.html — free-text search.
const input = document.getElementById("describe-input");
if (input) {
  const button = document.getElementById("describe-go");
  const feedback = document.getElementById("describe-feedback");
  const showFeedback = (text) => {
    if (feedback) { feedback.textContent = text; feedback.hidden = false; }
    button.disabled = false;
    button.textContent = "Find my Galaxy";
  };

  // Prefill with the last description so a shopper can tweak it instead of
  // retyping from scratch -- e.g. bump the budget or add a persona detail.
  const LAST_QUERY_KEY = "gm_last_query";
  const lastQuery = localStorage.getItem(LAST_QUERY_KEY);
  if (lastQuery) {
    input.value = lastQuery;
    input.setSelectionRange(lastQuery.length, lastQuery.length);
  }

  const go = async () => {
    if (!input.value.trim()) { input.focus(); return; }
    // Checked before spending a network round trip: a banned browser gets
    // the same restriction message immediately, every time, until it lifts.
    if (AIGuard.isBanned()) { showFeedback(AIGuard.banMessage()); return; }
    const query = input.value.trim();
    localStorage.setItem(LAST_QUERY_KEY, query);
    button.disabled = true;
    button.textContent = "Finding...";
    let profile = null;
    // Exact-text cache: re-submitting the same description during a demo
    // rehearsal reuses the prior parse instead of spending quota on an
    // identical request. isDown() skips the call entirely once this session
    // has already seen the API fail a couple of times in a row.
    const cacheKey = `parse:${query}`;
    const cached = AIGuard.cacheGet(cacheKey);
    if (cached) {
      profile = cached;
    } else if (!AIGuard.isDown()) {
      try {
        const response = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = await response.json();
        if (data && data.blocked) {
          // Only a genuine "abuse" reason counts as a strike -- asking about
          // an iPhone, or writing too much, is never grounds for a ban.
          if (data.reason === "abuse") {
            showFeedback(AIGuard.recordAbuseStrike().message);
          } else {
            showFeedback(data.message || "I can help you choose a Galaxy phone. Tell me your budget and priorities.");
          }
          return;
        }
        profile = data && data.profile;
        AIGuard.noteResult(Boolean(profile));
        if (profile) AIGuard.cacheSet(cacheKey, profile);
      } catch (_) {
        // Local extraction on results.html remains the offline fallback.
        AIGuard.noteResult(false);
      }
    }
    const params = new URLSearchParams({ q: query });
    if (profile) params.set("profile", JSON.stringify(profile));
    location.href = `results.html?${params.toString()}`;
  };
  button.addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });

  // Hitting the browser Back button after a successful search restores this
  // page from bfcache exactly as it was left -- button mid-"Finding...",
  // disabled -- with no new page load to re-run this script. Reset it so
  // Back doesn't permanently strand the search box.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      button.disabled = false;
      button.textContent = "Find my Galaxy";
    }
  });
}
