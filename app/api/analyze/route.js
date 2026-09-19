import { NextResponse } from "next/server";
import { extractRequirements } from "@/lib/requirementExtractor";
import { searchProducts } from "@/lib/searchEngine";
import { normalizeAndDeduplicate } from "@/lib/productNormalizer";
import { matchRequirementsToProducts } from "@/lib/requirementMatcher";

// Backwards-compatible route for legacy CampusPrice API calls
export async function POST(req) {
  try {
    const { product, budget } = await req.json();

    if (!product || !product.trim()) {
      return NextResponse.json(
        { error: "Please enter a product name or requirement." },
        { status: 400 }
      );
    }

    const requirements = await extractRequirements(product, { budget });
    const rawCandidates = await searchProducts(requirements);

    if (rawCandidates.length === 0) {
      return NextResponse.json(
        { error: "No search results found. Try a more specific description." },
        { status: 404 }
      );
    }

    const normalized = normalizeAndDeduplicate(rawCandidates);
    const evaluation = await matchRequirementsToProducts(requirements, normalized);

    const topProduct = evaluation.matches[0] || evaluation.aboveBudgetAlternatives[0] || null;

    // Adapt to legacy shape
    return NextResponse.json({
      product: topProduct ? topProduct.title : product,
      verdict: topProduct ? (topProduct.matchClassification === "Excellent match" ? "Buy now" : "Wait") : "Unclear",
      summary: evaluation.marketSummary,
      best_price: topProduct
        ? {
            source: topProduct.retailer,
            price: topProduct.observedPriceFormatted,
            link: topProduct.url,
          }
        : null,
      comparisons: (evaluation.matches.slice(0, 4) || []).map((m) => ({
        source: m.retailer,
        price: m.observedPriceFormatted,
        link: m.url,
        notes: m.matchClassification,
      })),
      pros: topProduct?.pros || [],
      cons: topProduct?.cons || [],
      tips: evaluation.marketSummary,
    });
  } catch (err) {
    console.error("legacy_analyze_error", err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
