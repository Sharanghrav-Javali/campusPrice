// Product Normalization, Identity Resolution, and Atomic Offer Management for CampusPrice
// Enforces exact variant/SKU matching and multi-retailer offer consolidation.

import { logger } from "./logger.js";

/**
 * Strip merchant noise from product titles
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
  const storageMatch = lower.match(
    /\b(128|256|512)\s*gb\s*(?:ssd|emmc|storage|rom)?\b|\b(1|2)\s*tb\s*(?:ssd|hdd)?\b/
  );
  const storage = storageMatch ? storageMatch[0].toUpperCase() : null;

  // CPU / Processor
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
 * Extract comprehensive product identity including variant parameters
 */
export function extractProductIdentity(title = "", snippet = "") {
  const combined = `${title} ${snippet}`;

  // Extract base hardware specs
  const config = extractConfiguration(combined);

  // Extract model series / code (e.g. Vivobook 15, Inspiron 3520, Rockerz 450, Galaxy M34)
  let modelCode = null;
  const skuMatch = title.match(/\b([A-Z0-9]{4,8}(?:-[A-Z0-9]{3,7})?)\b/);
  if (skuMatch && !["LAPTOP", "ONLINE", "WIRELESS", "BLUETOOTH", "AMAZON"].includes(skuMatch[1])) {
    modelCode = skuMatch[1];
  }

  // Color
  let color = null;
  const colors = ["black", "white", "silver", "grey", "gray", "blue", "charcoal", "green", "red", "gold"];
  for (const c of colors) {
    if (new RegExp(`\\b${c}\\b`, "i").test(title)) {
      color = c.charAt(0).toUpperCase() + c.slice(1);
      break;
    }
  }

  // Display size (e.g. 15.6", 14", 16")
  let displaySize = null;
  const sizeMatch = title.match(/\b(13|14|15|15\.6|16|17|17\.3)(?:-inch|\s*inch|\s*")\b/i);
  if (sizeMatch) {
    displaySize = `${sizeMatch[1]}"`;
  }

  const identity = {
    brand: config.brand ? config.brand.toUpperCase() : "GENERIC",
    modelCode: modelCode || null,
    variant: {
      ram: config.ram || null,
      storage: config.storage || null,
      processor: config.cpu || null,
      displaySize: displaySize || null,
      color: color || null,
    },
  };

  // Extract core model identifier by stripping category fluff words, colors, and common specs
  let coreModel = cleanProductTitle(title);
  const fluffPatterns = [
    /\b(?:bluetooth|wireless|wired|headphone[s]?|earphone[s]?|headset|earbuds|tws|iem)\b/gi,
    /\b(?:with\s+mic|mic|without\s+mic)\b/gi,
    /\b(?:on[\s-]ear|over[\s-]ear|in[\s-]ear)\b/gi,
    /\b(?:laptop|notebook|ultrabook|gaming\s+laptop)\b/gi,
    /\b(?:smartphone|mobile\s+phone|mobile|5g|4g)\b/gi,
    /\b(?:smartwatch|fitness\s+band|watch)\b/gi,
    /\b(?:mechanical\s+keyboard|keyboard|mouse)\b/gi,
    /\b(?:black|white|silver|grey|gray|blue|charcoal|green|red|gold|luscious\s+black)\b/gi,
    /\b(?:buy\s+online|best\s+price|in\s+india)\b/gi,
    /\b\d+\s*gb(?:\s*ram)?\b/gi,
    /\b(?:\d+\s*gb|\d+\s*tb)\s*(?:ssd|hdd|storage|emmc|rom)\b/gi,
    /\b(?:core\s*i[3579]|ryzen\s*[3579]|intel|amd)\b/gi,
  ];
  for (const p of fluffPatterns) {
    coreModel = coreModel.replace(p, " ");
  }
  const cleanCoreModel = coreModel.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24);

  // Build exact identity signature
  // Identical products with DIFFERENT RAM or STORAGE get DIFFERENT keys!
  const signatureParts = [
    identity.brand,
    cleanCoreModel,
    identity.variant.ram || "noram",
    identity.variant.storage || "nostorage",
    identity.variant.processor || "nocpu",
    identity.modelCode || "",
  ].filter(Boolean);

  const identityKey = signatureParts.join("__");

  return { identity, identityKey };
}

/**
 * Deduplicate and consolidate search results into normalized products with atomic multi-seller offers
 */
export function normalizeAndDeduplicate(searchResults = []) {
  const normalizedMap = new Map();

  for (const item of searchResults) {
    if (!item.sourceUrl) continue;

    const { identity, identityKey } = extractProductIdentity(item.title, item.snippet);
    const cleanedTitle = cleanProductTitle(item.title);

    // Create atomic offer
    const offer = {
      offerId: `off_${Math.random().toString(36).slice(2, 9)}`,
      searchResultId: item.searchResultId,
      retailer: item.retailer,
      price: item.price,
      priceFormatted: item.priceFormatted || (item.price ? `₹${item.price.toLocaleString("en-IN")}` : "Check retailer"),
      currency: item.currency || "INR",
      url: item.sourceUrl, // VERIFIED ORIGINAL IMMUTABLE URL
      sourceDomain: item.sourceDomain,
      searchPosition: item.searchPosition,
      searchQuery: item.searchQuery,
      retrievedAt: item.retrievedAt,
      urlQualityScore: item.urlQualityScore || 80,
      urlVerified: true,
    };

    if (!normalizedMap.has(identityKey)) {
      const candidateId = `cand_${Math.random().toString(36).slice(2, 9)}`;

      normalizedMap.set(identityKey, {
        candidateId,
        identityKey,
        productIdentity: identity,
        title: cleanedTitle,
        rawTitle: item.title,
        brand: identity.brand,
        imageUrl: item.imageUrl || null,
        rating: item.rating || null,
        ratingCount: item.ratingCount || null,
        snippets: [item.snippet].filter(Boolean),
        primaryOffer: offer,
        offers: [offer],
      });
    } else {
      const existing = normalizedMap.get(identityKey);

      // Append snippet if not already included
      if (item.snippet && !existing.snippets.includes(item.snippet)) {
        existing.snippets.push(item.snippet);
      }

      // Check if this URL already exists in offers
      const alreadyHasUrl = existing.offers.some((o) => o.url === offer.url);
      if (!alreadyHasUrl) {
        existing.offers.push(offer);
      }

      // Update primary offer if this new offer has a lower verified price
      if (
        offer.price &&
        (!existing.primaryOffer.price || offer.price < existing.primaryOffer.price)
      ) {
        existing.primaryOffer = offer;
      }

      // Fill in image if missing
      if (!existing.imageUrl && item.imageUrl) {
        existing.imageUrl = item.imageUrl;
      }
    }
  }

  const result = Array.from(normalizedMap.values());

  logger.info("normalization_complete", {
    inputSearchResults: searchResults.length,
    consolidatedProducts: result.length,
  });

  return result;
}
