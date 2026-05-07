import { tool } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("tools/exa-search");

export const searchExa = tool({
  description: `Semantic web search using Exa AI. Finds relevant web pages based on meaning rather than keyword matching.

Use for:
- Research and information discovery
- Finding semantically similar content
- General knowledge queries
- When you need high-quality search results with summaries

Avoid:
- When you already know the exact URL (use scrapeWebsite instead)
- Real-time data like stock prices or weather (use getWeather or webSearch instead)`,
  inputSchema: z.object({
    query: z.string().describe("The search query."),
    numResults: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of results to return. Defaults to 5."),
    type: z
      .enum(["neural", "keyword", "auto"])
      .optional()
      .describe('Search type. "neural" for semantic search, "keyword" for exact matching, "auto" to let Exa decide. Defaults to "auto".'),
  }),
  execute: async ({
    query,
    numResults,
    type,
  }: {
    query: string;
    numResults?: number;
    type?: "neural" | "keyword" | "auto";
  }) => {
    try {
      if (!env.EXA_API_KEY) {
        return {
          error: "Exa API key is not configured.",
          query,
          results: [],
        };
      }

      const response = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.EXA_API_KEY,
        },
        body: JSON.stringify({
          query,
          numResults: numResults ?? 5,
          type: type ?? "auto",
          useAutoprompt: true,
          contents: {
            text: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error(
          { query, status: response.status, error: errorText },
          "Exa search failed"
        );
        return {
          error: `Exa search failed (${response.status}): ${errorText}`,
          query,
          results: [],
        };
      }

      const data = await response.json();

      const results = (data.results || []).map((result: any) => ({
        title: result.title || "",
        url: result.url || "",
        summary: result.text || result.summary || "",
        score: typeof result.score === "number" ? result.score : 0,
        publishedDate: result.publishedDate || "",
        author: result.author || "",
      }));

      return {
        query,
        numResults: results.length,
        results,
      };
    } catch (error) {
      log.error({ err: error, query }, "Exa search error");
      return {
        error: "Failed to perform search. Please try again.",
        query,
        results: [],
      };
    }
  },
});
