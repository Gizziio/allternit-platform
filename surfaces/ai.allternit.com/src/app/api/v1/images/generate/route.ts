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
 *   { url: string }  — data:image/… base64 URL ready for <img src="">
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
  const requestedModel = typeof body.model === "string" && body.model.trim()
    ? body.model.trim()
    : "gemini-2.0-flash-exp";
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  // Enhanced prompt for presentation visuals
  const enhancedPrompt = `Professional presentation slide visual: ${prompt}. High quality, modern design, suitable for a business or product presentation. Clean composition, bold colors, minimalist aesthetic.`;

  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: "Image generation is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY.",
        code: "image_generation_unconfigured",
      }, { status: 503 });
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const result = await generateText({
      model: google(requestedModel),
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
      const mimeType = imageFile.mediaType ?? "image/png";
      return NextResponse.json({
        url: `data:${mimeType};base64,${imageFile.base64}`,
        source: "google",
        model: requestedModel,
      });
    }

    return NextResponse.json({
      error: "Image provider returned no image payload.",
      code: "image_generation_empty_result",
      model: requestedModel,
    }, { status: 502 });
  } catch (err) {
    console.error("[/v1/images/generate] Error:", err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Image generation failed",
      code: "image_generation_failed",
      model: requestedModel,
    }, { status: 502 });
  }
}
