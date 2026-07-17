/* ai-guard.js — quota guardrails for /api/explain and /api/parse.
   Loaded before home.js and results.js on every page so both share one
   circuit breaker via sessionStorage (same tab, resets on tab close).

   The free tier is 20 requests/day PER MODEL. Two things burn it for no
   reason: re-clicking the same persona during a demo rehearsal re-asks a
   question already answered, and once the day's quota is dead the site
   still tries on every render, paying a network round-trip for a call that
   cannot succeed. This file fixes both, client-side, with no backend state. */

const AIGuard = (() => {
  const DOWN_KEY = "gm_ai_down_until";
  const DOWN_AFTER_FAILURES = 2;   // consecutive failures before we stop asking
  const DOWN_COOLDOWN_MS = 5 * 60 * 1000; // re-try after 5 min, in case it was transient
  let consecutiveFailures = 0;

  function isDown() {
    const until = Number(sessionStorage.getItem(DOWN_KEY) || 0);
    return Date.now() < until;
  }

  function noteResult(succeeded) {
    if (succeeded) { consecutiveFailures = 0; return; }
    consecutiveFailures += 1;
    if (consecutiveFailures >= DOWN_AFTER_FAILURES) {
      sessionStorage.setItem(DOWN_KEY, String(Date.now() + DOWN_COOLDOWN_MS));
    }
  }

  // Cache is keyed by caller-supplied key (e.g. phone name + weights, or the
  // exact free-text query) so repeated identical asks reuse a prior answer
  // instead of spending quota on output we already have.
  function cacheGet(key) {
    try { return JSON.parse(sessionStorage.getItem("gm_ai_cache:" + key) || "null"); }
    catch (_) { return null; }
  }
  function cacheSet(key, value) {
    try { sessionStorage.setItem("gm_ai_cache:" + key, JSON.stringify(value)); }
    catch (_) { /* storage full or disabled — degrade to no cache */ }
  }

  // Escalating abuse guard: warn on the first abusive/threatening input,
  // restrict for 24h on the second. localStorage (not sessionStorage) on
  // purpose — a ban needs to outlive closing the tab. This is honestly
  // client-side and per-browser: it stops someone from repeating abuse in
  // the same session (the realistic case during a demo), not a hardened,
  // server-tracked ban across devices — this is a static site with no
  // database, and that's the correct tradeoff for what this needs to do.
  const ABUSE_KEY = "gm_abuse_strikes";
  const BAN_KEY = "gm_abuse_ban_until";
  const BAN_MS = 24 * 60 * 60 * 1000;

  const WARNING_MESSAGE =
    "That kind of language isn't necessary here. Please rephrase — repeated abuse will restrict access to GalaxyMatch for 24 hours.";

  function isBanned() {
    const until = Number(localStorage.getItem(BAN_KEY) || 0);
    if (Date.now() < until) return true;
    if (until) { // ban has expired — clear it and give a clean slate
      localStorage.removeItem(BAN_KEY);
      localStorage.removeItem(ABUSE_KEY);
    }
    return false;
  }

  function banMessage() {
    const until = Number(localStorage.getItem(BAN_KEY) || 0);
    const hrs = Math.max(1, Math.ceil((until - Date.now()) / (60 * 60 * 1000)));
    return `You've been restricted for repeated abusive language. Try again in about ${hrs} hour${hrs === 1 ? "" : "s"}.`;
  }

  // Call ONLY when a block's reason was specifically "abuse" — never for
  // off-topic (competitor) or length-limit blocks, which are not abuse and
  // must never push someone toward a ban for asking about an iPhone.
  function recordAbuseStrike() {
    const count = Number(localStorage.getItem(ABUSE_KEY) || 0) + 1;
    localStorage.setItem(ABUSE_KEY, String(count));
    if (count >= 2) {
      localStorage.setItem(BAN_KEY, String(Date.now() + BAN_MS));
    }
    return { count, message: count >= 2 ? banMessage() : WARNING_MESSAGE };
  }

  return { isDown, noteResult, cacheGet, cacheSet, isBanned, banMessage, recordAbuseStrike };
})();
