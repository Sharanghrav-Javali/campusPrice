// In-memory sliding window rate limiter for student-scale deployment
// Tracks requests per client IP with automatic garbage collection of expired buckets.

const ipBuckets = new Map();
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean every 1 minute
let lastCleanup = Date.now();

function cleanupExpired(now, windowMs) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [ip, data] of ipBuckets.entries()) {
    if (now - data.resetTime > windowMs) {
      ipBuckets.delete(ip);
    }
  }
}

/**
 * Check rate limit for a given IP or identifier
 * @param {string} ip Client identifier / IP
 * @param {object} options { limit: number, windowMs: number }
 * @returns {{ allowed: boolean, remaining: number, resetInMs: number }}
 */
export function checkRateLimit(ip = "anonymous", options = {}) {
  const limit = options.limit || 15; // default 15 requests
  const windowMs = options.windowMs || 60 * 1000; // default 1 minute
  const now = Date.now();

  cleanupExpired(now, windowMs);

  const key = ip || "anonymous";
  const bucket = ipBuckets.get(key);

  if (!bucket || now > bucket.resetTime) {
    ipBuckets.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetInMs: windowMs,
    };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInMs: Math.max(0, bucket.resetTime - now),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    resetInMs: Math.max(0, bucket.resetTime - now),
  };
}

/**
 * Extract client IP from Next.js request headers
 */
export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
