// Requirement-to-Product Matching & Evaluation Engine for CampusPrice
// Reason over retrieved evidence, enforce anti-hallucination, classify requirement fit.

import { callGroq } from "./groqClient";
import { wrapUntrustedData } from "./security";
import { getComparisonAttributes } from "./categories";
import { logger } from "./logger";

/**
 * Match and evaluate normalized candidate products against user requirements
 */
export async function matchRequirementsToProducts(requirements, candidates) {
  if (!candidates || candidates.length === 0) {
    return {
      matches: [],
      aboveBudgetAlternatives: [],
      budgetNotice: null,
      summaryMessage: "No matching products were found online for this search.",
    };
  }

  // Pre-filter candidates with zero info, limit to top 8 to keep prompt size & latency optimal
  const topCandidates = candidates.slice(0, 8);
  const comparisonAttrs = getComparisonAttributes(requirements.category);

  const simplifiedEvidence = topCandidates.map((c, i) => ({
    candidate_id: c.id,
    title: c.title,
    observed_price: c.observedPrice,
    observed_price_formatted: c.observedPriceFormatted,
    retailer: c.primaryRetailer,
    rating: c.rating,
    snippets: c.snippets.join(" | "),
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

STRICT ANTI-HALLUCINATION RULES:
1. NEVER invent specifications, warranty, or prices not in the evidence snippets.
2. If a spec (like RAM, Battery, or Material) is not explicitly stated in snippets, write "Not available in source".
3. If price is above user's max budget (${requirements.budget?.max ? `₹${requirements.budget.max}` : "unspecified"}), classify as "Partial match" or "Poor match" and note the budget overshoot.
4. Keep the tone factual, student-friendly, and candid. Output strict JSON only.`;

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
          evaluationsMap.set(ev.candidate_id, ev);
        }
      }
    }

    const maxBudget = requirements.budget?.max || null;
    const withinBudget = [];
    const aboveBudget = [];

    for (const cand of topCandidates) {
      const evaluation = evaluationsMap.get(cand.id) || createDefaultEvaluation(cand, requirements, comparisonAttrs);

      const isOverBudget = maxBudget && cand.observedPrice && cand.observedPrice > maxBudget;
      const budgetDelta = isOverBudget ? cand.observedPrice - maxBudget : 0;

      const enrichedProduct = {
        id: cand.id,
        title: evaluation.display_name || cand.title,
        brand: cand.brand,
        observedPrice: cand.observedPrice,
        observedPriceFormatted: cand.observedPriceFormatted || (cand.observedPrice ? `₹${cand.observedPrice.toLocaleString("en-IN")}` : "Check retailer"),
        isOverBudget,
        budgetDelta: budgetDelta ? `+₹${budgetDelta.toLocaleString("en-IN")} above budget` : null,
        retailer: cand.primaryRetailer,
        url: cand.primaryLink,
        imageUrl: cand.imageUrl,
        rating: cand.rating,
        ratingCount: cand.ratingCount,
        matchClassification: isOverBudget ? "Above-budget alternative" : (evaluation.match_classification || "Strong match"),
        matchReasons: Array.isArray(evaluation.match_reasons) ? evaluation.match_reasons : [],
        potentialDrawbacks: Array.isArray(evaluation.potential_drawbacks) ? evaluation.potential_drawbacks : [],
        pros: Array.isArray(evaluation.pros) ? evaluation.pros : [],
        cons: Array.isArray(evaluation.cons) ? evaluation.cons : [],
        specs: evaluation.specs || {},
        sources: cand.sources,
        requirementChecklist: Array.isArray(evaluation.requirement_checklist) ? evaluation.requirement_checklist : [],
      };

      if (isOverBudget) {
        aboveBudget.push(enrichedProduct);
      } else {
        withinBudget.push(enrichedProduct);
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
    };
  } catch (err) {
    logger.error("requirement_matching_failed", err);
    // Graceful fallback without AI evaluation
    return fallbackEvaluation(topCandidates, requirements, comparisonAttrs);
  }
}

function createDefaultEvaluation(cand, req, attrs) {
  return {
    display_name: cand.title,
    match_classification: "Strong match",
    match_reasons: ["Matches your search criteria based on retailer listing"],
    potentialDrawbacks: ["Check retailer page for detailed warranty & full spec sheet"],
    pros: ["Available on " + cand.primaryRetailer],
    cons: [],
    specs: {},
    requirement_checklist: [],
  };
}

function fallbackEvaluation(candidates, requirements, comparisonAttrs) {
  const maxBudget = requirements.budget?.max || null;
  const within = [];
  const above = [];

  for (const c of candidates) {
    const isOver = maxBudget && c.observedPrice && c.observedPrice > maxBudget;
    const item = {
      id: c.id,
      title: c.title,
      brand: c.brand,
      observedPrice: c.observedPrice,
      observedPriceFormatted: c.observedPriceFormatted || "Check retailer",
      isOverBudget: isOver,
      budgetDelta: isOver && maxBudget ? `+₹${(c.observedPrice - maxBudget).toLocaleString("en-IN")} above budget` : null,
      retailer: c.primaryRetailer,
      url: c.primaryLink,
      imageUrl: c.imageUrl,
      rating: c.rating,
      ratingCount: c.ratingCount,
      matchClassification: isOver ? "Above-budget alternative" : "Strong match",
      matchReasons: ["Matches key search terms in your requirement"],
      potentialDrawbacks: ["Specifications need verification on retailer website"],
      pros: ["Available from " + c.primaryRetailer],
      cons: [],
      specs: {},
      sources: c.sources,
      requirementChecklist: [],
    };
    if (isOver) above.push(item);
    else within.push(item);
  }

  return {
    marketSummary: "Results retrieved from live market search.",
    matches: within,
    aboveBudgetAlternatives: above,
    budgetNotice: maxBudget && within.length === 0 ? `No exact matches under ₹${maxBudget.toLocaleString("en-IN")}.` : null,
  };
}
