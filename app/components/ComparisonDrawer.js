"use client";

import { useState, useEffect } from "react";
import { getComparisonAttributes, getCategoryConfig } from "@/lib/categories";

export default function ComparisonDrawer({
  selectedProducts,
  category,
  onClearSelection,
  onRemoveProduct,
}) {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!selectedProducts || selectedProducts.length === 0) return null;

  const categoryConf = getCategoryConfig(category);
  const comparisonAttrs = getComparisonAttributes(category);

  // Calculate lowest price among selected for highlighting
  const prices = selectedProducts
    .map((p) => p.observedPrice)
    .filter((p) => typeof p === "number" && p > 0);
  const lowestPrice = prices.length > 0 ? Math.min(...prices) : null;

  return (
    <>
      {/* Docked Sticky Bar at Bottom */}
      <div className="comparison-dock" role="region" aria-label="Comparison dock">
        <div className="dock-content">
          <div className="dock-info">
            <span className="dock-count-badge">{selectedProducts.length}</span>
            <span className="dock-text">
              product{selectedProducts.length > 1 ? "s" : ""} selected for comparison
            </span>
            <div className="dock-selected-thumbnails">
              {selectedProducts.map((p) => (
                <span key={p.id} className="dock-product-pill">
                  {p.title.slice(0, 18)}...
                  <button
                    type="button"
                    className="dock-remove-btn"
                    onClick={() => onRemoveProduct(p.id)}
                    aria-label={`Remove ${p.title} from comparison`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="dock-actions">
            <button
              type="button"
              className="btn-clear-dock"
              onClick={onClearSelection}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-compare-dock"
              onClick={() => setIsOpen(true)}
            >
              Compare Selected ({selectedProducts.length}) →
            </button>
          </div>
        </div>
      </div>

      {/* Comparison Modal Overlay */}
      {isOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Product Comparison">
          <div className="comparison-modal-card">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-category-icon">{categoryConf.icon || "📊"}</span>
                <div>
                  <h3 className="modal-title">Side-by-Side {categoryConf.label} Comparison</h3>
                  <p className="modal-subtitle">
                    Comparing {selectedProducts.length} items based on verified retailer evidence
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setIsOpen(false)}
                aria-label="Close comparison"
              >
                ✕
              </button>
            </div>

            <div className="modal-scroll-area">
              <table className="comparison-table">
                <thead>
                  <tr>
                    <th className="sticky-col header-cell">Product</th>
                    {selectedProducts.map((p) => (
                      <th key={p.id} className="product-col-header">
                        <div className="th-title">{p.title}</div>
                        <div className="th-retailer">on {p.retailer}</div>
                        {p.urlVerified && p.url ? (
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="th-visit-btn"
                          >
                            View ↗
                          </a>
                        ) : (
                          <span className="th-no-link" title="Product link unavailable">
                            Link unavailable
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {/* Price Row */}
                  <tr>
                    <td className="sticky-col row-label">Observed Price</td>
                    {selectedProducts.map((p) => (
                      <td key={p.id} className="row-value price-cell">
                        <strong>{p.observedPriceFormatted}</strong>
                        {lowestPrice && p.observedPrice === lowestPrice && (
                          <span className="lowest-pill">Lowest Price</span>
                        )}
                        {p.budgetDelta && (
                          <div className="cell-delta">{p.budgetDelta}</div>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Match Classification */}
                  <tr>
                    <td className="sticky-col row-label">Requirement Fit</td>
                    {selectedProducts.map((p) => (
                      <td key={p.id} className="row-value">
                        <span className="table-match-badge">{p.matchClassification}</span>
                      </td>
                    ))}
                  </tr>

                  {/* Category-Specific Attributes */}
                  {comparisonAttrs.map((attr) => (
                    <tr key={attr.key}>
                      <td className="sticky-col row-label">{attr.label}</td>
                      {selectedProducts.map((p) => {
                        const val = p.specs?.[attr.key] || "Not available in source";
                        const isMissing = val.toLowerCase().includes("not available");
                        return (
                          <td
                            key={p.id}
                            className={`row-value ${isMissing ? "cell-missing" : "cell-highlight"}`}
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* Strengths Row */}
                  <tr>
                    <td className="sticky-col row-label">Key Strengths</td>
                    {selectedProducts.map((p) => (
                      <td key={p.id} className="row-value pros-list-cell">
                        {p.pros && p.pros.length > 0 ? (
                          <ul>
                            {p.pros.map((pro, i) => (
                              <li key={i}>{pro}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="cell-dim">—</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Drawbacks Row */}
                  <tr>
                    <td className="sticky-col row-label">Trade-offs / Drawbacks</td>
                    {selectedProducts.map((p) => (
                      <td key={p.id} className="row-value cons-list-cell">
                        {p.potentialDrawbacks && p.potentialDrawbacks.length > 0 ? (
                          <ul>
                            {p.potentialDrawbacks.map((con, i) => (
                              <li key={i}>{con}</li>
                            ))}
                          </ul>
                        ) : (
                          <span className="cell-dim">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <span className="modal-footer-note">
                Specifications and prices reflect live observed data from retailer snippets. Always verify details on the retailer's page before purchasing.
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsOpen(false)}
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
