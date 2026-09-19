// Groq API client with fallback models and structured JSON parsing
import { safeJsonParse } from "./security.js";
import { logger } from "./logger.js";

const FALLBACK_MODELS = [
  process.env.GROQ_MODEL,
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
].filter(Boolean);

/**
 * Call Groq chat completions API with automatic model fallback
 */
export async function callGroq({
  messages,
  temperature = 0.2,
  max_tokens = 1800,
  json_mode = true,
  preferredModel = null,
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured in .env.local.");
  }

  const modelsToTry = preferredModel
    ? [preferredModel, ...FALLBACK_MODELS.filter((m) => m !== preferredModel)]
    : FALLBACK_MODELS;

  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const startTime = Date.now();
      const body = {
        model,
        messages,
        temperature,
        max_tokens,
      };

      if (json_mode) {
        body.response_format = { type: "json_object" };
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        // If model not found or access denied, continue to next fallback model
        if (res.status === 404 || errorText.includes("model_not_found")) {
          logger.warn("groq_model_fallback", { model, status: res.status });
          lastError = new Error(`Model ${model} not available: ${errorText.slice(0, 120)}`);
          continue;
        }
        throw new Error(`Groq API error (${res.status}): ${errorText.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const latencyMs = Date.now() - startTime;

      logger.info("groq_call_success", { model, latencyMs });

      if (json_mode) {
        const parsed = safeJsonParse(content);
        if (!parsed) {
          throw new Error("AI response was not valid JSON.");
        }
        return { data: parsed, raw: content, model };
      }

      return { data: content, raw: content, model };
    } catch (err) {
      lastError = err;
      logger.warn("groq_model_attempt_failed", { model, error: err.message });
    }
  }

  throw lastError || new Error("Failed to get response from AI provider.");
}
