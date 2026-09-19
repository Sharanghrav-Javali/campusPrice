// Debug Provenance Tracker for Development Mode
// Tracks: User query -> Search Query -> Raw Result -> Result ID -> Product Identification -> Selected Result ID -> Final URL -> URL Validation Result
// Strictly disabled in production.

const isDev = process.env.NODE_ENV !== "production";

class ProvenanceStore {
  constructor() {
    this.traces = new Map();
  }

  createTrace(traceId, initialData = {}) {
    if (!isDev) return;
    this.traces.set(traceId, {
      traceId,
      createdAt: new Date().toISOString(),
      userRequest: initialData.userRequest || "",
      searchQueries: initialData.searchQueries || [],
      rawResultsCount: 0,
      candidates: [],
      selectedMatches: [],
    });
  }

  recordRawResults(traceId, results = []) {
    if (!isDev) return;
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.rawResultsCount = results.length;
    trace.rawSample = results.slice(0, 5).map((r) => ({
      searchResultId: r.searchResultId,
      title: r.title,
      sourceUrl: r.sourceUrl,
      retailer: r.retailer,
      price: r.price,
      qualityScore: r.urlQualityScore,
      searchPosition: r.searchPosition,
    }));
  }

  recordProductMatching(traceId, matchData) {
    if (!isDev) return;
    const trace = this.traces.get(traceId);
    if (!trace) return;
    trace.selectedMatches.push({
      searchResultId: matchData.searchResultId,
      productName: matchData.productName,
      brand: matchData.brand,
      model: matchData.model,
      selectedOffer: {
        retailer: matchData.retailer,
        price: matchData.price,
        finalUrl: matchData.finalUrl,
      },
      urlValidation: matchData.urlValidation || "PASS",
      productMatch: matchData.productMatch || "PASS",
    });

    // Output formatted development console log
    console.log(`\n--- [PROVENANCE TRACE: ${traceId}] ---`);
    console.log(`Selected result ID : ${matchData.searchResultId}`);
    console.log(`Product            : ${matchData.productName}`);
    console.log(`Original Source URL: ${matchData.finalUrl}`);
    console.log(`URL Validation     : ${matchData.urlValidation || "PASS"}`);
    console.log(`Product Match      : ${matchData.productMatch || "PASS"}`);
    console.log(`Final URL          : ${matchData.finalUrl}\n`);
  }

  getTrace(traceId) {
    if (!isDev) return null;
    return this.traces.get(traceId) || null;
  }
}

export const provenance = new ProvenanceStore();
