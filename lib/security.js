// Security & Sanitization utilities for CampusPrice
// Defends against Prompt Injection, Malicious URLs, and input abuse.

const MAX_INPUT_LENGTH = 1200;

/**
 * Sanitize and validate raw user input string
 */
export function sanitizeUserInput(input) {
  if (typeof input !== "string") return "";
  // Strip null bytes and control chars (except normal whitespace)
  let clean = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Trim and limit length
  clean = clean.trim();
  if (clean.length > MAX_INPUT_LENGTH) {
    clean = clean.slice(0, MAX_INPUT_LENGTH);
  }
  return clean;
}

/**
 * Wraps untrusted external data (e.g. web search snippets) in strict XML tags.
 * Neutralizes potential prompt injection from scraped web pages.
 */
export function wrapUntrustedData(data, tag = "untrusted_web_evidence") {
  if (!data) return `<${tag}></${tag}>`;
  const text = typeof data === "string" ? data : JSON.stringify(data);
  // Neutralize closing tag occurrences inside the untrusted content
  const neutralized = text.replace(new RegExp(`</${tag}>`, "gi"), `[escaped_tag]`);
  return `<${tag}>\n${neutralized}\n</${tag}>`;
}

/**
 * Validates external URLs to ensure they use http/https and are well-formed.
 */
export function validateUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON from LLM or external sources with fallback
 */
export function safeJsonParse(raw, fallback = null) {
  if (!raw || typeof raw !== "string") return fallback;
  let cleaned = raw.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt to locate outermost JSON object or array
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}
