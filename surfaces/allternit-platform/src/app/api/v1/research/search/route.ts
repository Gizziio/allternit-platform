/**
 * POST /v1/research/search
 *
 * Pre-search endpoint for Research mode. Runs a quick web search and returns
 * structured results as context to inject before the agent generates the
 * full ResearchDoc. Uses the Allternit operator service when available,
 * then falls back to DuckDuckGo Instant Answers (no API key required).
 *
 * Request body:
 *   query     string   — search query derived from user message
 *   maxResults? number — max results per query (default 5)
 *
 * Response:
 *   {
 *     results: Array<{ title: string; url: string; snippet: string }>
 *     source: "operator" | "ddg" | "none"
 *   }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

const OPERATOR_URL =
  process.env.ALLTERNIT_OPERATOR_URL ?? "http://127.0.0.1:3000";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ---------------------------------------------------------------------------
// DuckDuckGo Instant Answer fallback (free, no key)
// ---------------------------------------------------------------------------

async function ddgSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Allternit-ResearchBot/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    AbstractText?: string;
    AbstractURL?: string;
    AbstractSource?: string;
    RelatedTopics?: Array<{
      Text?: string;
      FirstURL?: string;
      Topics?: Array<{ Text?: string; FirstURL?: string }>;
    }>;
  };

  const results: SearchResult[] = [];

  // Abstract (top result)
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.AbstractSource ?? query,
      url: data.AbstractURL,
      snippet: data.AbstractText,
    });
  }

  // Related topics
  for (const topic of data.RelatedTopics ?? []) {
    if (results.length >= maxResults) break;
    // Nested sub-topics
    if (topic.Topics) {
      for (const sub of topic.Topics) {
        if (results.length >= maxResults) break;
        if (sub.Text && sub.FirstURL) {
          results.push({
            title: sub.Text.split(" - ")[0] ?? sub.Text,
            url: sub.FirstURL,
            snippet: sub.Text,
          });
        }
      }
    } else if (topic.Text && topic.FirstURL) {
      results.push({
        title: topic.Text.split(" - ")[0] ?? topic.Text,
        url: topic.FirstURL,
        snippet: topic.Text,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const maxResults =
    typeof body.maxResults === "number" ? Math.min(body.maxResults, 10) : 5;

  // Try operator service first (browser-based search)
  try {
    const healthRes = await fetch(`${OPERATOR_URL}/browser/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    if (healthRes.ok) {
      const health = (await healthRes.json()) as { available?: boolean };
      if (health.available) {
        const taskRes = await fetch(`${OPERATOR_URL}/browser/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: `Search for "${query}" and extract the top ${maxResults} results with titles, URLs, and descriptions. Return JSON with key "results" containing an array of {title, url, snippet} objects.`,
            url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            mode: "playwright",
          }),
          signal: AbortSignal.timeout(15_000),
        });
        if (taskRes.ok) {
          const task = (await taskRes.json()) as {
            id?: string;
            status?: string;
            result?: { results?: SearchResult[] };
          };
          if (task.result?.results?.length) {
            return NextResponse.json({
              results: task.result.results.slice(0, maxResults),
              source: "operator",
            });
          }
        }
      }
    }
  } catch {
    // Operator not available — fall through to DDG
  }

  // DuckDuckGo fallback
  try {
    const results = await ddgSearch(query, maxResults);
    return NextResponse.json({
      results,
      source: results.length > 0 ? "ddg" : "none",
    });
  } catch {
    return NextResponse.json({ results: [], source: "none" });
  }
}
