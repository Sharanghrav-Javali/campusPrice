// Product Normalization and Deduplication Layer for CampusPrice
// Filters out noise, parses configuration signatures, and cleanly consolidates multi-seller listings.

import { logger } from "./logger";

// Domains and URL patterns that are clearly editorial or community forums, not product pages
const NON_PRODUCT_URL_PATTERNS = [
  /\/news\//i,
  /\/blog\//i,
  /\/article\//i,
  /\/forum\//i,
  /\/thread\//i,
  /\/community\//i,
  /youtube\.com/i,
  /reddit\.com/i,
  /quora\.com/i,
  /medium\.com/i,
  /theverge\.com/i,
  /gadgets360\.com\/news/i,
  /wikipedia\.org/i,
  /pinterest\./i,
];

// Titles that indicate comparison articles or listicles rather than distinct products
const LISTICLE_TITLE_PATTERNS = [
  /^(?:top|best)\s+\d+/i,
  /^10\s+best/i,
  /^5\s+best/i,
  /buying\s+guide/i,
  /things\s+to\s+consider/i,
  /vs\s+.*\s+comparison/i,
  /review:\s+/i,
];

/**
 * Filter out non-product results
 */
export function isLikelyProductListing(item) {
  if (!item.title || !item.link) return false;

  // Check URL patterns
  for (const pattern of NON_PRODUCT_URL_PATTERNS) {
    if (pattern.test(item.link)) return false;
  }

  // Check title patterns
  for (const pattern of LISTICLE_TITLE_PATTERNS) {
    if (pattern.test(item.title.trim())) return false;
  }

  return true;
}

/**
 * Strip merchant noise from titles
 */
export function cleanProductTitle(rawTitle = "") {
  return rawTitle
    .replace(/\s*:\s*Buy\s+Online.*$/i, "")
    .replace(/\s*\|\s*(?:Amazon|Flipkart|Croma|Reliance Digital|Tata CLiQ|Myntra).*$/i, "")
    .replace(/\s*-\s*(?:Amazon|Flipkart|Croma|Reliance Digital|Tata CLiQ).*$/i, "")
    .replace(/\s*\(\s*(?:Black|White|Silver|Grey|Blue|Gold|Charcoal)\s*,\s*(?:128GB|256GB|512GB|1TB|8GB|16GB)\s*\)/i, "")
    .replace(/\s*₹\s*[\d,]+.*$/i, "")
    .replace(/\s+at\s+best\s+price\s+in\s+india.*$/i, "")
    .trim();
}

/**
 * Extract key configuration identifiers from title and snippet
 */
export function extractConfiguration(text = "") {
  const lower = text.toLowerCase();

  // RAM
  const ramMatch = lower.match(/\b(4|8|16|24|32|64)\s*gb(?:\s*ram|\s*lpddr|\s*ddr)?\b/);
  const ram = ramMatch ? `${ramMatch[1]}GB` : null;

  // Storage
  const storageMatch = lower.match(/\b(128|256|512)\s*gb\s*(?:ssd|emmc|storage|rom)?\b|\b(1|2)\s*tb\s*(?:ssd|hdd)?\b/);
  const storage = storageMatch ? storageMatch[0].toUpperCase() : null;

  // CPU / Chip
  let cpu = null;
  if (/i3|core\s*i3/i.test(lower)) cpu = "Core i3";
  else if (/i5|core\s*i5/i.test(lower)) cpu = "Core i5";
  else if (/i7|core\s*i7/i.test(lower)) cpu = "Core i7";
  else if (/i9|core\s*i9/i.test(lower)) cpu = "Core i9";
  else if (/ryzen\s*3/i.test(lower)) cpu = "Ryzen 3";
  else if (/ryzen\s*5/i.test(lower)) cpu = "Ryzen 5";
  else if (/ryzen\s*7/i.test(lower)) cpu = "Ryzen 7";
  else if (/ryzen\s*9/i.test(lower)) cpu = "Ryzen 9";
  else if (/\bm1\b/i.test(lower)) cpu = "Apple M1";
  else if (/\bm2\b/i.test(lower)) cpu = "Apple M2";
  else if (/\bm3\b/i.test(lower)) cpu = "Apple M3";
  else if (/snapdragon/i.test(lower)) cpu = "Snapdragon";
  else if (/dimensity/i.test(lower)) cpu = "Dimensity";

  // Common Brands
  const brands = [
    "apple", "samsung", "asus", "hp", "dell", "lenovo", "acer", "msi",
    "xiaomi", "redmi", "realme", "oneplus", "motorola", "iqoo", "vivo", "oppo",
    "sony", "boat", "bose", "sennheiser", "jbl", "noise", "boult",
    "nike", "adidas", "puma", "reebok", "asics", "new balance",
    "logitech", "razer", "corsair", "lg", "benq", "viewsonic"
  ];
  const brand = brands.find((b) => lower.includes(b)) || null;

  return { ram, storage, cpu, brand };
}

/**
 * Deduplicate and normalize raw product candidates
 */
export function normalizeAndDeduplicate(candidates) {
  const filtered = candidates.filter(isLikelyProductListing);
  const normalizedMap = new Map();

  for (const item of filtered) {
    const cleanedTitle = cleanProductTitle(item.title);
    const combinedText = `${item.title} ${item.snippet || ""}`;
    const config = extractConfiguration(combinedText);

    // Build configuration key so different hardware variants are NEVER merged
    const parts = [
      config.brand || "",
      cleanedTitle.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30),
      config.ram || "",
      config.storage || "",
      config.cpu || "",
    ].filter(Boolean);

    const configKey = parts.join("__") || item.link;

    if (!normalizedMap.has(configKey)) {
      normalizedMap.set(configKey, {
        id: `prod_${Math.random().toString(36).slice(2, 9)}`,
        title: cleanedTitle,
        rawTitle: item.title,
        brand: config.brand ? config.brand.toUpperCase() : null,
        specsSummary: [config.cpu, config.ram, config.storage].filter(Boolean).join(" · "),
        config,
        observedPrice: item.price,
        observedPriceFormatted: item.priceFormatted,
        rating: item.rating,
        ratingCount: item.ratingCount,
        imageUrl: item.imageUrl,
        primaryRetailer: item.retailer,
        primaryLink: item.link,
        snippets: [item.snippet].filter(Boolean),
        sources: [
          {
            retailer: item.retailer,
            price: item.price,
            priceFormatted: item.priceFormatted,
            link: item.link,
          },
        ],
      });
    } else {
      const existing = normalizedMap.get(configKey);
      // Append snippet if new
      if (item.snippet && !existing.snippets.includes(item.snippet)) {
        existing.snippets.push(item.snippet);
      }
      // Add source if different retailer or link
      const alreadyHasLink = existing.sources.some((s) => s.link === item.link);
      if (!alreadyHasLink) {
        existing.sources.push({
          retailer: item.retailer,
          price: item.price,
          priceFormatted: item.priceFormatted,
          link: item.link,
        });
      }
      // Update best observed price if this source is cheaper
      if (item.price && (!existing.observedPrice || item.price < existing.observedPrice)) {
        existing.observedPrice = item.price;
        existing.observedPriceFormatted = item.priceFormatted;
        existing.primaryRetailer = item.retailer;
        existing.primaryLink = item.link;
      }
      // Use image if missing
      if (!existing.imageUrl && item.imageUrl) {
        existing.imageUrl = item.imageUrl;
      }
    }
  }

  const result = Array.from(normalizedMap.values());
  logger.info("normalization_complete", {
    inputCount: candidates.length,
    usableCount: result.length,
  });

  return result;
}
