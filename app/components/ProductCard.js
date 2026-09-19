"use client";

import { useState } from "react";
import { getComparisonAttributes } from "@/lib/categories";

const MATCH_BADGE_CLASSES = {
  "excellent match": "match-tag-excellent",
  "strong match": "match-tag-strong",
  "partial match": "match-tag-partial",
  "poor match": "match-tag-poor",
  "above-budget alternative": "match-tag-above",
};

export default function ProductCard({
  product,
  category,
  isSelectedForCompare,
  onToggleCompare,
  isSaved,
  onToggleSave,
}) {
  const [showAllSpecs, setShowAllSpecs] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const badgeKey = (product.matchClassification || "").toLowerCase();
  const badgeClass = MATCH_BADGE_CLASSES[badgeKey] || "match-tag-partial";

  const comparisonAttrs = getComparisonAttributes(category);

  return (
    <article className={`product-card ${isSelectedForCompare ? "selected-card" : ""}`}>
      {/* Top Bar: Match classification & Actions */}
      <div className="card-top-bar">
        <div className="badge-row">
          <span className={`match-badge ${badgeClass}`}>
            {product.matchClassification}
          </span>
          {product.budgetDelta && (
            <span className="budget-delta-pill">{product.budgetDelta}</span>
          )}
          {product.brand && (
            <span className="brand-pill">{product.brand}</span>
          )}
        </div>

        <div className="card-actions-quick">
          <button
            type="button"
            className={`btn-icon-action ${isSaved ? "saved-active" : ""}`}
            onClick={() => onToggleSave(product)}
            title={isSaved ? "Remove from saved" : "Save for later"}
            aria-label={isSaved ? "Saved product" : "Save product"}
          >
            {isSaved ? "★ Saved" : "☆ Save"}
          </button>

          <label className="compare-checkbox-label">
            <input
              type="checkbox"
              checked={isSelectedForCompare}
              onChange={() => onToggleCompare(product)}
            />
            <span>Compare</span>
          </label>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card-body">
        {/* Product Image if available */}
        {product.imageUrl && (
          <div className="product-image-container">
            <img
              src={product.imageUrl}
              alt={product.title}
              className="product-thumbnail"
              loading="lazy"
              onError={(e) => {
                // If external image fails to load, gracefully hide container
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        <div className="product-details-content">
          <h3 className="product-title">{product.title}</h3>

          <div className="price-retailer-row">
            <div className="price-block">
              <span className="current-price">{product.observedPriceFormatted}</span>
              <span className="price-source-note">Observed live price</span>
            </div>

            <div className="retailer-block">
              <span className="retailer-pill">
                Available at <strong>{product.retailer}</strong>
              </span>
            </div>
          </div>

          {/* Why it matches */}
          {product.matchReasons && product.matchReasons.length > 0 && (
            <div className="why-matches-box">
              <span className="section-small-title">Why it fits your requirements:</span>
              <ul className="why-list">
                {product.matchReasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Specs Grid */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="specs-section">
              <div className="specs-grid">
                {comparisonAttrs.slice(0, showAllSpecs ? comparisonAttrs.length : 4).map((attr) => {
                  const val = product.specs[attr.key];
                  if (!val || val.toLowerCase().includes("not available")) return null;
                  return (
                    <div key={attr.key} className="spec-item">
                      <span className="spec-label">{attr.label}</span>
                      <span className="spec-val">{val}</span>
                    </div>
                  );
                })}
              </div>

              {comparisonAttrs.length > 4 && (
                <button
                  type="button"
                  className="btn-text-toggle"
                  onClick={() => setShowAllSpecs(!showAllSpecs)}
                >
                  {showAllSpecs ? "Show fewer specs" : "Show all verified specs ▾"}
                </button>
              )}
            </div>
          )}

          {/* Pros & Cons */}
          <div className="pros-cons-grid">
            {product.pros && product.pros.length > 0 && (
              <div className="card-pros">
                <span className="pros-title">Strengths</span>
                <ul>
                  {product.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {product.potentialDrawbacks && product.potentialDrawbacks.length > 0 && (
              <div className="card-cons">
                <span className="cons-title">Watch Out For</span>
                <ul>
                  {product.potentialDrawbacks.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Card Footer: View external button & Sources link */}
          <div className="card-footer">
            <div className="sources-collapsible">
              <button
                type="button"
                className="btn-sources-link"
                onClick={() => setShowSources(!showSources)}
              >
                {showSources ? "Hide verified sources" : `Sources (${product.sources?.length || 1}) ▾`}
              </button>

              {showSources && (
                <div className="sources-dropdown">
                  {product.sources && product.sources.length > 0 ? (
                    product.sources.map((s, i) => (
                      <div key={i} className="source-row">
                        <span>{s.retailer}: {s.priceFormatted || "Listing"}</span>
                        <a href={s.link} target="_blank" rel="noopener noreferrer">
                          Visit link ↗
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="source-row">
                      <span>{product.retailer}</span>
                      <a href={product.url} target="_blank" rel="noopener noreferrer">
                        Visit listing ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <a
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-view-product"
            >
              View on {product.retailer} ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
