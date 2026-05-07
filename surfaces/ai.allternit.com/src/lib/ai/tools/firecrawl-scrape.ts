import { tool } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("tools/firecrawl-scrape");

export const scrapeWebsite = tool({
  description: `Scrape content from a specific URL using Firecrawl. Extracts markdown, HTML, screenshots, and links.

Use for:
- Extracting structured content from a known URL
- Getting markdown or HTML from web pages
- Finding all links on a page
- Taking screenshots of web pages

Avoid:
- General web search (use webSearch instead)
- When you don't have a specific URL`,
  inputSchema: z.object({
    url: z.string().describe("The URL to scrape."),
    formats: z
      .array(z.enum(["markdown", "html", "screenshot", "links"]))
      .optional()
      .describe("Output formats to extract. Defaults to [markdown]."),
  }),
  execute: async ({
    url,
    formats,
  }: {
    url: string;
    formats?: ("markdown" | "html" | "screenshot" | "links")[];
  }) => {
    try {
      if (!env.FIRECRAWL_API_KEY) {
        return {
          error: "Firecrawl API key is not configured.",
          url,
        };
      }

      const scrapeFormats = formats ?? ["markdown"];

      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({
          url,
          formats: scrapeFormats,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error(
          { url, status: response.status, error: errorText },
          "Firecrawl scrape failed"
        );
        return {
          error: `Firecrawl scrape failed (${response.status}): ${errorText}`,
          url,
        };
      }

      const data = await response.json();

      if (!data.success) {
        return {
          error: data.error || "Firecrawl scrape unsuccessful",
          url,
        };
      }

      return {
        url,
        markdown: data.data?.markdown || "",
        html: data.data?.html || "",
        screenshot: data.data?.screenshot || "",
        links: data.data?.links || [],
        metadata: {
          title: data.data?.metadata?.title || "",
          description: data.data?.metadata?.description || "",
          sourceURL: data.data?.metadata?.sourceURL || url,
        },
      };
    } catch (error) {
      log.error({ err: error, url }, "Firecrawl scrape error");
      return {
        error:
          "Failed to scrape website. Please check the URL and try again.",
        url,
      };
    }
  },
});
