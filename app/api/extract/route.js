import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sanitizeUserInput } from "@/lib/security";
import { extractRequirements } from "@/lib/requirementExtractor";
import { logger } from "@/lib/logger";

export async function POST(req) {
  try {
    const ip = getClientIp(req);
    const rateCheck = checkRateLimit(ip, { limit: 20, windowMs: 60 * 1000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before trying again." },
        { status: 429, headers: { "Retry-After": Math.ceil(rateCheck.resetInMs / 1000).toString() } }
      );
    }

    const body = await req.json();
    const { text, budget, condition, brands, additional_requirements } = body;

    const sanitized = sanitizeUserInput(text);
    if (!sanitized) {
      return NextResponse.json(
        { error: "Please provide a description of what you are looking for." },
        { status: 400 }
      );
    }

    const requirements = await extractRequirements(sanitized, {
      budget,
      condition,
      brands,
      additional_requirements,
    });

    return NextResponse.json({ requirements });
  } catch (err) {
    logger.error("api_extract_error", err);
    return NextResponse.json(
      { error: err.message || "Failed to analyze requirements. Please try again." },
      { status: 500 }
    );
  }
}
