import { tool } from "ai";
import { z } from "zod";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { createModuleLogger } from "@/lib/logger";
import type { StreamWriter } from "../types";
import { toolsDefinitions } from "./tools-definitions";

const ON_BASE = process.env.NEXT_PUBLIC_OPEN_NOTEBOOK_URL || "http://127.0.0.1:5055";
const log = createModuleLogger("tools/notebook");

// ─── Notebook Ingest ────────────────────────────────────────────────────────

export const notebookIngestTool = ({
  dataStream,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  costAccumulator?: CostAccumulator;
}) =>
  tool({
    description: `Ingest content into a research notebook. Use this to save analysis, code, URLs, or text documents so they can be queried later with notebookQuery.

Use for:
- Saving agent outputs (analysis, code, logs) into a persistent research notebook
- Storing URLs or documents the user references for later retrieval
- Building up a knowledge base across multiple turns

Requires an existing notebook_id. If none exists, the user must create one first.`,
    inputSchema: z.object({
      notebook_id: z.string().describe("The notebook ID to ingest into."),
      title: z.string().describe("Title for this source entry."),
      content: z.string().describe("The text content to ingest."),
      type: z
        .enum(["url", "upload", "text", "gmail", "slack", "notion"])
        .describe("Source type. Defaults to 'text'.")
        .optional(),
      url: z
        .string()
        .describe("Optional URL if the source is a web page.")
        .optional(),
    }),
    execute: async (
      {
        notebook_id,
        title,
        content,
        type,
        url,
      }: {
        notebook_id: string;
        title: string;
        content: string;
        type?: "url" | "upload" | "text" | "gmail" | "slack" | "notion";
        url?: string;
      },
      { toolCallId }: { toolCallId: string }
    ) => {
      log.debug({ notebook_id, title, type, url }, "notebookIngestTool.execute");

      dataStream.write({
        type: "data-researchUpdate",
        data: {
          toolCallId,
          title: `Ingesting: ${title}`,
          timestamp: Date.now(),
          type: "started",
        },
      });

      try {
        const res = await fetch(`${ON_BASE}/api/notebooks/${notebook_id}/sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: type || "text",
            title,
            content,
            url,
            status: "extracted",
          }),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Ingest failed: ${err}`);
        }

        const result = await res.json();

        dataStream.write({
          type: "data-researchUpdate",
          data: {
            toolCallId,
            title: `Ingested: ${title}`,
            timestamp: Date.now(),
            type: "completed",
          },
        });

        costAccumulator?.addAPICost("notebookIngest", toolsDefinitions.notebookIngest?.cost ?? 0);

        return {
          success: true,
          source_id: result.id,
          notebook_id,
          title,
          token_count: result.token_count || 0,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ notebook_id, title, error: message }, "notebookIngestTool failed");
        return {
          success: false,
          error: message,
        };
      }
    },
  });

// ─── Notebook Query ─────────────────────────────────────────────────────────

export const notebookQueryTool = ({
  dataStream,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  costAccumulator?: CostAccumulator;
}) =>
  tool({
    description: `Query a research notebook using semantic search. Returns grounded excerpts from previously ingested sources with citation indices.

Use for:
- Retrieving facts from previously saved research
- Answering questions based on ingested documents
- Finding relevant passages across multiple sources

Always cite results using [1], [2], etc. referencing the returned excerpts.`,
    inputSchema: z.object({
      notebook_id: z.string().describe("The notebook ID to query."),
      query: z.string().describe("The search query."),
      limit: z
        .number()
        .min(1)
        .max(20)
        .describe("Max results to return. Defaults to 5.")
        .optional(),
    }),
    execute: async (
      {
        notebook_id,
        query,
        limit,
      }: {
        notebook_id: string;
        query: string;
        limit?: number;
      },
      { toolCallId }: { toolCallId: string }
    ) => {
      log.debug({ notebook_id, query, limit }, "notebookQueryTool.execute");

      dataStream.write({
        type: "data-researchUpdate",
        data: {
          toolCallId,
          title: `Querying notebook`,
          timestamp: Date.now(),
          type: "started",
        },
      });

      try {
        const res = await fetch(`${ON_BASE}/api/notebooks/${notebook_id}/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit: limit || 5 }),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Query failed: ${err}`);
        }

        const { results } = await res.json();

        dataStream.write({
          type: "data-researchUpdate",
          data: {
            toolCallId,
            title: `Found ${results.length} results`,
            timestamp: Date.now(),
            type: "completed",
          },
        });

        costAccumulator?.addAPICost("notebookQuery", toolsDefinitions.notebookQuery?.cost ?? 0);

        return {
          success: true,
          notebook_id,
          query,
          results: results.map((r: any, i: number) => ({
            index: i + 1,
            excerpt: r.excerpt || r.text || "",
            source_id: r.source_id,
            score: r.score,
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ notebook_id, query, error: message }, "notebookQueryTool failed");
        return {
          success: false,
          error: message,
        };
      }
    },
  });

// ─── Notebook Summarize ─────────────────────────────────────────────────────

export const notebookSummarizeTool = ({
  dataStream,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  costAccumulator?: CostAccumulator;
}) =>
  tool({
    description: `Generate a summary, briefing, FAQ, or timeline from a research notebook's sources. This transforms the notebook content into a structured document.

Use for:
- Summarizing all sources in a notebook
- Creating a briefing document from research
- Generating a FAQ or timeline from ingested content

The output is a markdown-formatted string suitable for display or further editing.`,
    inputSchema: z.object({
      notebook_id: z.string().describe("The notebook ID to summarize."),
      type: z
        .enum(["summary", "briefing", "faq", "timeline"])
        .describe("Transformation type."),
    }),
    execute: async (
      {
        notebook_id,
        type,
      }: {
        notebook_id: string;
        type: "summary" | "briefing" | "faq" | "timeline";
      },
      { toolCallId }: { toolCallId: string }
    ) => {
      log.debug({ notebook_id, type }, "notebookSummarizeTool.execute");

      dataStream.write({
        type: "data-researchUpdate",
        data: {
          toolCallId,
          title: `Generating ${type}`,
          timestamp: Date.now(),
          type: "started",
        },
      });

      try {
        const res = await fetch(`${ON_BASE}/api/notebooks/${notebook_id}/transform`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type }),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Transform failed: ${err}`);
        }

        const { content } = await res.json();

        dataStream.write({
          type: "data-researchUpdate",
          data: {
            toolCallId,
            title: `${type} complete`,
            timestamp: Date.now(),
            type: "completed",
          },
        });

        costAccumulator?.addAPICost("notebookSummarize", toolsDefinitions.notebookSummarize?.cost ?? 0);

        return {
          success: true,
          notebook_id,
          type,
          content,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log.error({ notebook_id, type, error: message }, "notebookSummarizeTool failed");
        return {
          success: false,
          error: message,
        };
      }
    },
  });
