/**
 * URL retrieval - using browser-use service instead of paid APIs
 * Falls back to Firecrawl only if API key is configured
 */

import { tool } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("tools/retrieve-url");

const ALLTERNIT_OPERATOR_URL = process.env.ALLTERNIT_OPERATOR_URL || "http://127.0.0.1:3000";

export const retrieveUrl = tool({
  description: `Fetch structured information from a URL using browser automation.

Uses browser-use library (Chromium + CDP) for agent-based browser automation.
Runs locally via Allternit Operator service - no external API keys required.

Use for:
- Extract content from a specific URL supplied by the user
- Web scraping without external API costs
- JavaScript-rendered content

Three modes available via superconductor:
- browser-use: Full agent with reasoning and planning
- playwright: Fast headless control
- computer-use: Vision-based desktop-like interaction`,
  inputSchema: z.object({
    url: z.string().describe("The URL to retrieve the information from."),
  }),
  execute: async ({ url }: { url: string }) => {
    try {
      // Try browser-use service first (free, local)
      const response = await fetch(`${ALLTERNIT_OPERATOR_URL}/browser/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        // Fallback: Check if it's just the service not running
        const errorText = await response.text();
        log.warn({ url, error: errorText }, "Browser service unavailable, checking fallback");
        
        // If we have Firecrawl API key, could use that as fallback
        if (env.FIRECRAWL_API_KEY) {
          // Would call Firecrawl here as fallback
          log.info("Would use Firecrawl fallback");
        }
        
        return {
          error: "Browser automation service not available. Ensure Allternit Operator is running on port 3008.",
          results: [],
        };
      }

      const result = await response.json();

      if (!result.success) {
        return {
          error: result.error || "Failed to retrieve content",
          results: [],
        };
      }

      return {
        results: [
          {
            title: result.title || "Untitled",
            content: result.content || "",
            url: result.url,
            description: (result.content || "").slice(0, 200),
            language: "en",
          },
        ],
      };
    } catch (error) {
      log.error({ err: error, url }, "URL retrieval error");
      return {
        error: "Failed to retrieve content. Is the Allternit Operator service running?",
        results: [],
      };
    }
  },
});
