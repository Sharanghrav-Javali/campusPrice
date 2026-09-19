"use client";

import { useState, useEffect } from "react";

const EXAMPLE_PROMPTS = [
  {
    label: "💻 CSE Student Laptop",
    text: "I am a second-year CSE student looking for a laptop under ₹70,000 mainly for Java, Python, web development, Docker and VS Code. I want 16GB RAM, at least 512GB SSD, good battery life and something that will last 4 years. Gaming is not important.",
  },
  {
    label: "📱 Everyday Phone under ₹25k",
    text: "I need a smartphone under ₹25,000. Good camera and clean display are important, along with reliable all-day battery life and smooth everyday performance for college work. No heavy gaming.",
  },
  {
    label: "👟 College Walking Shoes",
    text: "I need a pair of shoes under ₹1,500 that I can wear to college with jeans and semi-formal wear. I walk a lot across campus so comfort is top priority over flashy branding. White with contrasting accents preferred.",
  },
];

const LOADING_STEPS = [
  "Understanding your requirements...",
  "Researching live market listings across retailers...",
  "Normalizing specs and removing duplicate listings...",
  "Evaluating requirement fit and calculating verdicts...",
  "Preparing best matches and comparison sheet...",
];

export default function HeroInput({ onSearch, loading }) {
  const [text, setText] = useState("");
  const [budget, setBudget] = useState("");
  const [condition, setCondition] = useState("new");
  const [brands, setBrands] = useState("");
  const [additional, setAdditional] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  // Cycling loading step messages
  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!text.trim() || loading) return;
    onSearch({
      text: text.trim(),
      budget: budget ? Number(budget) : undefined,
      condition,
      brands: brands.trim() || undefined,
      additional_requirements: additional.trim() || undefined,
    });
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSubmit();
    }
  }

  return (
    <div className="hero-container">
      <header className="hero-header">
        <div className="brand-badge">
          <span className="badge-dot"></span>
          AI Shopping Research Workstation
        </div>
        <h1 className="hero-title">
          Tell us what you need.<br />
          <span className="hero-highlight">We’ll find what fits.</span>
        </h1>
        <p className="hero-subtitle">
          Describe your requirements in plain English, set your budget, and let AI research live market listings across India for you.
        </p>
      </header>

      {/* Example Prompt Chips */}
      <div className="examples-bar" role="region" aria-label="Example prompts">
        <span className="examples-label">Try an example:</span>
        <div className="examples-list">
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              type="button"
              className="chip-btn"
              onClick={() => setText(ex.text)}
              disabled={loading}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <form className="research-form" onSubmit={handleSubmit}>
        <div className="textarea-wrapper">
          <textarea
            className="main-textarea"
            rows={4}
            placeholder="Tell me what you're looking for...&#10;&#10;Example:&#10;I need a laptop for engineering under ₹70,000. I mainly use it for coding, Python, Docker and web development. I want good battery life and something that will last for several years."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            required
            aria-label="Describe your requirements"
          />
          <div className="textarea-hint">
            <span>Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to research</span>
            <span className="char-count">{text.length}/1000</span>
          </div>
        </div>

        {/* Secondary Preferences Toggle */}
        <div className="secondary-controls">
          <button
            type="button"
            className="secondary-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            aria-expanded={showAdvanced}
          >
            <span>{showAdvanced ? "▲ Hide optional filters" : "▼ Optional filters (budget, condition, brands)"}</span>
          </button>

          {showAdvanced && (
            <div className="filters-grid">
              <div className="filter-group">
                <label htmlFor="budget-input">Maximum Budget (₹)</label>
                <input
                  id="budget-input"
                  type="number"
                  placeholder="e.g. 70000"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="condition-select">Condition</label>
                <select
                  id="condition-select"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  disabled={loading}
                >
                  <option value="new">Brand New only</option>
                  <option value="refurbished">Refurbished / Open-Box OK</option>
                  <option value="any">Any condition</option>
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="brands-input">Preferred Brands</label>
                <input
                  id="brands-input"
                  type="text"
                  placeholder="e.g. ASUS, Lenovo, Dell"
                  value={brands}
                  onChange={(e) => setBrands(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="filter-group">
                <label htmlFor="extra-input">Additional Notes</label>
                <input
                  id="extra-input"
                  type="text"
                  placeholder="e.g. Backlit keyboard preferred"
                  value={additional}
                  onChange={(e) => setAdditional(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <div className="form-actions">
          <button
            type="submit"
            className="cta-submit-btn"
            disabled={loading || !text.trim()}
          >
            {loading ? (
              <span className="btn-spinner-content">
                <span className="spinner-dots"></span>
                Researching the Market...
              </span>
            ) : (
              "Find the best matches →"
            )}
          </button>
        </div>
      </form>

      {/* Dynamic Multi-Step Loading State */}
      {loading && (
        <div className="loading-state-card" role="status" aria-live="polite">
          <div className="loading-pulse-indicator">
            <span className="pulse-circle"></span>
          </div>
          <div className="loading-step-text">
            <strong>{LOADING_STEPS[loadingStepIndex]}</strong>
            <p className="loading-subtext">Aggregating live web search data and verifying deal specifications</p>
          </div>
        </div>
      )}
    </div>
  );
}
