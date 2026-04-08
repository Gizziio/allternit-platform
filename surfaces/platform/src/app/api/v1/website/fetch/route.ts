/**
 * POST /v1/website/fetch
 *
 * Server-side website fetcher for the Websites mode agent tool.
 * Fetches a public URL and returns its HTML (with inlined styles) as a
 * CodePreviewState-compatible `files` array so the agent can use an existing
 * site as reference/inspiration when building a new one.
 *
 * Request body:
 *   url      string   — public URL to fetch
 *   selector? string  — optional CSS selector to extract a sub-section
 *
 * Response:
 *   {
 *     url: string
 *     title: string
 *     files: Array<{ path: string; language: string; content: string; isEntryPoint?: boolean }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_PROTOCOLS = ["https:", "http:"];

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    return NextResponse.json({ error: "Only http/https URLs are allowed" }, { status: 400 });
  }

  // Block private/internal addresses
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.startsWith("192.168.") ||
    host.startsWith("10.") ||
    host.endsWith(".local")
  ) {
    return NextResponse.json({ error: "Internal addresses are not allowed" }, { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Allternit-WebsiteBot/1.0; +https://allternitchitech.com)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return NextResponse.json(
        { error: "URL did not return HTML content" },
        { status: 422 },
      );
    }

    const html = await res.text();

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsed.hostname;

    // Extract <style> blocks into a separate CSS file
    const styleBlocks: string[] = [];
    const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let m;
    while ((m = styleRe.exec(html)) !== null) {
      styleBlocks.push(m[1]);
    }

    // Strip <script> blocks (they won't work without the original server anyway)
    const cleanedHtml = html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");

    const files: Array<{
      path: string;
      language: string;
      content: string;
      isEntryPoint?: boolean;
    }> = [
      {
        path: "index.html",
        language: "html",
        isEntryPoint: true,
        content: cleanedHtml,
      },
    ];

    if (styleBlocks.length > 0) {
      files.push({
        path: "styles.css",
        language: "css",
        content: styleBlocks.join("\n\n"),
      });
    }

    return NextResponse.json({
      url: parsed.toString(),
      title,
      files,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout") || message.includes("TimeoutError")) {
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    return NextResponse.json(
      { error: `Failed to fetch URL: ${message}` },
      { status: 502 },
    );
  }
}
