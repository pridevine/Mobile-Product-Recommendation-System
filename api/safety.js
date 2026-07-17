// Shared, dependency-free safety helpers for the Vercel functions.
// This is defense in depth: the provider safety filters remain enabled too.

const SAFE_REDIRECT =
  "I can help you choose a Samsung Galaxy phone. Tell me your budget and what matters most, such as camera, gaming, battery, display, or value.";

// Keep this intentionally conservative. The model should handle ordinary
// frustration, while clearly abusive/threatening input is stopped before it
// reaches the provider. We do not log or echo the matched text.
const ABUSE_RE = /\b(?:fuck(?:ing|ed)?|shit(?:ty)?|bitch|asshole|dumbass|idiot|moron|stupid)\b/i;
const THREAT_RE = /\b(?:kill|hurt|attack|bomb|shoot)\s+(?:you|yourself|me|someone|people)\b/i;

const COMPETITOR_RE = /\b(?:iphone|apple|pixel|google pixel|oneplus|xiaomi|redmi|oppo|vivo|realme)\b/i;
const INTERNAL_SCORE_RE = /(?:match\s+score|\bscore\b|out\s+of\s+10|\/\s*10)/i;

function redactPii(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?\d[\d .()\-]{7,}\d)/g, "[phone removed]");
}

function extractBudgetInr(value) {
  const text = String(value || "").replace(/,/g, "");
  const lakh = text.match(/(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)\b/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);

  const thousand = text.match(/(?:₹|rs\.?|inr\s*)?\s*(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/i);
  if (thousand) return Math.round(Number(thousand[1]) * 1000);

  const currency = text.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i);
  if (currency) return Math.round(Number(currency[1]));

  const contextual = text.match(/(?:budget|spend|price|under|upto|up to|maximum|max|around|within)\s*(?:is|of|:)?\s*(?:₹|rs\.?|inr)?\s*(\d{4,7})\b/i);
  return contextual ? Number(contextual[1]) : null;
}

// `reason` distinguishes WHY a request was blocked, because the client uses
// it to decide whether this counts as a strike toward the abuse escalation
// (warn once, restrict for 24h on the second offense) -- competitor-phone
// and length blocks are not abuse and must never count toward a ban.
function screenUserText(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return { blocked: false, text: "", message: "", reason: null };
  if (raw.length > 1000) {
    return {
      blocked: true,
      text: "",
      message: "Please keep your description under 1,000 characters so I can process it safely.",
      reason: "length",
    };
  }
  if (ABUSE_RE.test(raw) || THREAT_RE.test(raw)) {
    return { blocked: true, text: "", message: SAFE_REDIRECT, reason: "abuse" };
  }
  // Block before the Gemini call, not after: without this, "recommend me an
  // iPhone" reaches the model, which infers weights from whatever it can and
  // still returns a valid profile -- so the site answers a Samsung-only
  // catalogue as if the off-topic request had been understood. Blocking here
  // also means the request never leaves for Gemini at all, saving quota.
  if (COMPETITOR_RE.test(raw)) {
    return { blocked: true, text: "", message: SAFE_REDIRECT, reason: "competitor" };
  }
  return { blocked: false, text: redactPii(raw), message: "", reason: null };
}

function safetySettings() {
  return [
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" },
  ];
}

function isProviderSafetyBlock(data) {
  return Boolean(
    data?.promptFeedback?.blockReason ||
      data?.candidates?.[0]?.finishReason === "SAFETY"
  );
}

function validateExplanation(text, phone) {
  if (typeof text !== "string") return false;
  const clean = text.trim();
  if (!clean || clean.length > 700) return false;
  if (COMPETITOR_RE.test(clean) || INTERNAL_SCORE_RE.test(clean)) return false;
  if (/https?:\/\/|[\[\]{}<>]/.test(clean)) return false;
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(clean)) return false;

  const facts = [
    phone?.processor,
    phone?.ram_gb != null && `${phone.ram_gb} GB`,
    phone?.storage_gb != null && `${phone.storage_gb} GB`,
    phone?.camera_mp != null && `${phone.camera_mp} MP`,
    phone?.battery_mah != null && `${phone.battery_mah} mAh`,
    phone?.screen_size_inch != null && `${phone.screen_size_inch} inch`,
    phone?.display_type,
    phone?.refresh_rate_hz != null && `${phone.refresh_rate_hz} Hz`,
    phone?.charging_w != null && `${phone.charging_w} W`,
    phone?.os_support_years != null && `${phone.os_support_years} years`,
  ].filter(Boolean);

  return facts.filter((fact) => clean.toLowerCase().includes(String(fact).toLowerCase())).length >= 2;
}

module.exports = {
  redactPii,
  extractBudgetInr,
  screenUserText,
  safetySettings,
  isProviderSafetyBlock,
  validateExplanation,
  SAFE_REDIRECT,
};
