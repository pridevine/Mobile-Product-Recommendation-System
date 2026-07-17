/* chat.js — "Ask GalaxyMatch": grounded Q&A against the real catalogue.

   The same four layers the other endpoints use, from the client's side:
     1. screenQuery() (engine.js) refuses locally, before any network call.
     2+3. /api/chat carries the prompt rules and the provider safety filters.
     4. /api/chat validates the answer; a reply that invents a phone or a spec
        comes back as null and we say we couldn't answer rather than show it.

   Screening client-side as well as server-side is not redundant: the server
   never sees a request the circuit breaker skipped, and a refusal that costs
   no round trip is strictly better. */

const log = document.getElementById("chat-log");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("chat-send");
const feedback = document.getElementById("chat-feedback");
const suggest = document.getElementById("chat-suggest");

// Kept in memory only: refreshing starts a clean conversation, and nothing a
// shopper types is persisted anywhere.
const history = [];
const MAX_TURNS = 6; // matches api/chat.js -- the last 3 exchanges

function showFeedback(text, tone = "info") {
  feedback.textContent = text;
  feedback.classList.toggle("tone-error", tone === "error");
  feedback.hidden = false;
}
function clearFeedback() {
  feedback.hidden = true;
  feedback.textContent = "";
  feedback.classList.remove("tone-error");
}

// textContent, never innerHTML: the reply is model output and must never be
// able to inject markup into this page.
function addBubble(role, text) {
  const row = document.createElement("div");
  row.className = `chat-msg chat-${role}`;
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = text;
  row.appendChild(bubble);
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

function addTyping() {
  const row = document.createElement("div");
  row.className = "chat-msg chat-bot";
  row.innerHTML = `<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>`;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
  return row;
}

function setBusy(busy) {
  sendBtn.disabled = busy;
  sendBtn.textContent = busy ? "Thinking…" : "Send";
}

async function ask(question) {
  clearFeedback();

  // A ban outranks everything, and costs nothing to check.
  if (AIGuard.isBanned()) {
    showFeedback(AIGuard.banMessage(), "error");
    return;
  }

  // Layer 1, locally. Only "abuse" is ever a strike -- an off-topic or
  // no-data question is a misunderstanding, not misconduct.
  const screened = screenQuery(question);
  if (screened.blocked) {
    addBubble("user", question);
    input.value = "";
    if (screened.reason === "abuse") {
      const strike = AIGuard.recordAbuseStrike();
      addBubble("bot", strike.message);
      showFeedback(strike.message, "error");
    } else {
      addBubble("bot", screened.message);
    }
    return;
  }

  addBubble("user", question);
  input.value = "";
  suggest.hidden = true;
  setBusy(true);
  const typing = addTyping();

  // Identical asks reuse the answer instead of spending quota. Keyed on the
  // question plus the turns it depends on, so the same words after a
  // different exchange are not served a stale answer.
  const cacheKey = `chat:v1:${JSON.stringify(history.slice(-MAX_TURNS))}:${question}`;
  const cached = AIGuard.cacheGet(cacheKey);
  if (cached) {
    typing.remove();
    addBubble("bot", cached);
    history.push({ role: "user", text: question }, { role: "bot", text: cached });
    setBusy(false);
    return;
  }

  if (AIGuard.isDown()) {
    typing.remove();
    setBusy(false);
    showFeedback("The assistant is unavailable for a few minutes. The persona picker and results still work normally.");
    return;
  }

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, history: history.slice(-MAX_TURNS) }),
    });
    const data = await res.json();
    typing.remove();

    if (data && data.blocked) {
      // The server screens too, and can catch what the client's copy didn't.
      if (data.reason === "abuse") {
        const strike = AIGuard.recordAbuseStrike();
        addBubble("bot", strike.message);
        showFeedback(strike.message, "error");
      } else {
        addBubble("bot", data.message || "I can only help with choosing a Samsung Galaxy phone.");
      }
      return;
    }

    if (data && data.reply) {
      addBubble("bot", data.reply);
      history.push({ role: "user", text: question }, { role: "bot", text: data.reply });
      AIGuard.cacheSet(cacheKey, data.reply);
      AIGuard.noteResult(true);
      return;
    }

    // A transient per-minute rate limit is NOT a reason to open the circuit
    // breaker: that's a 5-minute cooldown shared with /api/explain, so it
    // would darken the results page too, for a limit that clears in seconds.
    // Say "busy", leave the breaker alone.
    if (data && data.source === "rate-limited") {
      addBubble("bot", "I'm getting a lot of questions at once — give me a few seconds and ask again.");
      return;
    }

    // reply:null otherwise: layer 4 caught an ungrounded answer, or something
    // genuinely failed. Only the latter should count toward the breaker.
    AIGuard.noteResult(false);
    addBubble("bot", data && data.source === "validation-fallback"
      ? "I couldn't answer that from our catalogue data. Try asking about a budget, camera, gaming, battery, display or value."
      : "I couldn't answer that just now. Please try again in a moment.");
  } catch (_) {
    typing.remove();
    AIGuard.noteResult(false);
    addBubble("bot", "I couldn't reach the assistant just now. Please try again in a moment.");
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) { input.focus(); return; }
  ask(question);
});

suggest.querySelectorAll(".chat-chip").forEach((chip) => {
  chip.addEventListener("click", () => ask(chip.textContent.trim()));
});

// Restore the send button after a bfcache restore, same as home.js: Back
// would otherwise leave it stuck disabled on "Thinking…".
window.addEventListener("pageshow", (event) => {
  if (event.persisted) setBusy(false);
});

addBubble("bot", "Hi — I'm GalaxyMatch. Ask me anything about our Samsung Galaxy range: budgets, cameras, battery, gaming, or how two models compare.");
