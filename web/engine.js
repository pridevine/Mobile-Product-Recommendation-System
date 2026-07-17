/* GalaxyMatch AI — browser port of the Python recommendation engine.
   Same weighted-sum logic, personas, templates, and phone illustrations. */

// ---------- Personas ----------
// Mirrors src/personas.py exactly (Member 2's definitions). Ids, names, budgets
// and weights must match, or the site and the notebook rank the same shopper
// differently and neither is wrong-looking enough to notice.
const PERSONAS = {
  mukesh: { name: "Mukesh Patel", need: "Grocery store owner — WhatsApp Business, UPI, video calls",
    budget_min: 15000, budget_max: 23000,
    weights: { camera: 0.09, performance: 0.09, battery: 0.27, display: 0.10, value: 0.45 } },
  kabir: { name: "Kabir Mehta", need: "CS student and mobile gamer — BGMI, COD Mobile",
    budget_min: 25000, budget_max: 38000,
    weights: { camera: 0.08, performance: 0.40, battery: 0.24, display: 0.20, value: 0.08 } },
  riya: { name: "Riya Sharma", need: "Travel content creator — photos and Instagram reels",
    budget_min: 38000, budget_max: 47000,
    weights: { camera: 0.40, performance: 0.08, battery: 0.16, display: 0.20, value: 0.16 } },
  ananya: { name: "Ananya Rao", need: "Management consultant who travels for client meetings",
    budget_min: 87000, budget_max: 175000,
    weights: { camera: 0.16, performance: 0.16, battery: 0.32, display: 0.20, value: 0.16 } },
};

const DIMENSIONS = ["camera", "performance", "battery", "display", "value"];

// ---------- Engine (ported from src/recommender.py) ----------
function calculateScore(p, w) {
  return p.camera_score * w.camera + p.performance_score * w.performance
    + p.battery_score * w.battery + p.display_score * w.display + p.value_score * w.value;
}

function recommend(weights, budgetMin, budgetMax, phones) {
  const scored = phones.map(p => ({ ...p, match_score: calculateScore(p, weights) }));
  const inBudget = scored.filter(p => p.price_inr >= budgetMin && p.price_inr <= budgetMax);
  const pool = inBudget.length >= 3 ? inBudget : scored;
  return pool.sort((a, b) => b.match_score - a.match_score);
}

function rankResults(scored, topN = 3) {
  return scored.slice(0, topN).map(p => {
    const pct = Math.min(99, Math.round(p.match_score / 10 * 100));
    return { ...p, match_pct: pct, confidence: confidenceLabel(pct) };
  });
}

function confidenceLabel(pct) {
  if (pct >= 95) return "⭐⭐⭐⭐⭐ Perfect Match";
  if (pct >= 90) return "⭐⭐⭐⭐ Excellent Match";
  if (pct >= 80) return "⭐⭐⭐ Great Match";
  if (pct >= 70) return "⭐⭐ Good Match";
  return "⭐ Fair Match";
}

// ---------- Explanations (ported from src/ai_assistant.py template path) ----------
function strongestFeature(p) {
  const f = { camera: p.camera_score, performance: p.performance_score,
    battery: p.battery_score, display: p.display_score, value: p.value_score };
  return Object.keys(f).reduce((a, b) => (f[a] >= f[b] ? a : b));
}

function generateExplanation(weights, p) {
  const dominant = Object.keys(weights).reduce((a, b) => (weights[a] >= weights[b] ? a : b));
  const strongest = strongestFeature(p);
  const m = p.model_name;
  if (dominant === strongest) {
    const t = {
      camera: `${m} is an excellent choice because its outstanding camera quality perfectly matches your photography priorities.`,
      performance: `${m} delivers powerful performance that keeps up with demanding use and won't slow down mid-task.`,
      battery: `${m} offers impressive battery life, making it ideal for long workdays and travel.`,
      display: `${m} has a standout display that's great for photos, video, and long reading sessions.`,
      value: `${m} provides excellent value for money while delivering balanced overall performance.`,
    };
    return t[dominant];
  }
  return `${m} provides a balanced combination of ${strongest} performance while still aligning well with your personal preferences.`;
}

