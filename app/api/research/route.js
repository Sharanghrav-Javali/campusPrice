import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sanitizeUserInput } from "@/lib/security";
import { extractRequirements } from "@/lib/requirementExtractor";
import { searchProducts } from "@/lib/searchEngine";
import { normalizeAndDeduplicate } from "@/lib/productNormalizer";
import { matchRequirementsToProducts } from "@/lib/requirementMatcher";
import { getCategoryConfig } from "@/lib/categories";
import { provenance } from "@/lib/debugProvenance";
import { logger } from "@/lib/logger";

export async function POST(req) {
  const startTime = Date.now();
  const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(ip, { limit: 12, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many research requests. Please wait a minute before searching again." },
        { status: 429, headers: { "Retry-After": Math.ceil(rateCheck.resetInMs / 1000).toString() } }
      );
    }

    const body = await req.json();
    let { text, requirements, budget, condition, brands, additional_requirements } = body;

    // Phase 1: Extract or validate requirements
    if (!requirements) {
      const sanitized = sanitizeUserInput(text);
      if (!sanitized) {
        return NextResponse.json(
          { error: "Please describe what product you are looking for." },
          { status: 400 }
        );
      }
      requirements = await extractRequirements(sanitized, {
        budget,
        condition,
        brands,
        additional_requirements,
      });
    }

    provenance.createTrace(traceId, {
      userRequest: requirements.raw_query || text,
    });

    // Phase 2: Multi-Query Search with Verified Product Page URLs
    let rawCandidates = [];
    try {
      rawCandidates = await searchProducts(requirements);
    } catch (searchErr) {
      logger.error("search_failed", searchErr);
      return NextResponse.json(
        {
          error:
            "Could not complete the market search right now. Please check your network connection and try again.",
        },
        { status: 502 }
      );
    }

    provenance.recordRawResults(traceId, rawCandidates);

    if (rawCandidates.length === 0) {
      return NextResponse.json({
        requirements,
        category: getCategoryConfig(requirements.category),
        marketSummary: "We couldn't find live listings matching this specific requirement.",
        matches: [],
        aboveBudgetAlternatives: [],
        budgetNotice: "No retailer listings found. Try broadening your criteria or budget.",
        totalFound: 0,
        latencyMs: Date.now() - startTime,
      });
    }

    // Phase 3: Exact Configuration Normalization & Deduplication
    const normalized = normalizeAndDeduplicate(rawCandidates);

    // Phase 4: Requirement Matching & Immutable URL Binding
    const evaluation = await matchRequirementsToProducts(requirements, normalized, { traceId });

    const categoryConfig = getCategoryConfig(requirements.category);

    logger.info("research_pipeline_success", {
      category: requirements.category,
      rawFound: rawCandidates.length,
      normalizedCount: normalized.length,
      matchCount: evaluation.matches.length,
      latencyMs: Date.now() - startTime,
    });

    const responsePayload = {
      requirements,
      category: categoryConfig,
      marketSummary: evaluation.marketSummary,
      matches: evaluation.matches,
      aboveBudgetAlternatives: evaluation.aboveBudgetAlternatives,
      budgetNotice: evaluation.budgetNotice,
      totalFound: normalized.length,
      latencyMs: Date.now() - startTime,
    };

    // Dev-only debug provenance trace (never included in production)
    if (process.env.NODE_ENV !== "production") {
      const url = new URL(req.url);
      if (url.searchParams.get("debug") === "1" || body.debug === true) {
        responsePayload._debugProvenance = provenance.getTrace(traceId);
      }
    }

    return NextResponse.json(responsePayload);
  } catch (err) {
    logger.error("research_pipeline_fatal", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred during research. Please try again." },
      { status: 500 }
    );
  }
}
