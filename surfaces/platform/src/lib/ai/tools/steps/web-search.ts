/**
 * Web search using browser-use service
 * Replaces paid Tavily/Firecrawl with free browser automation
 * 
 * Three agent modes available:
 * - browser-use: Full agent automation with reasoning
 * - playwright: Fast headless browser control  
 * - computer-use: Vision-based desktop-like interactions
 */

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("tools/steps/web-search");

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
 * Web search using browser-use service (free, no API keys)
 */
export async function webSearchStep({
  query,
  maxResults,
  providerOptions,
}: {
  query: string;
  maxResults: number;
  providerOptions: SearchProviderOptions;
}): Promise<WebSearchResponse> {
  try {
    // Check browser-use health
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
        error: "browser-use not available. Install: pip install browser-use playwright",
      };
    }

    // Create browser task for search
    const taskRes = await fetch(`${A2R_OPERATOR_URL}/browser/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        goal: `Search for "${query}" and extract the top ${maxResults} results with titles, URLs, and descriptions`,
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        mode: providerOptions.provider,
      }),
    });

    if (!taskRes.ok) {
      throw new Error(`Failed to create search task: ${await taskRes.text()}`);
    }

    const task = await taskRes.json();

    // Execute the task
    const execRes = await fetch(`${A2R_OPERATOR_URL}/browser/tasks/${task.task_id}/execute`, {
      method: "POST",
    });

    if (!execRes.ok) {
      throw new Error(`Failed to execute search: ${await execRes.text()}`);
    }

    const result = await execRes.json();

    // Parse results from agent output
    const results: WebSearchResult[] = [];
    
    if (result.result?.extracted_content) {
      // Parse extracted content for search results
      const content = result.result.extracted_content;
      // Simple parsing - in production, structure this better
      const lines = content.split('\n').filter((l: string) => l.trim());
      
      for (let i = 0; i < Math.min(lines.length, maxResults); i++) {
        results.push({
          source: "web",
          title: lines[i].slice(0, 100),
          url: result.result.final_url || "",
          content: lines[i],
        });
      }
    }

    log.debug({ query, maxResults, resultCount: results.length }, "webSearchStep success");
    return { results };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error({ error, query }, "Error in webSearchStep");
    return {
      results: [],
      error: message,
    };
  }
}
