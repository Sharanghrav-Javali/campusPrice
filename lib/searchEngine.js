// Multi-Query Search Engine for CampusPrice
// Executes targeted searches across Indian retailers and preserves immutable source URLs with full provenance.

import { filterAndScoreSearchResults, isValidProductUrl } from "./urlValidator.js";
import { logger } from "./logger.js";

/**
 * Generate targeted multi-query search plan based on structured requirements
 */
export function generateSearchQueries(requirements) {
  const { category, budget, must_have = [], use_cases = [], brand_preferences = [], search_seed } = requirements;
  const queries = [];

  const mustHaveStr = must_have.slice(0, 2).join(" ");
  const useCaseStr = use_cases.slice(0, 2).join(" ");
  const brandStr = brand_preferences.slice(0, 2).join(" ");
  const budgetStr = budget?.max ? `under ${budget.max}` : "";

  // Query 1: Targeted direct purchase intent
  const q1Parts = [brandStr, search_seed || category, mustHaveStr, budgetStr, "price India buy online"].filter(Boolean);
  queries.push(q1Parts.join(" "));

  // Query 2: Direct retailer product page listings (Amazon /dp, Flipkart /p, Croma)
  const q2Parts = [
    category,
    mustHaveStr,
    budgetStr,
    "buy online site:amazon.in/dp/ OR site:flipkart.com/p/ OR site:croma.com/p/",
  ].filter(Boolean);
  queries.push(q2Parts.join(" "));

  // Query 3: Multi-store comparison query
  if (useCaseStr || mustHaveStr) {
    const q3Parts = [
      "buy",
      brandStr,
      category,
      mustHaveStr || useCaseStr,
      budgetStr,
      "India online price",
    ].filter(Boolean);
    queries.push(q3Parts.join(" "));
  }

  // Deduplicate and cap at 3 queries
  return Array.from(new Set(queries)).slice(0, 3);
}

/**
 * Call Serper API for a single query
 */
async function fetchSerperQuery(query, apiKey) {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: query,
      gl: "in",
      hl: "en",
      num: 12,
    }),
  });

  if (!res.ok) {
    throw new Error(`Serper search failed with status ${res.status}`);
  }

  return res.json();
}

/**
 * Extract clean retailer name from URL or site title
 */
export function extractRetailer(link, sourceTitle = "") {
  try {
    const parsed = new URL(link);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("amazon")) return "Amazon";
    if (host.includes("flipkart")) return "Flipkart";
    if (host.includes("croma")) return "Croma";
    if (host.includes("reliancedigital")) return "Reliance Digital";
    if (host.includes("vijaysales")) return "Vijay Sales";
    if (host.includes("tatacliq")) return "Tata CLiQ";
    if (host.includes("myntra")) return "Myntra";
    if (host.includes("ajio")) return "Ajio";
    if (host.includes("boat-lifestyle")) return "boAt Official";
    if (host.includes("lenovo")) return "Lenovo";
    if (host.includes("dell")) return "Dell";
    if (host.includes("hp.com")) return "HP Store";
    if (host.includes("apple.com")) return "Apple Store";
    if (host.includes("samsung.com")) return "Samsung Store";
    if (host.includes("mi.com")) return "Mi Store";
    if (host.includes("asus")) return "ASUS Store";
    if (host.includes("acer")) return "Acer Store";
    if (host.includes("oneplus")) return "OnePlus Store";
    return sourceTitle || host;
  } catch {
    return sourceTitle || "Online Store";
  }
}

/**
 * Extract price number and string from title/snippet
 */
export function extractPriceFromText(text) {
  if (!text) return null;
  // Match patterns like ₹64,999, Rs. 64,999, Rs 64999, INR 64,999
  const match = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/,/g, ""), 10);
    if (!isNaN(num) && num > 50 && num < 10000000) {
      return {
        amount: num,
        formatted: `₹${num.toLocaleString("en-IN")}`,
      };
    }
  }
  return null;
}

/**
 * Execute multi-query search and harvest candidate products with immutable source URLs
 */
