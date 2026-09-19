"use client";

import { useState } from "react";

export default function HistoryAndSaved({
  history,
  savedProducts,
  onSelectHistory,
  onClearHistory,
  onRemoveSaved,
}) {
  const [activeTab, setActiveTab] = useState("history");

  if (history.length === 0 && savedProducts.length === 0) {
    return null;
  }

  return (
    <section className="history-saved-section" aria-label="Search History and Bookmarks">
      <div className="tab-headers">
        <button
          type="button"
          className={`tab-btn ${activeTab === "history" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          🕒 Recent Research ({history.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === "saved" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("saved")}
        >
          ★ Saved Products ({savedProducts.length})
        </button>
      </div>

      <div className="tab-body">
        {activeTab === "history" && (
          <div className="history-tab-content">
            <div className="history-tab-top">
              <span className="tab-hint">Saved in browser storage on this device</span>
              {history.length > 0 && (
                <button
                  type="button"
                  className="btn-link-action"
                  onClick={onClearHistory}
                >
                  Clear history
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p className="empty-tab-text">No recent searches yet.</p>
            ) : (
              <div className="history-list">
                {history.map((item, idx) => (
                  <div
                    key={idx}
                    className="history-card-item"
                    onClick={() => onSelectHistory(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectHistory(item);
                    }}
                  >
                    <div className="history-main">
                      <p className="history-query-text">"{item.query.slice(0, 110)}..."</p>
                      <div className="history-meta-row">
                        {item.category && (
                          <span className="history-cat-badge">{item.category}</span>
                        )}
                        {item.budget && (
                          <span className="history-budget-badge">Max ₹{item.budget.toLocaleString("en-IN")}</span>
                        )}
                        <span className="history-time-text">{item.time}</span>
                      </div>
                    </div>
                    {item.topMatch && (
                      <div className="history-match-preview">
                        <span className="preview-label">Top fit:</span>
                        <span className="preview-product">{item.topMatch.slice(0, 28)}...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "saved" && (
          <div className="saved-tab-content">
            {savedProducts.length === 0 ? (
              <p className="empty-tab-text">You haven't bookmarked any products yet. Click "☆ Save" on any product card to pin it here.</p>
            ) : (
              <div className="saved-list">
                {savedProducts.map((p) => (
                  <div key={p.id} className="saved-card-item">
                    <div className="saved-item-info">
                      <strong className="saved-item-title">{p.title}</strong>
                      <div className="saved-item-price-row">
                        <span className="saved-price">{p.observedPriceFormatted}</span>
                        <span className="saved-retailer">on {p.retailer}</span>
                        <span className="saved-match-pill">{p.matchClassification}</span>
                      </div>
                    </div>
                    <div className="saved-item-actions">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-view-link"
                      >
                        View ↗
                      </a>
                      <button
                        type="button"
                        className="btn-remove-saved"
                        onClick={() => onRemoveSaved(p.id)}
                        aria-label={`Remove ${p.title} from saved`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
