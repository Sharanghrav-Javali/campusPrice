// URL Validation, Quality Scoring, and Product Page Verification for CampusPrice
// Guarantees URLs are legitimate, safe, non-search/non-category pages, and strictly preserved.

export const RETAILER_DOMAINS = {
  preferred: [
    "amazon.in",
    "flipkart.com",
    "croma.com",
    "reliancedigital.in",
    "vijaysales.com",
    "tatacliq.com",
    "myntra.com",
    "ajio.com",
    "boat-lifestyle.com",
    "apple.com",
    "samsung.com",
    "dell.com",
    "lenovo.com",
    "hp.com",
    "asus.com",
    "acer.com",
    "mi.com",
    "oneplus.in",
    "poorvika.com",
    "sangeethamobiles.com",
  ],
  blocked: [
    "google.com",
    "google.co.in",
    "bing.com",
    "yahoo.com",
    "duckduckgo.com",
    "youtube.com",
    "youtu.be",
    "reddit.com",
    "quora.com",
    "medium.com",
    "wikipedia.org",
    "pinterest.com",
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
  ],
};

// URL path patterns that are clearly search result pages or category taxonomies
const SEARCH_OR_CATEGORY_PATH_PATTERNS = [
  /\/search\b/i,
  /\/s\b/i, // Amazon /s?k=
  /\/browse\b/i,
  /\/category\b/i,
  /\/categories\b/i,
  /\/collection\b/i,
  /\/collections\b/i,
  /\/all-[a-z0-9-]+\b/i,
  /\/tag\b/i,
  /\/topic\b/i,
  /\/b\b/i, // Amazon browse node /b?node=
  /\/gp\/bestsellers\b/i,
  /\/gp\/new-releases\b/i,
  /\/gp\/movers-and-shakers\b/i,
];

// Review / editorial / listicle URL patterns
const REVIEW_OR_EDITORIAL_PATH_PATTERNS = [
  /\/review\b/i,
  /\/reviews\b/i,
  /\/news\b/i,
  /\/blog\b/i,
  /\/article\b/i,
  /\/articles\b/i,
  /\/hub\b/i,
  /\/top-\d+\b/i,
  /\/best-\d+\b/i,
  /\/buying-guide\b/i,
  /\/vs\b/i,
  /\/comparison\b/i,
];

// Product detail page patterns on major Indian marketplaces
const KNOWN_PRODUCT_PAGE_PATTERNS = [
  /\/dp\/[a-z0-9]{10}/i, // Amazon ASIN product page: /dp/B0...
  /\/gp\/product\/[a-z0-9]{10}/i, // Amazon product page: /gp/product/B0...
  /\/p\/itm[a-z0-9]+/i, // Flipkart product page: /p/itm...
  /\/p\/\d+/i, // Croma/Reliance product page: /p/251234
  /\/product\//i, // Common e-commerce product route
  /\/products\//i, // Shopify/Brand direct product route: /products/...
  /\/item\//i,
  /\/pd\//i, // Product detail
  /\/buy-/i, // Direct buy page
];

// Safe query parameters to strip (tracking only).
// NEVER strip parameters that identify product variants (e.g. pid, id, sku, variant, color, size, lid).
const TRACKING_QUERY_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "_ga",
  "ref",
  "tag",
  "ascsubtag",
  "dchild",
];

/**
 * Validate that a URL is a syntactically valid, safe HTTP/HTTPS URL
 */
