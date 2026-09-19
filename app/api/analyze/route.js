import { NextResponse } from "next/server";

// This route runs on the server, so your API keys never reach the browser.

async function searchWeb(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SERPER_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "in", num: 10 }),
  });

  if (!res.ok) {
    throw new Error(`Search failed (${res.status}). Check your SERPER_API_KEY.`);
  }

  const json = await res.json();
  const organic = json.organic || [];

  return organic.slice(0, 8).map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet || "",
  }));
}

function buildPrompt(product, budget, results) {
  const budgetLine = budget
    ? `The student's budget is roughly ₹${budget}.`
    : "No specific budget was given.";

  const sourcesText = results
    .map(
      (r, i) =>
        `[${i + 1}] Title: ${r.title}\nLink: ${r.link}\nSnippet: ${r.snippet}`
    )
    .join("\n\n");

  return `You are CampusPrice, an honest shopping assistant for Indian college students.
A student wants to buy: "${product}". ${budgetLine}

Here are live web search results about this product (use ONLY this information —
do not invent prices, specs, or links that are not supported by these snippets):

${sourcesText}

Based only on the above, respond with STRICT JSON (no markdown fences, no extra text)
matching exactly this shape:

{
  "product": "cleaned up product name",
  "verdict": "Buy now" | "Wait" | "Overpriced" | "Not enough info",
  "summary": "2-3 sentence honest summary of whether this is a good buy right now and why",
  "best_price": { "source": "e.g. Amazon", "price": "e.g. ₹14,999", "link": "url" } or null if unclear,
  "comparisons": [
    { "source": "site or seller name", "price": "price if mentioned, else 'Check site'", "link": "url", "notes": "short note" }
  ],
  "pros": ["short bullet", "short bullet"],
  "cons": ["short bullet", "short bullet"],
  "tips": "one practical tip for a student buyer, e.g. timing, alternatives, or what to double check"
}

Rules:
- If the search results don't clearly mention a price, say so honestly instead of guessing.
- Only use links that appear in the search results above.
- Keep the tone plain and direct, like a smart senior giving advice, not a marketing blurb.
- Output ONLY the JSON object, nothing else.`;
}

async function askGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content || "";
  return raw;
}

function parseModelJson(raw) {
  let cleaned = raw.trim();
  // Strip markdown code fences if the model added them despite instructions
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/^```\s*/i, "");
  cleaned = cleaned.replace(/```\s*$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to salvage the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        throw new Error("Could not parse AI response. Try again.");
      }
    }
    throw new Error("Could not parse AI response. Try again.");
  }
}

export async function POST(req) {
  try {
    const { product, budget } = await req.json();

    if (!product || !product.trim()) {
      return NextResponse.json(
        { error: "Please enter a product name." },
        { status: 400 }
      );
    }

    const query = `${product} price in India buy online`;
    const results = await searchWeb(query);

    if (results.length === 0) {
      return NextResponse.json(
        {
          error:
            "No search results found for that product. Try a more specific name.",
        },
        { status: 404 }
      );
    }

    const prompt = buildPrompt(product, budget, results);
    const raw = await askGroq(prompt);
    const parsed = parseModelJson(raw);

    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
