// Shared second-provider client for the Vercel functions.
//
// Provider selection: if GROQ_API_KEY is set in Vercel, explain.js and
// parse.js route through Groq. Otherwise the existing, tested Gemini path
// runs exactly as before -- Groq is additive, not a replacement. To
// "deactivate" it: remove GROQ_API_KEY in Vercel project settings and
// redeploy (env var changes don't apply to a deployment already built).
//
// Why Groq: the free tier is 14,400 requests/day on llama-3.1-8b-instant,
// versus Gemini's 20/day -- verified against
// https://console.groq.com/docs/models and .../rate-limits on 2026-07-17.
//
// The model this was originally requested under ("llama3-groq-tool-use") is
// real, but only as an Ollama library model for local inference (8b/70b,
// pullable today) -- it is not served on Groq's own cloud API, so nothing
// running on Vercel can reach it. A notebook on the same machine as an
// Ollama server could use it directly; this serverless function cannot.
//
// Groq is OpenAI-compatible: POST /openai/v1/chat/completions, Authorization:
// Bearer <key>, messages: [{role, content}] -- a different shape from
// Gemini's (systemInstruction + contents, x-goog-api-key header), so this is
// its own function rather than a parameter on callGemini.

const GROQ_MODEL = "llama-3.1-8b-instant";        // 560 tok/s, 14.4K req/day free
const GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile"; // smarter, smaller free-tier allowance
const PROVIDER_TIMEOUT_MS = 12000;

function groqConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function callGroq(model, systemInstruction, userContent, apiKey, { jsonMode = false, maxTokens = 2048 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userContent },
        ],
        max_tokens: maxTokens,
        seed: 7,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("Groq request timed out");
      timeoutError.status = 503;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Groq ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const choice = data?.choices?.[0];
  // Groq's content-filter signal, in its own response shape -- distinct from
  // Gemini's promptFeedback/finishReason:"SAFETY" that isProviderSafetyBlock
  // checks in safety.js.
  if (choice?.finish_reason === "content_filter") {
    const error = new Error("Groq safety block");
    error.blocked = true;
    throw error;
  }
  const text = choice?.message?.content || "";
  if (!text.trim()) throw new Error("Groq returned no text");
  return text.trim();
}

module.exports = { groqConfigured, callGroq, GROQ_MODEL, GROQ_FALLBACK_MODEL };
