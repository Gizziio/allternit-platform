/**
 * POST /v1/images/generate
 *
 * AI image generation via AI Gateway (Gemini 3.1 Flash Image Preview by default).
 * Used by PresentationProgram to auto-generate slide imagery from imagePrompt metadata.
 *
 * Request body:
 *   prompt   string   — description of the image to generate
 *   model?   string   — AI Gateway model slug (default: google/gemini-3.1-flash-image-preview)
 *
 * Response:
 *   { url: string }  — data:image/... base64 URL ready for <img src="">
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Enhanced prompt for presentation visuals
  const enhancedPrompt = `Professional presentation slide visual: ${prompt}. High quality, modern design, suitable for a business or product presentation. Clean composition, bold colors, minimalist aesthetic.`;

  try {
    // Use Gemini 3.1 Flash Image Preview via AI SDK google provider
    // Falls back to a placeholder if the key isn't configured
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      // Return a gradient placeholder when no key is configured
      return NextResponse.json({
        url: generateGradientPlaceholder(prompt),
        source: "placeholder",
      });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateText({
      model: google("gemini-2.0-flash-exp"),
      prompt: enhancedPrompt,
      providerOptions: {
        google: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      },
    });

    // Extract the first image from result.files
    const imageFile = result.files?.[0];
    if (imageFile?.base64) {
      const mimeType = imageFile.mimeType ?? "image/png";
      return NextResponse.json({
        url: `data:${mimeType};base64,${imageFile.base64}`,
        source: "gemini",
      });
    }

    // No image returned — use gradient placeholder
    return NextResponse.json({
      url: generateGradientPlaceholder(prompt),
      source: "placeholder",
    });
  } catch (err) {
    console.error("[/v1/images/generate] Error:", err);
    // On any error, return a styled placeholder so the slide still renders
    return NextResponse.json({
      url: generateGradientPlaceholder(prompt),
      source: "placeholder",
    });
  }
}

// ---------------------------------------------------------------------------
// Gradient placeholder (SVG data URL) — used when no API key is configured
// or when generation fails. Produces a unique gradient per prompt.
// ---------------------------------------------------------------------------

function generateGradientPlaceholder(prompt: string): string {
  // Deterministic colour pair from prompt hash
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    hash = ((hash << 5) - hash + prompt.charCodeAt(i)) | 0;
  }
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40 + Math.abs((hash >> 8) % 80)) % 360;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:hsl(${hue1},65%,25%);stop-opacity:1" />
      <stop offset="100%" style="stop-color:hsl(${hue2},55%,15%);stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="960" height="540" fill="url(#g)"/>
  <circle cx="720" cy="270" r="220" fill="hsl(${hue1},70%,30%)" opacity="0.3"/>
  <circle cx="240" cy="400" r="160" fill="hsl(${hue2},60%,35%)" opacity="0.2"/>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