export async function searchProducts(requirements) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not configured in .env.local.");
  }

  const queries = generateSearchQueries(requirements);
  logger.info("search_queries_generated", { queries });

  const searchPromises = queries.map((q, queryIdx) =>
    fetchSerperQuery(q, apiKey)
      .then((data) => ({ data, query: q, queryIdx }))
      .catch((err) => {
        logger.warn("serper_single_query_failed", { query: q, error: err.message });
        return null;
      })
  );

  const results = await Promise.all(searchPromises);

  const rawCandidates = [];
  const seenUrls = new Set();
  const retrievedAt = new Date().toISOString();

  for (const resObj of results) {
    if (!resObj || !resObj.data) continue;
    const { data, query, queryIdx } = resObj;

    // 1. Process Google Shopping results if returned by Serper
    if (Array.isArray(data.shopping)) {
      data.shopping.forEach((item, pos) => {
        const rawUrl = item.link;
        if (!isValidProductUrl(rawUrl)) return;
        if (seenUrls.has(rawUrl)) return;
        seenUrls.add(rawUrl);

        const priceData = item.price ? extractPriceFromText(String(item.price)) : null;
        let domain = "";
        try {
          domain = new URL(rawUrl).hostname.replace(/^www\./, "");
        } catch {
          domain = "unknown";
        }

        const searchResultId = `sres_q${queryIdx}_shop_${pos + 1}_${Math.random().toString(36).slice(2, 7)}`;

        rawCandidates.push({
          searchResultId,
          title: item.title,
          sourceUrl: rawUrl, // IMMUTABLE SOURCE URL
          sourceDomain: domain,
          retailer: item.source || extractRetailer(rawUrl),
          price: priceData ? priceData.amount : null,
          priceFormatted: priceData ? priceData.formatted : item.price || null,
          currency: "INR",
          snippet: item.snippet || item.delivery || "",
          imageUrl: isValidProductUrl(item.imageUrl) ? item.imageUrl : null,
          rating: item.rating ? Number(item.rating) : null,
          ratingCount: item.ratingCount ? Number(item.ratingCount) : null,
          sourceType: "shopping_result",
          searchQuery: query,
          searchPosition: pos + 1,
          retrievedAt,
        });
      });
    }

    // 2. Process Organic search results
    if (Array.isArray(data.organic)) {
      data.organic.forEach((item, pos) => {
        const rawUrl = item.link;
        if (!isValidProductUrl(rawUrl)) return;
        if (seenUrls.has(rawUrl)) return;
        seenUrls.add(rawUrl);

        const combinedText = `${item.title || ""} ${item.snippet || ""}`;
        const priceData = extractPriceFromText(combinedText);
        let domain = "";
        try {
          domain = new URL(rawUrl).hostname.replace(/^www\./, "");
        } catch {
          domain = "unknown";
        }

        const searchResultId = `sres_q${queryIdx}_org_${pos + 1}_${Math.random().toString(36).slice(2, 7)}`;

        rawCandidates.push({
          searchResultId,
          title: item.title,
          sourceUrl: rawUrl, // IMMUTABLE SOURCE URL
          sourceDomain: domain,
          retailer: extractRetailer(rawUrl, item.source),
          price: priceData ? priceData.amount : null,
          priceFormatted: priceData ? priceData.formatted : null,
          currency: "INR",
          snippet: item.snippet || "",
          imageUrl: isValidProductUrl(item.imageUrl) ? item.imageUrl : null,
          rating: item.rating ? Number(item.rating) : null,
          ratingCount: item.ratingCount ? Number(item.ratingCount) : null,
          sourceType: "organic_search",
          searchQuery: query,
          searchPosition: pos + 1,
          retrievedAt,
        });
      });
    }
  }

  // Filter out invalid URLs, category pages, search pages, and review blogs
  const verifiedResults = filterAndScoreSearchResults(rawCandidates);

  logger.info("search_candidates_harvested", {
    rawCount: rawCandidates.length,
    verifiedProductPageCount: verifiedResults.length,
  });

  return verifiedResults;
}
