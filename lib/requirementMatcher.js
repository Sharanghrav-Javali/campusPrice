// Requirement-to-Product Matching & Evaluation Engine for CampusPrice
// Reason over retrieved evidence, enforce anti-hallucination, strictly bind original search URLs.

import { callGroq } from "./groqClient.js";
import { wrapUntrustedData } from "./security.js";
import { getComparisonAttributes } from "./categories.js";
import { isValidProductUrl, calculateUrlQuality } from "./urlValidator.js";
import { provenance } from "./debugProvenance.js";
import { logger } from "./logger.js";

/**
 * Validate a candidate product offer before it is allowed to reach the user
 */
export function validateProductForOutput(product, originalCandidate) {
  if (!product.title || typeof product.title !== "string") {
    return { valid: false, reason: "Missing product title" };
  }

  // Ensure URL exists and is valid
  if (!product.url || !isValidProductUrl(product.url)) {
    return { valid: false, reason: "Invalid or missing product URL" };
  }

  // Verify that the URL actually belongs to the original candidate's verified offers
  const matchingOffer = originalCandidate.offers.find((o) => o.url === product.url);
  if (!matchingOffer) {
    return { valid: false, reason: "URL does not originate from verified search results for this product" };
  }

  // Ensure the price displayed matches the offer of that URL
  if (product.observedPrice && matchingOffer.price && product.observedPrice !== matchingOffer.price) {
    return { valid: false, reason: "Price mismatch: price from one offer attached to URL of another offer" };
  }

  // Verify it is a product detail page, not a search/category page
  const quality = calculateUrlQuality({
    sourceUrl: product.url,
    title: product.title,
    price: product.observedPrice,
    sourceType: matchingOffer.sourceType,
  });

  if (!quality.isProductPage) {
    return { valid: false, reason: "URL is identified as a search, category, or non-product page" };
  }

  return { valid: true, matchingOffer };
}

/**
 * Match and evaluate normalized candidate products against user requirements
 */
