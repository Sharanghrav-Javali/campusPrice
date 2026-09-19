// Requirement Extraction Layer for CampusPrice
// Converts natural language descriptions into structured, category-aware shopping criteria.

import { callGroq } from "./groqClient.js";
import { sanitizeUserInput } from "./security.js";
import { detectCategoryFromText, CATEGORIES } from "./categories.js";
import { logger } from "./logger.js";

/**
 * Extract structured requirements from natural-language user input
 * @param {string} rawInput Paragraph describing the user's need
 * @param {object} optionalOverrides Manual UI overrides like budget, condition, brands
 * @returns {Promise<object>} Structured requirement schema
 */
export async function extractRequirements(rawInput, optionalOverrides = {}) {
  const sanitizedInput = sanitizeUserInput(rawInput);
  if (!sanitizedInput) {
    throw new Error("Please describe what you are looking for.");
  }

  const categoryHint = detectCategoryFromText(sanitizedInput);

  const prompt = `You are the requirement understanding engine for CampusPrice, an AI shopping research workstation for students in India.
Your job is to read the user's natural language request and extract STRICT, HONEST structured requirements.

User's description:
"""${sanitizedInput}"""

Available recognized categories: ${Object.keys(CATEGORIES).join(", ")}.

Return STRICT JSON matching this exact structure:
{
  "category": "one of the recognized categories, or 'generic'",
  "budget": {
    "max": <number in INR, or null if unmentioned>,
    "currency": "INR",
    "strict": <true if user explicitly stated a budget ceiling like 'under 70k' or 'max 70000', else false>
  },
  "summary": "1 sentence summarizing what the user is looking for",
  "use_cases": [<array of specific use cases mentioned, e.g. "Docker", "Python", "Walking", "Gaming">],
  "must_have": [<array of non-negotiable hard constraints explicitly mentioned, e.g. "16GB RAM", "SSD", "White color">],
  "preferences": [<array of soft preferences or nice-to-haves, e.g. "lightweight", "good battery life">],
  "brand_preferences": [<array of brands user mentioned preferring, or empty array if none>],
  "brand_dislikes": [<array of brands user explicitly wants to avoid, or empty array if none>],
  "condition": "new" | "refurbished" | "any",
  "priority": {
    "primary": "main focal point, e.g. performance / battery / comfort / camera",
    "secondary": "secondary focal point if mentioned, else null"
  },
  "search_seed": "A concise 3-6 word search descriptor representing the target item"
}

CRITICAL RULES:
1. Distinguish MUST HAVE (hard constraints) from PREFERENCES (soft wishes).
2. DO NOT INVENT constraints that the user never mentioned. If they didn't mention RAM or brand, leave them empty.
3. Parse Indian currency formats properly: "70k" -> 70000, "1.5k" -> 1500, "15,000" -> 15000, "₹50k" -> 50000.
4. Output valid JSON only, without markdown fences or comments.`;

  try {
    const { data } = await callGroq({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 800,
      json_mode: true,
    });

    // Merge manual overrides if provided by user
    const result = {
      category: data.category || categoryHint || "generic",
      budget: {
        max: optionalOverrides.budget ? Number(optionalOverrides.budget) : data.budget?.max || null,
        currency: "INR",
        strict: data.budget?.strict ?? true,
      },
      summary: data.summary || sanitizedInput.slice(0, 100),
      use_cases: Array.isArray(data.use_cases) ? data.use_cases : [],
      must_have: Array.isArray(data.must_have) ? data.must_have : [],
      preferences: Array.isArray(data.preferences) ? data.preferences : [],
      brand_preferences: optionalOverrides.brands
        ? optionalOverrides.brands.split(",").map((b) => b.trim()).filter(Boolean)
        : Array.isArray(data.brand_preferences) ? data.brand_preferences : [],
      brand_dislikes: Array.isArray(data.brand_dislikes) ? data.brand_dislikes : [],
      condition: optionalOverrides.condition || data.condition || "new",
      priority: data.priority || { primary: "balanced", secondary: null },
      search_seed: data.search_seed || sanitizedInput.slice(0, 40),
      raw_query: sanitizedInput,
    };

    if (optionalOverrides.additional_requirements) {
      result.preferences.push(optionalOverrides.additional_requirements.trim());
    }

    logger.info("requirements_extracted", {
      category: result.category,
      budget: result.budget.max,
      mustHaveCount: result.must_have.length,
    });

    return result;
  } catch (err) {
    logger.error("requirements_extraction_failed", err);
    // Fallback heuristic extraction if AI call failed
    const parsedBudget = extractBudgetHeuristic(sanitizedInput);
    return {
      category: categoryHint,
      budget: {
        max: optionalOverrides.budget ? Number(optionalOverrides.budget) : parsedBudget,
        currency: "INR",
        strict: true,
      },
      summary: sanitizedInput.slice(0, 120),
      use_cases: [],
      must_have: [],
      preferences: [],
      brand_preferences: [],
      brand_dislikes: [],
      condition: optionalOverrides.condition || "new",
      priority: { primary: "balanced", secondary: null },
      search_seed: sanitizedInput.slice(0, 40),
      raw_query: sanitizedInput,
    };
  }
}

/**
 * Fallback regex to extract numbers after ₹ or 'under X'
 */
function extractBudgetHeuristic(text) {
  const matchK = text.match(/(?:under|below|budget|within|upto|₹|rs\.?)\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (matchK) return parseFloat(matchK[1]) * 1000;

  const matchNum = text.match(/(?:under|below|budget|within|upto|₹|rs\.?)\s*(\d{1,3}(?:,\d{3})+|\d+)/i);
  if (matchNum) {
    return parseInt(matchNum[1].replace(/,/g, ""), 10);
  }
  return null;
}
