"use client";

import { useState, useEffect } from "react";
import HeroInput from "./components/HeroInput";
import UnderstoodPanel from "./components/UnderstoodPanel";
import ProductCard from "./components/ProductCard";
import ComparisonDrawer from "./components/ComparisonDrawer";
import HistoryAndSaved from "./components/HistoryAndSaved";

const INITIAL_DISPLAY_LIMIT = 5;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastParams, setLastParams] = useState(null);
  const [data, setData] = useState(null);

  // Sorting & Filtering
  const [sortBy, setSortBy] = useState("best_match");
  const [brandFilter, setBrandFilter] = useState("all");
  const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY_LIMIT);

  // Comparison selection
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  // Local Storage state
  const [history, setHistory] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);

  // Load localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = JSON.parse(localStorage.getItem("cp_history") || "[]");
      setHistory(savedHistory);
      const savedItems = JSON.parse(localStorage.getItem("cp_saved") || "[]");
      setSavedProducts(savedItems);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  function saveSearchToHistory(params, result) {
    try {
      const topMatchTitle = result.matches?.[0]?.title || result.aboveBudgetAlternatives?.[0]?.title || null;
      const entry = {
        query: params.text || result.requirements?.summary || "Product research",
        category: result.requirements?.category,
        budget: result.requirements?.budget?.max,
        topMatch: topMatchTitle,
        time: new Date().toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      const updated = [entry, ...history.filter((h) => h.query !== entry.query)].slice(0, 10);
      setHistory(updated);
      localStorage.setItem("cp_history", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  function handleToggleSave(product) {
    try {
      let updated;
      const exists = savedProducts.some((p) => p.id === product.id);
      if (exists) {
        updated = savedProducts.filter((p) => p.id !== product.id);
      } else {
        updated = [product, ...savedProducts];
      }
      setSavedProducts(updated);
      localStorage.setItem("cp_saved", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }

  function handleToggleCompare(product) {
    setSelectedForCompare((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      if (exists) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (prev.length >= 4) {
        alert("You can compare up to 4 products at a time.");
        return prev;
      }
      return [...prev, product];
    });
  }

  async function executeResearch(payload) {
    setError("");
    setLoading(true);
    setDisplayCount(INITIAL_DISPLAY_LIMIT);
    setSelectedForCompare([]);
    setLastParams(payload);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "We couldn't complete the market search right now. Please try again.");
      }

      setData(json);
      saveSearchToHistory(payload, json);
    } catch (err) {
      setError(err.message || "An unexpected error occurred. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Handle re-researching when user edits requirements in UnderstoodPanel
  function handleUpdateRequirements(editedRequirements) {
    executeResearch({ requirements: editedRequirements });
  }

  // Sorting & Filtering logic
  const rawMatches = data?.matches || [];
  const uniqueBrands = Array.from(new Set(rawMatches.map((m) => m.brand).filter(Boolean)));

  let filteredMatches = rawMatches.filter((m) => {
    if (brandFilter === "all") return true;
    return m.brand?.toLowerCase() === brandFilter.toLowerCase();
  });

  const rankWeight = {
    "Excellent match": 4,
    "Strong match": 3,
    "Partial match": 2,
    "Poor match": 1,
  };

  filteredMatches.sort((a, b) => {
    if (sortBy === "best_match") {
      const diff = (rankWeight[b.matchClassification] || 2) - (rankWeight[a.matchClassification] || 2);
      if (diff !== 0) return diff;
      return (a.observedPrice || 999999) - (b.observedPrice || 999999);
    }
    if (sortBy === "lowest_price") {
      return (a.observedPrice || 999999) - (b.observedPrice || 999999);
    }
    if (sortBy === "highest_price") {
      return (b.observedPrice || 0) - (a.observedPrice || 0);
    }
    return 0;
  });

  const visibleMatches = filteredMatches.slice(0, displayCount);

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <nav className="navbar" aria-label="Main Navigation">
        <div className="nav-container">
          <div className="nav-logo">
            <span className="logo-symbol">₹</span>
            <span className="logo-text">Campus<strong>Price</strong></span>
            <span className="nav-tag">Research Workstation</span>
          </div>

          <div className="nav-links">
            <span className="nav-pill-info">Zero ads · Indian Market · Free</span>
          </div>
        </div>
      </nav>

      <main className="main-content">
        {/* Hero Natural Language Input */}
        <HeroInput onSearch={executeResearch} loading={loading} />

        {/* Error Notification with Retry */}
        {error && (
          <div className="error-banner" role="alert">
            <div className="error-banner-content">
              <span className="error-icon">⚠️</span>
              <div>
                <strong>Research Notice</strong>
                <p>{error}</p>
              </div>
            </div>
            {lastParams && (
              <button
                type="button"
                className="btn-retry"
                onClick={() => executeResearch(lastParams)}
                disabled={loading}
              >
                Try Again ↺
              </button>
            )}
          </div>
        )}

        {/* Research Results Workspace */}
        {data && (
          <section className="results-workspace" aria-label="Research Results">
            {/* 1. What We Understood Panel */}
            <UnderstoodPanel
              requirements={data.requirements}
              onUpdateRequirements={handleUpdateRequirements}
              loading={loading}
            />

            {/* Market Summary Card */}
            {data.marketSummary && (
              <div className="market-summary-card">
                <div className="summary-badge">Live Market Digest</div>
                <p className="summary-text">{data.marketSummary}</p>
              </div>
            )}

            {/* Budget Notice Banner if any */}
            {data.budgetNotice && (
              <div className="budget-notice-card" role="note">
                <span className="budget-notice-icon">ℹ️</span>
                <p>{data.budgetNotice}</p>
              </div>
            )}

            {/* Results Filter & Sort Bar */}
            <div className="results-control-bar">
              <div className="results-counter">
                <h3>Recommended Matches</h3>
                <span className="counter-text">
                  Showing {visibleMatches.length} of {filteredMatches.length} products
                  {data.latencyMs ? ` (researched in ${(data.latencyMs / 1000).toFixed(1)}s)` : ""}
                </span>
              </div>

              <div className="filters-row">
                {uniqueBrands.length > 0 && (
                  <div className="filter-select-wrap">
                    <label htmlFor="brand-filter">Brand:</label>
                    <select
                      id="brand-filter"
                      value={brandFilter}
                      onChange={(e) => setBrandFilter(e.target.value)}
                    >
                      <option value="all">All Brands ({rawMatches.length})</option>
                      {uniqueBrands.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="filter-select-wrap">
                  <label htmlFor="sort-select">Sort by:</label>
                  <select
                    id="sort-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="best_match">Best Requirement Fit</option>
                    <option value="lowest_price">Lowest Observed Price</option>
                    <option value="highest_price">Highest Price</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Product Cards Grid */}
            <div className="products-stack">
              {visibleMatches.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  category={data.requirements?.category}
                  isSelectedForCompare={selectedForCompare.some((p) => p.id === product.id)}
                  onToggleCompare={handleToggleCompare}
                  isSaved={savedProducts.some((p) => p.id === product.id)}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>

            {/* Show More Button */}
            {filteredMatches.length > displayCount && (
              <div className="show-more-wrap">
                <button
                  type="button"
                  className="btn-show-more"
                  onClick={() => setDisplayCount((prev) => prev + 5)}
                >
                  Show More Products ({filteredMatches.length - displayCount} remaining) ▾
                </button>
              </div>
            )}

            {/* Above-Budget Alternatives Section */}
            {data.aboveBudgetAlternatives && data.aboveBudgetAlternatives.length > 0 && (
              <div className="above-budget-section">
                <div className="above-budget-header">
                  <span className="above-budget-tag">Budget Extension</span>
                  <h4>Closest Alternatives Above Budget</h4>
                  <p>
                    These options exceed your specified budget ceiling of ₹
                    {data.requirements?.budget?.max?.toLocaleString("en-IN")}, but offer strong requirement alignment.
                  </p>
                </div>

                <div className="products-stack">
                  {data.aboveBudgetAlternatives.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      category={data.requirements?.category}
                      isSelectedForCompare={selectedForCompare.some((p) => p.id === product.id)}
                      onToggleCompare={handleToggleCompare}
                      isSaved={savedProducts.some((p) => p.id === product.id)}
                      onToggleSave={handleToggleSave}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* History and Saved Bookmarks */}
        <HistoryAndSaved
          history={history}
          savedProducts={savedProducts}
          onSelectHistory={(item) => executeResearch({ text: item.query })}
          onClearHistory={() => {
            setHistory([]);
            localStorage.removeItem("cp_history");
          }}
          onRemoveSaved={(id) => {
            const updated = savedProducts.filter((p) => p.id !== id);
            setSavedProducts(updated);
            localStorage.setItem("cp_saved", JSON.stringify(updated));
          }}
        />
      </main>

      {/* Floating Comparison Drawer & Modal */}
      <ComparisonDrawer
        selectedProducts={selectedForCompare}
        category={data?.requirements?.category || "generic"}
        onClearSelection={() => setSelectedForCompare([])}
        onRemoveProduct={(id) => setSelectedForCompare((prev) => prev.filter((p) => p.id !== id))}
      />

      <footer className="footer-site">
        <div className="footer-content">
          <p>
            <strong>CampusPrice</strong> — AI shopping research workstation for students.
            Prices and specifications reflect live observed data from retailer web pages.
          </p>
          <p className="footer-disclaimer">
            Always confirm availability, warranties, and prices directly with the merchant before purchasing.
          </p>
        </div>
      </footer>
    </div>
  );
}