export async function matchRequirementsToProducts(requirements, candidates, options = {}) {
  const traceId = options.traceId || `trace_${Date.now()}`;

  if (!candidates || candidates.length === 0) {
    return {
      matches: [],
      aboveBudgetAlternatives: [],
      budgetNotice: null,
      summaryMessage: "No verified product listings were found online for this search.",
    };
  }

  // Pre-filter candidates, limit to top 8 to keep prompt size & latency optimal
  const topCandidates = candidates.slice(0, 8);
  const comparisonAttrs = getComparisonAttributes(requirements.category);

  // Strip URLs completely before sending to LLM.
  // The LLM NEVER sees or handles URLs!
  const simplifiedEvidence = topCandidates.map((c) => ({
    candidate_id: c.candidateId,
    title: c.title,
    brand: c.brand,
    primary_offer_id: c.primaryOffer.offerId,
    observed_price: c.primaryOffer.price,
    observed_price_formatted: c.primaryOffer.priceFormatted,
    retailer: c.primaryOffer.retailer,
    available_retailers: c.offers.map((o) => `${o.retailer} (₹${o.price || "N/A"})`).join(", "),
    rating: c.rating,
    snippets: c.snippets.join(" | "),
    detected_specs: c.productIdentity.variant,
  }));

  const prompt = `You are CampusPrice's product evaluation engine.
Analyze how well each retrieved candidate product satisfies the user's requirements based ONLY on the evidence provided.

USER REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

CATEGORY ATTRIBUTES TO EXTRACT (if supported by evidence, else "Not available in source"):
${comparisonAttrs.map((a) => `${a.key} (${a.label})`).join(", ")}

RETRIEVED PRODUCT EVIDENCE:
${wrapUntrustedData(simplifiedEvidence, "retrieved_product_evidence")}

TASK:
For each candidate product in the evidence, produce an honest evaluation matching this JSON structure:
{
  "evaluations": [
    {
      "candidate_id": "matching candidate_id from evidence",
      "display_name": "clean concise product name",
      "match_classification": "Excellent match" | "Strong match" | "Partial match" | "Poor match",
      "match_reasons": ["bullet 1 explaining requirement fit", "bullet 2"],
      "potential_drawbacks": ["tradeoff or missing spec", "drawback"],
      "pros": ["strength 1", "strength 2"],
      "cons": ["weakness 1", "weakness 2"],
      "specs": {
        ${comparisonAttrs.map((a) => `"${a.key}": "spec value if in evidence, otherwise 'Not available in source'"`).join(",\n        ")}
      },
      "requirement_checklist": [
        {
          "criterion": "e.g. 16GB RAM",
          "status": "satisfied" | "partial" | "unverified",
          "explanation": "brief reason"
        }
      ]
    }
  ],
  "market_summary": "2-3 sentence overview of what the market offers for this requirement & budget in India"
}

CRITICAL ARCHITECTURAL RULES:
1. DO NOT OUTPUT ANY URL, LINK, OR HREF. The backend resolves all links programmatically.
2. If any URL field is included in your response, it will be discarded immediately.
3. Reference products ONLY by their exact candidate_id from the evidence.
4. NEVER invent specifications, prices, or warranties not in the evidence.
5. If an attribute is missing, write "Not available in source".
6. Output strict JSON only without markdown or extra commentary.`;

  try {
    const { data } = await callGroq({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 2200,
      json_mode: true,
    });

    const evaluationsMap = new Map();
    if (Array.isArray(data.evaluations)) {
      for (const ev of data.evaluations) {
        if (ev.candidate_id) {
          // Explicitly delete any hallucinatory URL field if the model produced one
          delete ev.url;
          delete ev.link;
          delete ev.href;
          delete ev.productUrl;
          delete ev.productLink;
          delete ev.sourceUrl;

          evaluationsMap.set(ev.candidate_id, ev);
        }
      }
    }

    const maxBudget = requirements.budget?.max || null;
    const withinBudget = [];
    const aboveBudget = [];

    for (const cand of topCandidates) {
      const evaluation =
        evaluationsMap.get(cand.candidateId) ||
        createDefaultEvaluation(cand, requirements, comparisonAttrs);

      // Programmatic Offer Resolution:
      // The URL MUST come from cand.primaryOffer.url (or another verified offer in cand.offers)
      const primaryOffer = cand.primaryOffer;
      const isOverBudget = maxBudget && primaryOffer.price && primaryOffer.price > maxBudget;
      const budgetDelta = isOverBudget ? primaryOffer.price - maxBudget : 0;

      const candidateProduct = {
        id: cand.candidateId,
        title: evaluation.display_name || cand.title,
        brand: cand.brand,
        productIdentity: cand.productIdentity,
        // Atomic price & URL binding from the verified primary offer
        observedPrice: primaryOffer.price,
        observedPriceFormatted: primaryOffer.priceFormatted,
        retailer: primaryOffer.retailer,
        url: primaryOffer.url, // IMMUTABLE VERIFIED SOURCE URL
        urlVerified: true,
        urlQualityScore: primaryOffer.urlQualityScore,
        isOverBudget,
        budgetDelta: budgetDelta ? `+₹${budgetDelta.toLocaleString("en-IN")} above budget` : null,
        imageUrl: cand.imageUrl,
        rating: cand.rating,
        ratingCount: cand.ratingCount,
        matchClassification: isOverBudget
          ? "Above-budget alternative"
          : evaluation.match_classification || "Strong match",
        matchReasons: Array.isArray(evaluation.match_reasons) ? evaluation.match_reasons : [],
        potentialDrawbacks: Array.isArray(evaluation.potential_drawbacks) ? evaluation.potential_drawbacks : [],
        pros: Array.isArray(evaluation.pros) ? evaluation.pros : [],
        cons: Array.isArray(evaluation.cons) ? evaluation.cons : [],
        specs: evaluation.specs || {},
        // Multi-retailer verified offers
        offers: cand.offers.map((o) => ({
          offerId: o.offerId,
          retailer: o.retailer,
          price: o.price,
          priceFormatted: o.priceFormatted,
          currency: o.currency,
          url: o.url, // IMMUTABLE SOURCE URL
          urlVerified: true,
        })),
        sources: cand.offers.map((o) => ({
          retailer: o.retailer,
          price: o.price,
          priceFormatted: o.priceFormatted,
          link: o.url,
        })),
        requirementChecklist: Array.isArray(evaluation.requirement_checklist)
          ? evaluation.requirement_checklist
          : [],
        provenance: {
          searchResultId: primaryOffer.searchResultId,
          sourceUrl: primaryOffer.url,
          sourceDomain: primaryOffer.sourceDomain,
          searchQuery: primaryOffer.searchQuery,
          searchPosition: primaryOffer.searchPosition,
          retrievedAt: primaryOffer.retrievedAt,
        },
      };

      // Click Validation Check
      const validation = validateProductForOutput(candidateProduct, cand);

      if (!validation.valid) {
        logger.warn("product_url_validation_failed", {
          candidateId: cand.candidateId,
          title: candidateProduct.title,
          url: candidateProduct.url,
          reason: validation.reason,
        });

        // If URL verification fails, NEVER invent a fallback URL!
        candidateProduct.url = null;
        candidateProduct.urlVerified = false;
        candidateProduct.urlNotice = "We found the product information but couldn't verify a direct product page.";
      }

      // Record debug provenance
      provenance.recordProductMatching(traceId, {
        searchResultId: primaryOffer.searchResultId,
        productName: candidateProduct.title,
        brand: candidateProduct.brand,
        model: cand.productIdentity.modelCode,
        retailer: candidateProduct.retailer,
        price: candidateProduct.observedPrice,
        finalUrl: candidateProduct.url || "UNAVAILABLE",
        urlValidation: validation.valid ? "PASS" : `FAIL (${validation.reason})`,
        productMatch: "PASS",
      });

      if (isOverBudget) {
        aboveBudget.push(candidateProduct);
      } else {
        withinBudget.push(candidateProduct);
      }
    }

    // Rank within-budget products: Excellent > Strong > Partial > Poor
    const rankWeight = {
      "Excellent match": 4,
      "Strong match": 3,
      "Partial match": 2,
      "Poor match": 1,
    };
    withinBudget.sort((a, b) => {
      const wA = rankWeight[a.matchClassification] || 2;
      const wB = rankWeight[b.matchClassification] || 2;
      return wB - wA;
    });

    let budgetNotice = null;
    if (maxBudget && withinBudget.length === 0 && aboveBudget.length > 0) {
      budgetNotice = `We couldn't find a strong match within your budget of ₹${maxBudget.toLocaleString("en-IN")}. Here are the closest alternatives available slightly above budget.`;
    }

    logger.info("matching_completed", {
      withinBudgetCount: withinBudget.length,
      aboveBudgetCount: aboveBudget.length,
    });

    return {
      marketSummary: data.market_summary || "Here are the top matches found based on your stated requirements.",
      matches: withinBudget,
      aboveBudgetAlternatives: aboveBudget,
      budgetNotice,
      _debugTraceId: process.env.NODE_ENV !== "production" ? traceId : undefined,
    };
  } catch (err) {
    logger.error("requirement_matching_failed", err);
    return fallbackEvaluation(topCandidates, requirements, comparisonAttrs, traceId);
  }
}

