// Shared, dependency-free safety helpers for the Vercel functions.
// This is defense in depth: the provider safety filters remain enabled too.

const SAFE_REDIRECT =
  "I can help you choose a Samsung Galaxy phone. Tell me your budget and what matters most, such as camera, gaming, battery, display, or value.";

// Keep this intentionally conservative. The model should handle ordinary
// frustration, while clearly abusive/threatening input is stopped before it
// reaches the provider. We do not log or echo the matched text.
// Deliberately excludes words that are ordinary phone-shopping vocabulary:
// "worst battery", "I hate small screens", "damn good camera" are opinions,
// not abuse, and blocking them would refuse real shoppers.
const ABUSE_RE = /\b(?:fuck(?:ing|ed)?|shit(?:ty)?|bitch|asshole|bastard|dumbass|idiot|idiotic|moron|moronic|imbecile|stupid|dumb|fool(?:s|ish)?|silly|lame|clown|loser|pathetic|jerk|prick|dickhead|douche(?:bag)?|scumbag|wanker|cunt|twat|trash|garbage|useless|worthless|nonsense|rubbish|bullshit|wtf|stfu|suck(?:s|ed)?)\b|\bshut\s+up\b|\bscrew\s+you\b/i;
// Racial, ethnic, homophobic, and ableist slurs -- checked separately from
// ABUSE_RE and always a strike (never just logged/softened), regardless of
// what the rest of the message says.
const SLUR_RE = /\b(?:n[i1]gg(?:er|a|ers|as)?|f[a4]gg?[o0]t|ch[i1]nk|sp[i1]c|wetback|g[o0]{2}k|k[i1]ke|c[o0]{2}n|r[e3]t[a4]rd(?:ed)?|tr[a4]nny|p[a4]ki)\b/i;
const THREAT_RE = /\b(?:kill|hurt|attack|bomb|shoot)\s+(?:you|yourself|me|someone|people)\b/i;
// Real catalogue model numbers are always 1-2 digits (S26, A57, Fold7) -- a
// 3+ digit number right after "samsung"/"galaxy"/"model" (e.g. "samsung
// 11100") can't be real, so say so instead of quietly recommending an
// unrelated phone. Adjacency is deliberately tight so this never fires on an
// ordinary budget mention like "galaxy phone under 30000".
const UNKNOWN_MODEL_RE = /\b(?:samsung|galaxy)\s+(?:galaxy\s+)?[a-z]{0,5}-?\s?(\d{3,6})\b|\bmodel(?:\s+number)?\s*[:#]?\s*[a-z]{0,5}-?\s?(\d{3,6})\b/i;

// Hardware the catalogue has no column for. phones.csv knows: processor,
// ram_gb, storage_gb, camera_mp, battery_mah, screen_size_inch, display_type,
// refresh_rate_hz, charging_w, os_support_years, price_inr. It does NOT know
// whether a phone has a pop-up camera, a headphone jack, an SD slot, an IP
// rating and so on -- so asking about those must return "no data", not a
// phone. Checked before the keyword pass, because "pop up camera" contains
// "camera" and would otherwise score as a camera request and confidently
// return an unrelated model.
// Mechanism terms match standalone: "pop up" on its own is already an ask
// about a camera mechanism we have no column for, and requiring the word
// "camera" after it let "pop up" through to a confident answer. "in-display"
// needs its hyphen -- bare "in display" appears in ordinary sentences like
// "interested in display quality", which must still work.
const UNSUPPORTED_FEATURE_RE = /\b(?:pop[\s-]?up|under[\s-]?display|punch[\s-]?hole|periscope|telephoto)\b|\bin-display\b|\boptical\s+zoom\b|\b(?:headphone|audio|3\.5\s?mm)\s*jack\b|\b(?:micro\s?sd|sd\s+card|memory\s+card|expandable\s+storage)\b|\bir\s+blaster\b|\b(?:wireless|reverse)\s+charg(?:ing|er)\b|\b(?:water[\s-]?proof|water[\s-]?resistant|ip6[78])\b|\bgorilla\s+glass\b|\b(?:fingerprint|face\s+unlock|iris\s+scanner)\b|\be[\s-]?sim\b|\bdual\s+sim\b|\b(?:stereo\s+speakers?|dolby)\b|\bsatellite\b/i;
const NO_DATA_MESSAGE =
  "I don't have specification data for that. Our catalogue covers camera megapixels, processor, RAM, storage, battery, display, charging speed and price — tell me your budget and which of those matters most, and I'll match you to a real Galaxy phone.";

// GalaxyMatch is a Galaxy inventory assistant, not a general chatbot. Every
// other rule here is a blocklist, which can never cover "what's the weather"
// or "write me a poem" -- those matched nothing, fell through to the default
// weights, and got answered with a phone as if understood. So this one is an
// allowlist: a request must show at least one sign of being about buying a
// phone. Deliberately broad (a wrongly-refused shopper is worse than a
// wrongly-accepted vague one), and only consulted when nothing else matched.
const RELEVANT_RE = /\b(?:phone|mobile|smartphone|handset|device|galaxy|samsung|upgrade|buy|buying|purchase|recommend|recommendation|suggest|looking|need|want|budget|price|pricing|cost|cheap|affordable|expensive|premium|flagship|midrange|mid-range|spec|specs|specification|model|compare|camera|photo|photos|photography|selfie|selfies|video|videos|record|recording|shoot|shooting|reel|reels|vlog|megapixel|mp|game|games|gaming|gamer|bgmi|pubg|cod|fortnite|fps|performance|processor|chipset|snapdragon|exynos|ram|storage|speed|fast|smooth|multitask|multitasking|lag|battery|charge|charging|backup|mah|endurance|display|screen|amoled|oled|refresh|hz|inch|inches|bright|brightness|value|worth|money|student|college|creator|influencer|photographer|professional|business|consultant|freelancer|travel|travelling|traveling|commute|work|office|shop|owner|mom|dad|mother|father|parent|gift|senior|kid|teen|pen|stylus|note|5g|ultra|fold|flip|plus|pro|fe)\b/i;
const OFF_TOPIC_MESSAGE =
  "I'm GalaxyMatch — I only help with choosing a Samsung Galaxy phone. Tell me your budget and what matters most (camera, gaming, battery, display or value) and I'll find your match.";

// A budget on its own ("30000", "under 45k", "1 lakh") is a complete request.
const BUDGETISH_RE = /\d{3,}|\d+\s*(?:k|thousand|lakh|lac)\b/i;
// Model tokens: s26, a57, m55, fold7, flip7.
const MODELISH_RE = /\b(?:[sazmf]\s?\d{1,3}|fold\s?\d?|flip\s?\d?)\b/i;

// Contact details are stripped first: the digits in an email or phone number
// ("akhilan576@gmail.com") otherwise read as a budget, so a bare email looked
// like a valid request and came back with an arbitrary phone. The redaction
// placeholders go too -- "[phone removed]" contains the word "phone", which
// would smuggle the same input straight back through.
function looksLikePhoneRequest(text) {
  const probe = redactPii(String(text || ""))
    .replace("[email removed]", " ")
    .replace("[phone removed]", " ");
  return RELEVANT_RE.test(probe) || BUDGETISH_RE.test(probe) || MODELISH_RE.test(probe);
}

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
  if (ABUSE_RE.test(raw) || SLUR_RE.test(raw) || THREAT_RE.test(raw)) {
    return { blocked: true, text: "", message: SAFE_REDIRECT, reason: "abuse" };
  }
  if (UNSUPPORTED_FEATURE_RE.test(raw)) {
    return { blocked: true, text: "", message: NO_DATA_MESSAGE, reason: "no_data" };
  }
  if (UNKNOWN_MODEL_RE.test(raw)) {
    return {
      blocked: true,
      text: "",
      message: "We couldn't find that model in our Samsung Galaxy lineup. Tell me your budget and priorities instead — camera, gaming, battery, display, or value — and I'll match you to a real Galaxy phone.",
      reason: "unknown_model",
    };
  }
  // Block before the Gemini call, not after: without this, "recommend me an
  // iPhone" reaches the model, which infers weights from whatever it can and
  // still returns a valid profile -- so the site answers a Samsung-only
  // catalogue as if the off-topic request had been understood. Blocking here
  // also means the request never leaves for Gemini at all, saving quota.
  if (COMPETITOR_RE.test(raw)) {
    return { blocked: true, text: "", message: SAFE_REDIRECT, reason: "competitor" };
  }
  // Last: the specific rules above give a more useful message than the
  // generic off-topic one, so this only catches what none of them recognised.
  if (!looksLikePhoneRequest(raw)) {
    return { blocked: true, text: "", message: OFF_TOPIC_MESSAGE, reason: "off_topic" };
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
