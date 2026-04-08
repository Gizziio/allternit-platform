/**
 * Browser-based URL retrieval using our own browser-use service
 * Replaces Firecrawl with our own browser automation
 * 
 * This uses the Allternit Operator service with browser-use library
 * which provides agent-based browser automation with Chromium + CDP
 */

import { tool } from "ai";
import { z } from "zod";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("tools/browser-retrieve-url");

// Superconductor service URL (local browser-use)
const ALLTERNIT_OPERATOR_URL = process.env.ALLTERNIT_OPERATOR_URL || "http://127.0.0.1:3000";

export const browserRetrieveUrl = tool({
  description: `Fetch content from a URL using our browser automation service.

Uses browser-use library with Chromium + CDP for agent-based browser automation.
No external API keys required - runs locally.

Use for:
- Extract content from a specific URL
- Web scraping and data extraction
- JavaScript-rendered content

Advantages over external APIs:
- No API costs
- No rate limits
- Full control over the browser
- Supports JavaScript-heavy sites`,
  inputSchema: z.object({
    url: z.string().describe("The URL to retrieve content from."),
  }),
  execute: async ({ url }: { url: string }) => {
    try {
      // Call superconductor browser-use service
      const response = await fetch(`${ALLTERNIT_OPERATOR_URL}/browser/retrieve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Browser retrieve failed: ${error}`);
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
      log.error({ err: error, url }, "Browser retrieval error");
      return {
        error: "Failed to retrieve content. Is the Allternit Operator service running?",
        results: [],
      };
    }
  },
});