export function isValidProductUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return false;

  // Trim and check length
  const clean = rawUrl.trim();
  if (clean.length < 10 || clean.length > 2048) return false;

  // Reject dangerous protocols
  const lower = clean.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("blob:") ||
    lower.startsWith("vbscript:")
  ) {
    return false;
  }

  try {
    const parsed = new URL(clean);

    // Protocol must be http: or https:
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    // Must have a real hostname with a dot
    if (!host || !host.includes(".") || host.endsWith(".")) {
      return false;
    }

    // Reject localhost and loopback
    if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
      return false;
    }

    // Reject private IP ranges
    if (
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return false;
    }

    // Check if domain is on blocked list
    for (const blocked of RETAILER_DOMAINS.blocked) {
      if (host === blocked || host.endsWith(`.${blocked}`)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Safely normalize a URL without removing variant or product-identifying parameters
 */
export function normalizeProductUrl(rawUrl) {
  if (!isValidProductUrl(rawUrl)) return null;

  try {
    const parsed = new URL(rawUrl.trim());

    // Remove tracking query parameters only
    for (const param of TRACKING_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Remove trailing hash/fragments that don't affect variant
    if (parsed.hash && !parsed.hash.includes("variant") && !parsed.hash.includes("sku")) {
      parsed.hash = "";
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Calculate URL and page quality score.
 * Returns { score: number, isProductPage: boolean, reasons: string[] }
 */
export function calculateUrlQuality(item) {
  const url = item.sourceUrl || item.link || "";
  const title = item.title || "";
  const snippet = item.snippet || "";

  if (!isValidProductUrl(url)) {
    return {
      score: 0,
      isProductPage: false,
      reasons: ["URL failed security/syntax validation"],
    };
  }

  let score = 50; // baseline
  const reasons = [];
  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return { score: 0, isProductPage: false, reasons: ["Malformed URL"] };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();

  // 1. Preferred retailer domain boost
  const isPreferred = RETAILER_DOMAINS.preferred.some(
    (pref) => host === pref || host.endsWith(`.${pref}`)
  );
  if (isPreferred) {
    score += 25;
    reasons.push("Recognized preferred retailer domain");
  }

  // 2. Known product page path pattern
  const isKnownProductPath = KNOWN_PRODUCT_PAGE_PATTERNS.some((p) => p.test(path));
  if (isKnownProductPath) {
    score += 35;
    reasons.push("Matches verified product detail page URL structure");
  }

  // 3. Penalty for search or category paths
  const isSearchOrCategory = SEARCH_OR_CATEGORY_PATH_PATTERNS.some(
    (p) => p.test(path) || (p.test(search) && search.includes("search"))
  );
  if (isSearchOrCategory) {
    score -= 45;
    reasons.push("URL structure resembles a search or category listing page");
  }

  // 4. Penalty for editorial or review paths
  const isReviewOrBlog = REVIEW_OR_EDITORIAL_PATH_PATTERNS.some((p) => p.test(path));
  if (isReviewOrBlog) {
    score -= 40;
    reasons.push("URL points to a blog, review, or article page");
  }

  // 5. Amazon-specific search page check: amazon.in/s?k=... or /b?node=
  if (host.includes("amazon") && (path === "/s" || path === "/b" || search.includes("k="))) {
    score -= 60;
    reasons.push("Amazon search/category result page");
  }

  // 6. Flipkart-specific search check: flipkart.com/search?q=...
  if (host.includes("flipkart") && (path === "/search" || search.includes("q="))) {
    score -= 60;
    reasons.push("Flipkart search result page");
  }

  // 7. Title & snippet signals
  if (item.price && item.price > 0) {
    score += 15;
    reasons.push("Structured pricing detected");
  }

  if (item.sourceType === "shopping_result") {
    score += 20;
    reasons.push("Google Shopping direct product entity");
  }

  // Strict decision: is it a product page?
  // If it matched a search/category pattern or review pattern, it is NOT a product page.
  const isProductPage =
    score >= 45 &&
    !isSearchOrCategory &&
    !isReviewOrBlog &&
    (isKnownProductPath || isPreferred || item.sourceType === "shopping_result" || (item.price && item.price > 0));

  return {
    score: Math.max(0, Math.min(100, score)),
    isProductPage,
    reasons,
  };
}

/**
 * Filter out invalid URLs, search pages, category pages, and editorial sites
 */
export function filterAndScoreSearchResults(rawItems = []) {
  const verified = [];

  for (const item of rawItems) {
    const rawUrl = item.sourceUrl || item.link;
    if (!isValidProductUrl(rawUrl)) continue;

    const normalizedUrl = normalizeProductUrl(rawUrl);
    if (!normalizedUrl) continue;

    const quality = calculateUrlQuality({
      ...item,
      sourceUrl: normalizedUrl,
    });

    // Only keep items that pass product page verification
    if (quality.isProductPage) {
      verified.push({
        ...item,
        sourceUrl: normalizedUrl,
        urlQualityScore: quality.score,
        urlQualityReasons: quality.reasons,
        urlVerified: true,
      });
    }
  }

  return verified;
}
