// Multi-Query Search Engine for CampusPrice
// Executes targeted searches across Indian retailers and aggregates source-attributed product evidence.

import { validateUrl } from "./security";
import { logger } from "./logger";

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

  // Query 1: High-intent specification & budget target
  const q1Parts = [brandStr, search_seed || category, mustHaveStr, budgetStr, "price India buy online"].filter(Boolean);
  queries.push(q1Parts.join(" "));

  // Query 2: Multi-retailer direct market listings (Amazon, Flipkart, Croma, etc.)
  const q2Parts = [category, mustHaveStr, useCaseStr, budgetStr, "buy online site:amazon.in OR site:flipkart.com OR site:croma.com"].filter(Boolean);
  queries.push(q2Parts.join(" "));

  // Query 3: Candidate recommendations for specific use-case
  if (useCaseStr || mustHaveStr) {
    const q3Parts = ["best", category, "for", useCaseStr || mustHaveStr, budgetStr, "India price specs"].filter(Boolean);
    queries.push(q3Parts.join(" "));
  }

  // Remove duplicates
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
      num: 10,
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
function extractRetailer(link, sourceTitle = "") {
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
    return sourceTitle || host;
  } catch {
    return sourceTitle || "Online Store";
  }
}

/**
 * Extract price number and string from title/snippet
 */
function extractPriceFromText(text) {
  if (!text) return null;
  // Match patterns like ₹64,999, Rs. 64,999, Rs 64999, INR 64,999
  const match = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (match && match[1]) {
    const num = parseInt(match[1].replace(/,/g, ""), 10);
    if (!isNaN(num) && num > 0 && num < 10000000) {
      return {
        amount: num,
        formatted: `₹${num.toLocaleString("en-IN")}`,
      };
    }
  }
  return null;
}

/**
 * Execute multi-query search and harvest candidate products
 */
export async function searchProducts(requirements) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error("SERPER_API_KEY is not configured in .env.local.");
  }

  const queries = generateSearchQueries(requirements);
  logger.info("search_queries_generated", { queries });

  const searchPromises = queries.map((q) =>
    fetchSerperQuery(q, apiKey).catch((err) => {
      logger.warn("serper_single_query_failed", { query: q, error: err.message });
      return null;
    })
  );

  const results = await Promise.all(searchPromises);

  const rawCandidates = [];
  const seenUrls = new Set();

  for (const data of results) {
    if (!data) continue;

    // 1. Process Google Shopping results if returned by Serper
    if (Array.isArray(data.shopping)) {
      for (const item of data.shopping) {
        const link = validateUrl(item.link);
        if (!link || seenUrls.has(link)) continue;
        seenUrls.add(link);

        const priceData = item.price ? extractPriceFromText(String(item.price)) : null;

        rawCandidates.push({
          title: item.title,
          link,
          retailer: item.source || extractRetailer(link),
          price: priceData ? priceData.amount : null,
          priceFormatted: priceData ? priceData.formatted : item.price || null,
          snippet: item.snippet || item.delivery || "",
          imageUrl: validateUrl(item.imageUrl) || null,
          rating: item.rating ? Number(item.rating) : null,
          ratingCount: item.ratingCount ? Number(item.ratingCount) : null,
          sourceType: "shopping_result",
        });
      }
    }

    // 2. Process Organic search results
    if (Array.isArray(data.organic)) {
      for (const item of data.organic) {
        const link = validateUrl(item.link);
        if (!link || seenUrls.has(link)) continue;
        seenUrls.add(link);

        const combinedText = `${item.title || ""} ${item.snippet || ""}`;
        const priceData = extractPriceFromText(combinedText);

        rawCandidates.push({
          title: item.title,
          link,
          retailer: extractRetailer(link, item.source),
          price: priceData ? priceData.amount : null,
          priceFormatted: priceData ? priceData.formatted : null,
          snippet: item.snippet || "",
          imageUrl: validateUrl(item.imageUrl) || null,
          rating: item.rating ? Number(item.rating) : null,
          ratingCount: item.ratingCount ? Number(item.ratingCount) : null,
          sourceType: "organic_search",
        });
      }
    }
  }

  logger.info("search_candidates_harvested", { count: rawCandidates.length });
  return rawCandidates;
}
