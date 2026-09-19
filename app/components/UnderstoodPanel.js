"use client";

import { useState } from "react";
import { CATEGORIES } from "@/lib/categories";

export default function UnderstoodPanel({ requirements, onUpdateRequirements, loading }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCategory, setEditedCategory] = useState(requirements.category || "generic");
  const [editedBudget, setEditedBudget] = useState(requirements.budget?.max || "");
  const [editedMustHave, setEditedMustHave] = useState((requirements.must_have || []).join(", "));
  const [editedPreferences, setEditedPreferences] = useState((requirements.preferences || []).join(", "));
  const [editedUseCases, setEditedUseCases] = useState((requirements.use_cases || []).join(", "));

  if (!requirements) return null;

  const categoryConf = CATEGORIES[requirements.category] || CATEGORIES.generic;

  function handleSave(e) {
    e.preventDefault();
    const updated = {
      ...requirements,
      category: editedCategory,
      budget: {
        ...requirements.budget,
        max: editedBudget ? Number(editedBudget) : null,
      },
      must_have: editedMustHave.split(",").map((s) => s.trim()).filter(Boolean),
      preferences: editedPreferences.split(",").map((s) => s.trim()).filter(Boolean),
      use_cases: editedUseCases.split(",").map((s) => s.trim()).filter(Boolean),
    };
    setIsEditing(false);
    onUpdateRequirements(updated);
  }

  return (
    <div className="understood-card">
      <div className="understood-header">
        <div className="understood-title-wrap">
          <span className="understood-icon">{categoryConf.icon || "🔍"}</span>
          <div>
            <span className="understood-pretitle">Requirement Analysis</span>
            <h2 className="understood-title">What we understood from your request</h2>
          </div>
        </div>
        <button
          type="button"
          className="btn-edit-toggle"
          onClick={() => setIsEditing(!isEditing)}
          disabled={loading}
        >
          {isEditing ? "Cancel" : "✏️ Edit requirements"}
        </button>
      </div>

      {!isEditing ? (
        <div className="understood-content">
          <div className="understood-grid">
            <div className="understood-item">
              <span className="item-label">Category</span>
              <span className="item-badge">{categoryConf.label || requirements.category}</span>
            </div>

            <div className="understood-item">
              <span className="item-label">Budget</span>
              <span className="item-value">
                {requirements.budget?.max
                  ? `Under ₹${requirements.budget.max.toLocaleString("en-IN")}`
                  : "No strict ceiling specified"}
              </span>
            </div>

            <div className="understood-item">
              <span className="item-label">Primary Use</span>
              <div className="chips-row">
                {requirements.use_cases && requirements.use_cases.length > 0 ? (
                  requirements.use_cases.map((uc, i) => (
                    <span key={i} className="chip-usecase">{uc}</span>
                  ))
                ) : (
                  <span className="item-dim">General college & productivity</span>
                )}
              </div>
            </div>

            <div className="understood-item">
              <span className="item-label">Must Have</span>
              <div className="chips-row">
                {requirements.must_have && requirements.must_have.length > 0 ? (
                  requirements.must_have.map((mh, i) => (
                    <span key={i} className="chip-musthave">✓ {mh}</span>
                  ))
                ) : (
                  <span className="item-dim">None strictly mandated</span>
                )}
              </div>
            </div>

            <div className="understood-item">
              <span className="item-label">Preferences</span>
              <div className="chips-row">
                {requirements.preferences && requirements.preferences.length > 0 ? (
                  requirements.preferences.map((p, i) => (
                    <span key={i} className="chip-pref">{p}</span>
                  ))
                ) : (
                  <span className="item-dim">Best overall value</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form className="edit-requirements-form" onSubmit={handleSave}>
          <div className="edit-form-grid">
            <div className="form-field">
              <label htmlFor="edit-category">Category</label>
              <select
                id="edit-category"
                value={editedCategory}
                onChange={(e) => setEditedCategory(e.target.value)}
              >
                {Object.entries(CATEGORIES).map(([id, conf]) => (
                  <option key={id} value={id}>
                    {conf.icon} {conf.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="edit-budget">Max Budget (₹)</label>
              <input
                id="edit-budget"
                type="number"
                value={editedBudget}
                onChange={(e) => setEditedBudget(e.target.value)}
                placeholder="e.g. 70000"
              />
            </div>

            <div className="form-field full-width">
              <label htmlFor="edit-musthave">Must-Have Constraints (comma-separated)</label>
              <input
                id="edit-musthave"
                type="text"
                value={editedMustHave}
                onChange={(e) => setEditedMustHave(e.target.value)}
                placeholder="e.g. 16GB RAM, 512GB SSD"
              />
            </div>

            <div className="form-field full-width">
              <label htmlFor="edit-preferences">Preferences / Nice to Have (comma-separated)</label>
              <input
                id="edit-preferences"
                type="text"
                value={editedPreferences}
                onChange={(e) => setEditedPreferences(e.target.value)}
                placeholder="e.g. good battery life, lightweight"
              />
            </div>

            <div className="form-field full-width">
              <label htmlFor="edit-usecases">Primary Use Cases (comma-separated)</label>
              <input
                id="edit-usecases"
                type="text"
                value={editedUseCases}
                onChange={(e) => setEditedUseCases(e.target.value)}
                placeholder="e.g. Python, Docker, VS Code"
              />
            </div>
          </div>

          <div className="edit-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Re-researching..." : "Update & Re-research →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
