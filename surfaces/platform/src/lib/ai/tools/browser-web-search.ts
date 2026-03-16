/**
 * Browser-based web search using our browser-use service
 * Replaces Tavily/Firecrawl with our own implementation
 * 
 * Uses browser-use library with agent-based automation
 * Three modes available:
 * - browser-use: Full agent automation with reasoning
 * - playwright: Fast headless browser control
 * - computer-use: Vision-based desktop-like interactions
 */

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("tools/browser-web-search");

const A2R_OPERATOR_URL = process.env.A2R_OPERATOR_URL || "http://127.0.0.1:3000";

export type SearchProviderOptions = {
  provider: "browser-use" | "playwright" | "computer-use";
  searchDepth?: "basic" | "advanced";
};

export type WebSearchResult = {
  source: "web";
  title: string;
  url: string;
  content: string;
};

export type WebSearchResponse = {
  results: WebSearchResult[];
  error?: string;
};

/**
 * Web search using browser-use service
 * No external API keys required
 */
export async function browserWebSearchStep({
  query,
  maxResults = 5,
  providerOptions,
}: {
  query: string;
  maxResults: number;
  providerOptions: SearchProviderOptions;
}): Promise<WebSearchResponse> {
  try {
    // Check if browser-use is available
    const healthRes = await fetch(`${A2R_OPERATOR_URL}/browser/health`);
    if (!healthRes.ok) {
      return {
        results: [],
        error: "Browser service not available. Is A2R Operator running?",
      };
    }

    const health = await healthRes.json();
    if (!health.available) {
      return {
        results: [],
        error: "browser-use library not installed. Run: pip install browser-use",
      };
    }

    // Use browser search endpoint
    const response = await fetch(`${A2R_OPERATOR_URL}/browser/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        search_engine: "duckduckgo",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Search failed: ${error}`);
    }

    const result = await response.json();

    // Map results
    const results: WebSearchResult[] = result.results?.map((r: any) => ({
      source: "web",
      title: r.title || "Untitled",
      url: r.url,
      content: r.content || r.extracted_content || "",
    })) || [];

    // Limit results
    const limitedResults = results.slice(0, maxResults);

    log.debug({ query, maxResults, resultCount: limitedResults.length }, "browserWebSearch success");
    return { results: limitedResults };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error, query }, "Error in browserWebSearch");
    return {
      results: [],
      error: message,
    };
  }
}

export { browserWebSearchStep as webSearchStep };
