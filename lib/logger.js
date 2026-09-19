// Observability & Structured Logger for CampusPrice
// Never logs secrets, API keys, or private user credentials.

export const logger = {
  info: (step, data = {}) => {
    const payload = sanitizeLogPayload(data);
    console.log(`[INFO] [${new Date().toISOString()}] [${step}]`, JSON.stringify(payload));
  },
  warn: (step, data = {}) => {
    const payload = sanitizeLogPayload(data);
    console.warn(`[WARN] [${new Date().toISOString()}] [${step}]`, JSON.stringify(payload));
  },
  error: (step, err, data = {}) => {
    const payload = sanitizeLogPayload(data);
    const errorDetails = {
      message: err?.message || String(err),
      name: err?.name || "Error",
      ...payload,
    };
    console.error(`[ERROR] [${new Date().toISOString()}] [${step}]`, JSON.stringify(errorDetails));
  },
};

function sanitizeLogPayload(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clean = { ...obj };
  const secretKeys = ["api_key", "apikey", "authorization", "secret", "token", "key"];
  for (const k of Object.keys(clean)) {
    if (secretKeys.some((sk) => k.toLowerCase().includes(sk))) {
      clean[k] = "[REDACTED]";
    } else if (typeof clean[k] === "object" && clean[k] !== null) {
      clean[k] = sanitizeLogPayload(clean[k]);
    }
  }
  return clean;
}