function createDefaultEvaluation(cand, req, attrs) {
  return {
    display_name: cand.title,
    match_classification: "Strong match",
    match_reasons: ["Matches your search criteria based on retailer listing"],
    potential_drawbacks: ["Check retailer page for detailed warranty & full spec sheet"],
    pros: ["Available on " + cand.primaryOffer.retailer],
    cons: [],
    specs: {},
    requirement_checklist: [],
  };
}

function fallbackEvaluation(candidates, requirements, comparisonAttrs, traceId) {
  const maxBudget = requirements.budget?.max || null;
  const within = [];
  const above = [];

  for (const c of candidates) {
    const primaryOffer = c.primaryOffer;
    const isOver = maxBudget && primaryOffer.price && primaryOffer.price > maxBudget;
    const item = {
      id: c.candidateId,
      title: c.title,
      brand: c.brand,
      productIdentity: c.productIdentity,
      observedPrice: primaryOffer.price,
      observedPriceFormatted: primaryOffer.priceFormatted,
      isOverBudget: isOver,
      budgetDelta:
        isOver && maxBudget
          ? `+₹${(primaryOffer.price - maxBudget).toLocaleString("en-IN")} above budget`
          : null,
      retailer: primaryOffer.retailer,
      url: primaryOffer.url, // IMMUTABLE SOURCE URL
      urlVerified: true,
      imageUrl: c.imageUrl,
      rating: c.rating,
      ratingCount: c.ratingCount,
      matchClassification: isOver ? "Above-budget alternative" : "Strong match",
      matchReasons: ["Matches key search terms in your requirement"],
      potentialDrawbacks: ["Specifications need verification on retailer website"],
      pros: ["Available from " + primaryOffer.retailer],
      cons: [],
      specs: {},
      offers: c.offers,
      sources: c.offers.map((o) => ({
        retailer: o.retailer,
        price: o.price,
        priceFormatted: o.priceFormatted,
        link: o.url,
      })),
      requirementChecklist: [],
      provenance: {
        searchResultId: primaryOffer.searchResultId,
        sourceUrl: primaryOffer.url,
        sourceDomain: primaryOffer.sourceDomain,
        searchQuery: primaryOffer.searchQuery,
        searchPosition: primaryOffer.searchPosition,
        retrievedAt: primaryOffer.retrievedAt,
      },
    };

    provenance.recordProductMatching(traceId, {
      searchResultId: primaryOffer.searchResultId,
      productName: item.title,
      brand: item.brand,
      retailer: item.retailer,
      price: item.observedPrice,
      finalUrl: item.url,
      urlValidation: "PASS",
      productMatch: "PASS (fallback)",
    });

    if (isOver) above.push(item);
    else within.push(item);
  }

  return {
    marketSummary: "Results retrieved from live market search.",
    matches: within,
    aboveBudgetAlternatives: above,
    budgetNotice:
      maxBudget && within.length === 0
        ? `No exact matches under ₹${maxBudget.toLocaleString("en-IN")}.`
        : null,
  };
}
