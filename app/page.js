"use client";

import { useState, useEffect } from "react";

const VERDICT_CLASS = {
  "buy now": "tag-buy",
  "wait": "tag-wait",
  "overpriced": "tag-overpriced",
};

function verdictClass(v) {
  if (!v) return "tag-unknown";
  const key = v.toLowerCase();
  return VERDICT_CLASS[key] || "tag-unknown";
}

export default function Home() {
  const [product, setProduct] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cp_history") || "[]");
      setHistory(saved);
    } catch (e) {
      setHistory([]);
    }
  }, []);

  function saveToHistory(query, result) {
    try {
      const entry = {
        query,
        verdict: result.verdict,
        time: new Date().toLocaleString(),
      };
      const updated = [entry, ...history].slice(0, 8);
      setHistory(updated);
      localStorage.setItem("cp_history", JSON.stringify(updated));
    } catch (e) {
      // localStorage unavailable, skip silently
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!product.trim()) {
      setError("Type a product name first — e.g. 'boAt Rockerz 450 headphones'");
      return;
    }
    setError("");
    setData(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, budget }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Something went wrong. Try again.");
      }
      setData(json);
      saveToHistory(product, json);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <header className="hero">
        <span className="badge">Built for students · Free to run</span>
        <h1>CampusPrice</h1>
        <p>
          Paste any product you're thinking of buying. Get an instant AI
          comparison across sources, a buy/wait verdict, and things sellers
          won't tell you.
        </p>
      </header>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="What are you buying? e.g. 'Redmi Note 13 5G 128GB'"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />
        <div className="row">
          <input
            type="number"
            placeholder="Your budget in ₹ (optional)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <button type="submit" className="primary" disabled={loading}>
            {loading ? "Researching…" : "Get the verdict"}
          </button>
        </div>
      </form>

      {error && <div className="error-box">{error}</div>}

      {loading && (
        <div className="loading-box">
          Searching the web and comparing prices — this takes 5–15 seconds…
        </div>
      )}

      {data && (
        <div className="result">
          <div className="card">
            <div className="verdict">
              <span className={`verdict-tag ${verdictClass(data.verdict)}`}>
                {data.verdict || "Unclear"}
              </span>
              <strong>{data.product || product}</strong>
            </div>
            <p className="summary">{data.summary}</p>
          </div>

          {data.comparisons && data.comparisons.length > 0 && (
            <div className="card">
              <h3 className="card-title">Price comparison</h3>
              <table className="compare">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Price</th>
                    <th>Notes</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.comparisons.map((c, i) => (
                    <tr key={i}>
                      <td>
                        {c.source}
                        {data.best_price &&
                          c.source === data.best_price.source && (
                            <span className="best-pill">BEST</span>
                          )}
                      </td>
                      <td>{c.price || "—"}</td>
                      <td>{c.notes || ""}</td>
                      <td>
                        {c.link && (
                          <a href={c.link} target="_blank" rel="noreferrer">
                            View →
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="two-col">
            {data.pros && data.pros.length > 0 && (
              <div className="card">
                <h3 className="card-title">Pros</h3>
                <ul className="plain pros">
                  {data.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {data.cons && data.cons.length > 0 && (
              <div className="card">
                <h3 className="card-title">Cons / watch out for</h3>
                <ul className="plain cons">
                  {data.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {data.tips && (
            <div className="card">
              <h3 className="card-title">Buying tip</h3>
              <div className="tips-box">{data.tips}</div>
            </div>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="history">
          <h4>Recent searches (saved on this device only)</h4>
          {history.map((h, i) => (
            <div
              className="history-item"
              key={i}
              onClick={() => setProduct(h.query)}
            >
              <span>{h.query}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
                {h.verdict} · {h.time}
              </span>
            </div>
          ))}
        </div>
      )}

      <footer className="foot">
        CampusPrice — a student-built project. Always verify final prices on
        the retailer's site before buying.
      </footer>
    </div>
  );
}