// ---------- Free-text extraction (ported from src/personas.py) ----------
// Mirrors api/safety.js's COMPETITOR_RE / ABUSE_RE / THREAT_RE. This is a
// client-only, no-network path (used when /api/parse was skipped by
// AIGuard's circuit breaker, or failed), so it needs its own screen. Two
// gaps without it: "recommend me an iPhone" matches no KEYWORDS below and
// quietly returns a Samsung phone as if understood, and — the one that
// mattered more — abusive text had NO screening at all on this path, only
// the competitor check, since it was added later and never backfilled here.
const COMPETITOR_RE = /\b(?:iphone|apple|pixel|google pixel|oneplus|xiaomi|redmi|oppo|vivo|realme)\b/i;
const ABUSE_RE = /\b(?:fuck(?:ing|ed)?|shit(?:ty)?|bitch|asshole|bastard|dumbass|idiot|moron|stupid|dumb|loser|pathetic|jerk|trash|garbage|useless|worthless|suck(?:s|ed)?)\b|\bshut\s+up\b|\bscrew\s+you\b/i;
// Mirrors api/safety.js's SLUR_RE -- racial, ethnic, homophobic, and ableist
// slurs, checked separately so they're always a strike no matter what else
// the message says.
const SLUR_RE = /\b(?:n[i1]gg(?:er|a|ers|as)?|f[a4]gg?[o0]t|ch[i1]nk|sp[i1]c|wetback|g[o0]{2}k|k[i1]ke|c[o0]{2}n|r[e3]t[a4]rd(?:ed)?|tr[a4]nny|p[a4]ki)\b/i;
const THREAT_RE = /\b(?:kill|hurt|attack|bomb|shoot)\s+(?:you|yourself|me|someone|people)\b/i;
// Mirrors api/safety.js's UNKNOWN_MODEL_RE. Real catalogue model numbers are
// always 1-2 digits (S26, A57, Fold7) -- a 3+ digit number right after
// "samsung"/"galaxy"/"model" (e.g. "samsung 11100") can't be a real model, so
// say so instead of quietly recommending an unrelated phone. Adjacency is
// deliberately tight (no free-floating phrase like "phone under") so this
// never fires on an ordinary budget mention such as "galaxy phone under 30000".
const UNKNOWN_MODEL_RE = /\b(?:samsung|galaxy)\s+(?:galaxy\s+)?[a-z]{0,5}-?\s?(\d{3,6})\b|\bmodel(?:\s+number)?\s*[:#]?\s*[a-z]{0,5}-?\s?(\d{3,6})\b/i;
// Real S Pen support in this catalogue: the Ultra tier (built-in) and Z Fold
// (compatible, sold separately) -- matches actual Samsung product lines, not
// a guess. Flip and A/M/F series don't support it.
const SPEN_RE = /\bs[\s-]?pen\b/i;
const SPEN_MODELS_RE = /\bultra\b|\bfold\d*\b/i;
const SAMSUNG_ONLY_MESSAGE =
  "We provide recommendations for Samsung Galaxy phones only. Tell me your budget and what matters most — camera, gaming, battery, display, or value.";
const SAFE_REDIRECT_MESSAGE =
  "I can help you choose a Samsung Galaxy phone. Tell me your budget and what matters most, such as camera, gaming, battery, display, or value.";
const UNKNOWN_MODEL_MESSAGE =
  "We couldn't find that model in our Samsung Galaxy lineup. Tell me your budget and priorities instead — camera, gaming, battery, display, or value — and I'll match you to a real Galaxy phone.";

// `reason` mirrors api/safety.js's contract: only "abuse" should ever count
// as a strike toward AIGuard's warn-then-restrict escalation.
function screenQuery(text) {
  const raw = String(text || "");
  if (ABUSE_RE.test(raw) || SLUR_RE.test(raw) || THREAT_RE.test(raw)) {
    return { blocked: true, message: SAFE_REDIRECT_MESSAGE, reason: "abuse" };
  }
  if (UNKNOWN_MODEL_RE.test(raw)) {
    return { blocked: true, message: UNKNOWN_MODEL_MESSAGE, reason: "unknown_model" };
  }
  if (COMPETITOR_RE.test(raw)) {
    return { blocked: true, message: SAMSUNG_ONLY_MESSAGE, reason: "competitor" };
  }
  return { blocked: false, message: "", reason: null };
}

const KEYWORDS = {
  performance: /bgmi|pubg|gam(e|ing)|fps|fortnite/,
  camera: /camera|photo|wedding|shoot|photograph/,
  battery: /travel|consult|client|business trip|meeting|battery/,
  display: /screen|display|amoled|watch(ing)? (video|movie)|streaming/,
  value: /simple|whatsapp|upi|affordable|small business|budget|calls/,
};
function extractPreferences(text) {
  const t = text.toLowerCase();
  const budget = extractBudgetInr(t) || 40000;
  let weights = { camera: 0.15, performance: 0.2, battery: 0.25, display: 0.15, value: 0.25 };
  for (const [dim, re] of Object.entries(KEYWORDS)) {
    if (re.test(t)) {
      weights = {}; DIMENSIONS.forEach(d => weights[d] = d === dim ? 0.5 : 0.5 / 4);
      break;
    }
  }
  return { weights, budget_min: Math.max(1000, Math.round(budget * 0.85)),
    budget_max: Math.min(300000, Math.round(budget * 1.15)) };
}

// Parse Indian budget language before any model is involved. This keeps the
// offline browser fallback consistent with /api/parse and handles phrases such
// as "1 lakh", "1.2 lac", "₹1,00,000", and "30k".
function extractBudgetInr(text) {
  const value = String(text || "").replace(/,/g, "");
  const lakh = value.match(/(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const thousand = value.match(/(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/i);
  if (thousand) return Math.round(Number(thousand[1]) * 1000);
  const currency = value.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (currency) return Math.round(Number(currency[1]));
  const contextual = value.match(/(?:budget|spend|price|under|upto|up to|maximum|max|around|within)\s*(?:is|of|:)?\s*(?:₹|rs\.?|inr)?\s*(\d{4,7})\b/i);
  return contextual ? Number(contextual[1]) : null;
}

// ---------- Badges (ported from src/badges.py) ----------
function assignBadges(phones) {
  const map = {}; phones.forEach(p => map[p.model_name] = []);
  const cols = { camera_score: "Best Camera", performance_score: "Gaming Beast",
    value_score: "Best Value", battery_score: "Marathon Battery", display_score: "Best Display" };
  for (const col of Object.keys(cols)) {
    const top = phones.reduce((a, b) => (a[col] >= b[col] ? a : b));
    map[top.model_name].push(cols[col]);
  }
  return map;
}

// ---------- Icons ----------
const ICON = {
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0l2.4 9.6L24 12l-9.6 2.4L12 24l-2.4-9.6L0 12l9.6-2.4z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="14" r="3.5"/></svg>',
  battery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="2" y="7" width="17" height="10" rx="2"/><path d="M22 10v4"/><path d="M6 10v4" stroke-width="2.4"/></svg>',
  rupee: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 4h12M6 8h12M9 4c4 0 4 8-1 8H8l6 8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h3l2.4 12.5a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
};

// ---------- Colored phone illustration (light theme, premium) ----------
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v));
  const r = c((n >> 16) + amt), g = c(((n >> 8) & 255) + amt), b = c((n & 255) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// A realistic camera lens: metallic ring, deep glass (radial gradient), rim + glint.
function lens(cx, cy, r, uid) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#e9ebef"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#a7abb5" stroke-width="0.7"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.74).toFixed(2)}" fill="url(#lg${uid})"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.74).toFixed(2)}" fill="none" stroke="rgba(0,0,0,0.35)" stroke-width="0.5"/>`
    + `<circle cx="${(cx - r * 0.26).toFixed(2)}" cy="${(cy - r * 0.28).toFixed(2)}" r="${(r * 0.18).toFixed(2)}" fill="rgba(255,255,255,0.8)"/>`
    + `<circle cx="${(cx + r * 0.22).toFixed(2)}" cy="${(cy + r * 0.24).toFixed(2)}" r="${(r * 0.1).toFixed(2)}" fill="rgba(120,150,255,0.35)"/>`;
}
function flash(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="1.9" fill="#f4edc8"/><circle cx="${cx}" cy="${cy}" r="1.9" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="0.4"/>`;
}

function cameraGroup(family, uid) {
  if (family === "ultra") return lens(19, 16, 5.2, uid) + lens(19, 30, 5.2, uid) + lens(19, 44, 5.2, uid)
    + lens(32, 22, 3.7, uid) + flash(32, 34);
  if (family === "island") return `<rect x="11.5" y="9" width="18" height="43" rx="9" fill="#1c1f29"/>`
    + `<rect x="11.5" y="9" width="18" height="43" rx="9" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="0.6"/>`
    + lens(20.5, 19, 4.1, uid) + lens(20.5, 30.5, 4.1, uid) + lens(20.5, 42, 4.1, uid) + flash(34, 13);
  if (family === "dual") return lens(20, 19, 4.8, uid) + lens(20, 33, 4.8, uid) + flash(20, 45);
  if (family === "flip") return `<line x1="7" y1="64" x2="57" y2="64" stroke="rgba(0,0,0,0.14)" stroke-width="1"/>`
    + `<rect x="28" y="8" width="25" height="18" rx="4.5" fill="#12141c"/>` + lens(18, 15, 4.2, uid) + lens(18, 28, 4.2, uid);
  return lens(20, 18, 4.9, uid) + lens(20, 31.5, 4.9, uid) + lens(20, 45, 4.9, uid) + flash(31.5, 18);
}

let _svgUid = 0;
function phoneSVG(color, family) {
  const uid = ++_svgUid;
  const hi = shade(color, 26), lo = shade(color, -34), frame = shade(color, -52);
  return `<svg viewBox="0 0 64 130" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 14px 22px rgba(20,20,50,0.22));">
    <defs>
      <linearGradient id="bd${uid}" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0" stop-color="${hi}"/><stop offset="0.5" stop-color="${color}"/><stop offset="1" stop-color="${lo}"/>
      </linearGradient>
      <radialGradient id="lg${uid}" cx="0.38" cy="0.34" r="0.75">
        <stop offset="0" stop-color="#31353f"/><stop offset="0.55" stop-color="#15171f"/><stop offset="1" stop-color="#05060a"/>
      </radialGradient>
    </defs>
    <rect x="5" y="2" width="54" height="126" rx="16" fill="${frame}"/>
    <rect x="6.2" y="3.2" width="51.6" height="123.6" rx="14.5" fill="url(#bd${uid})"/>
    <path d="M10 6 Q10 5 12 5 L34 5 Q20 26 12 54 Q9 40 9 12 Q9 6 10 6 Z" fill="rgba(255,255,255,0.16)"/>
    ${cameraGroup(family, uid)}
    <text x="32" y="115" text-anchor="middle" font-family="Onest,sans-serif" font-weight="700" font-size="6.5" letter-spacing="1" fill="rgba(255,255,255,0.5)">SAMSUNG</text>
  </svg>`;
}

// Large hero phone — angled body bleeding off-right, three big realistic lenses.
function heroPhone() {
  const uid = ++_svgUid;
  return `<svg viewBox="0 0 460 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="hb${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#eef0f4"/><stop offset="0.5" stop-color="#d6d9e0"/><stop offset="1" stop-color="#b9bdc7"/>
      </linearGradient>
      <radialGradient id="hl${uid}" cx="0.38" cy="0.34" r="0.8">
        <stop offset="0" stop-color="#34383f"/><stop offset="0.55" stop-color="#16181d"/><stop offset="1" stop-color="#050609"/>
      </radialGradient>
    </defs>
    <g transform="rotate(9 230 180)">
      <rect x="120" y="-70" width="380" height="500" rx="60" fill="#aeb2bc"/>
      <rect x="127" y="-63" width="366" height="486" rx="54" fill="url(#hb${uid})"/>
      <path d="M150 -40 Q150 -50 165 -50 L300 -50 Q210 120 175 320 Q150 200 150 -20 Z" fill="rgba(255,255,255,0.4)"/>
      ${[70, 168, 266].map(cy => `
        <circle cx="200" cy="${cy}" r="40" fill="#eceef1"/>
        <circle cx="200" cy="${cy}" r="40" fill="none" stroke="#a2a6b0" stroke-width="2.5"/>
        <circle cx="200" cy="${cy}" r="29" fill="url(#hl${uid})"/>
        <circle cx="200" cy="${cy}" r="29" fill="none" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"/>
        <circle cx="188" cy="${cy - 11}" r="7.5" fill="rgba(255,255,255,0.85)"/>
        <circle cx="211" cy="${cy + 10}" r="4" fill="rgba(120,150,255,0.4)"/>`).join("")}
      <circle cx="272" cy="82" r="8" fill="#f4edc8"/><circle cx="272" cy="82" r="8" fill="none" stroke="rgba(0,0,0,0.15)" stroke-width="1.2"/>
    </g>
  </svg>`;
}

// ---------- Shared data + card rendering ----------
let PHONES = [];
let BADGES = {};
const SUBS = [["camera_score", "Camera"], ["performance_score", "Performance"],
  ["battery_score", "Battery"], ["display_score", "Display"], ["value_score", "Value"]];

async function loadPhones() {
  if (PHONES.length) return PHONES;
  PHONES = await fetch("data/phones.json").then(r => r.json());
  BADGES = assignBadges(PHONES);
  return PHONES;
}

// Map the dataset's tier labels ("Flagship (S Pen)", "Upper Mid-range", ...)
// to a clean chip class + a short display label.
function segKey(seg) {
  const s = (seg || "").toLowerCase();
  if (s.includes("foldable")) return "foldable";
  if (s.includes("flagship")) return "flagship";
  if (s.includes("upper")) return "uppermid";
  if (s.includes("budget")) return "budget";
  if (s.includes("mid")) return "mid";
  return "mid";
}
function segShort(seg) {
  const s = (seg || "").toLowerCase();
  if (s.includes("s pen")) return "Flagship · S Pen";
  if (s.includes("foldable")) return "Foldable";
  if (s.includes("flagship")) return "Flagship";
  if (s.includes("upper")) return "Upper Mid";
  if (s.includes("budget")) return "Budget";
  if (s.includes("mid")) return "Mid-range";
  return seg;
}
function segClass(rank, seg) { return rank === 0 ? "best" : segKey(seg); }
function segLabel(rank, seg) { return rank === 0 ? "Best Match" : segShort(seg); }

// Verified live on samsung.com/in (2026-07-17) -- real product pages, not
// guessed slugs. Only a sample of the catalogue has one; every other model
// falls back to Samsung's own search page for that name, which always
// resolves to a real Samsung page without us guessing a URL that could 404.
const OFFICIAL_LINKS = {
  "Galaxy S26 Ultra": "https://www.samsung.com/in/smartphones/galaxy-s26-ultra/buy/",
  "Galaxy Z Fold7": "https://www.samsung.com/in/smartphones/galaxy-z-fold7/buy/",
  "Galaxy A56 5G": "https://www.samsung.com/in/smartphones/galaxy-a56/buy/",
  "Galaxy M55 5G": "https://www.samsung.com/in/smartphones/galaxy-m/galaxy-m55-5g-black-256gb-sm-m556bzkdins/",
};
function phoneShopUrl(p) {
  return OFFICIAL_LINKS[p.model_name] || `https://www.samsung.com/in/search/?searchvalue=${encodeURIComponent(p.model_name)}`;
}

// Real photo if present in assets/phones/<slug>.png, else the drawn SVG.
// Uses <img onerror> so no server-side check is needed on a static site.
function phoneSlug(model) {
  return model.toLowerCase().replace(/\+/g, "_plus").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
// Shared product renders keep the catalogue visually consistent without
// needing a separate image for every model.
function phoneGroup(model) {
  const m = (model || "").toLowerCase();
  if (/galaxy s(?:26|25) ultra/.test(m)) return "premium-ultra";
  if (/galaxy s(?:26|25|24)(?:\+)?$/.test(m)) return "standard-s";
  if (/galaxy a(?:57|56|55|54)\b|galaxy [mf](?:56|55)\b/.test(m)) return "a5x";
  if (/galaxy a(?:37|36|35|34|26|25|24)\b|galaxy [mf]36\b/.test(m)) return "a3x-a2x";
  if (/galaxy a(?:17|16|15|14)\b|galaxy [mf]16\b/.test(m)) return "budget";
  if (/galaxy z fold/.test(m)) return "fold";
  if (/galaxy z flip/.test(m)) return "flip";
  return null;
}
function phoneImageSource(model) {
  const group = phoneGroup(model);
  return group ? `assets/phone-groups/${group}.png` : `assets/phones/${phoneSlug(model)}.png`;
}
function phoneVisual(p) {
  return `<img class="phone-photo" src="${phoneImageSource(p.model_name)}" alt="${p.model_name}"
    data-color="${p.color}" data-family="${p.family}" onerror="phoneImgFallback(this)">`;
}
function phoneImgFallback(img) {
  if (img.parentElement) img.parentElement.innerHTML = phoneSVG(img.dataset.color, img.dataset.family);
}
function heroPhoneVisual() {
  return `<img class="hero-photo" src="assets/phones/hero.png" alt="Samsung Galaxy" onerror="heroImgFallback(this)">`;
}
function heroImgFallback(img) {
  if (img.parentElement) img.parentElement.innerHTML = heroPhone();
}

function renderCard(rank, p, weights) {
  const badges = BADGES[p.model_name] || [];
  const subRows = SUBS.map(([col, label]) =>
    `<div class="sub-row"><span class="sub-label">${label}</span>
       <div class="sub-track"><div class="sub-fill" data-w="${p[col] * 10}"></div></div>
       <span class="sub-val">${p[col].toFixed(1)}</span></div>`).join("");
  return `<article class="card${rank === 0 ? " best" : ""}">
    <div class="card-head">
      <div class="card-head-left">
        <span class="rank-sq">${rank + 1}</span>
        <span class="seg-chip ${segClass(rank, p.target_segment)}">${segLabel(rank, p.target_segment)}</span>
      </div>
      <div class="match-box"><div class="match-pct">${p.match_pct}%</div><div class="match-label">Match Score</div></div>
    </div>
    <div class="card-mid">
      <div class="phone-holder">${phoneVisual(p)}</div>
      <div class="card-body">
        <h3>${p.model_name}</h3>
        <p>${generateExplanation(weights, p)}</p>
      </div>
    </div>
    <div class="card-specs">
      <div class="spec">${ICON.camera}<div><b>${p.camera_mp}MP</b><span>Camera</span></div></div>
      <div class="spec">${ICON.battery}<div><b>${p.battery_mah}mAh</b><span>Battery</span></div></div>
      <div class="spec">${ICON.rupee}<div><b>₹${p.price_inr.toLocaleString("en-IN")}</b><span>Price</span></div></div>
    </div>
    <button class="why-btn" data-rank="${rank}">View why this score? ${ICON.arrow}</button>
    <div class="breakdown"><div class="breakdown-inner">${subRows}
      <div class="confidence">${p.confidence}</div></div></div>
  </article>`;
}
