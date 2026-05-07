import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"

const MEMORY_URL = process.env.ALLTERNIT_MEMORY_URL ?? "http://127.0.0.1:3201"

const DESCRIPTION = `Query the persistent memory store for relevant information using natural language.

This tool searches across all ingested memories, documents, and context using
semantic vector search and local LLM synthesis. Use it when you need to recall
past project details, user preferences, or any information that may have been
stored in the memory agent.`

export const MemoryQueryTool = Tool.define("memory_query", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe("Natural language query to search the memory store."),
  }),
  async execute(params, _ctx) {
    const response = await fetch(`${MEMORY_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: params.query }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Memory query failed (${response.status}): ${text}`)
    }

    const result = await response.json()

    return {
      title: `Memory query: ${params.query}`,
      output: JSON.stringify(result, null, 2),
      metadata: result,
    }
  },
})
