import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { MemoryService } from "@/runtime/memory/memory-service"

const DESCRIPTION = `Search and recall persistent memory entries.

Use this to look up memories by keyword before making assumptions about user
preferences, project conventions, or past feedback.

Returns matching memory entries with their content, type, and file location.`

export const MemoryRecallTool = Tool.define("memory_recall", {
  description: DESCRIPTION,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search terms to match against memory names, descriptions, types, and body content. Leave empty to list all memories.",
      ),
  }),
  async execute(params, _ctx) {
    const entries = params.query.trim()
      ? await MemoryService.search(params.query)
      : await MemoryService.list()

    const count = entries.length
    const filenames = entries.map((e) => e.filename)

    if (count === 0) {
      return {
        title: "No memories found",
        output: params.query ? `No memories matching "${params.query}"` : "No memories saved yet.",
        metadata: { count, filenames },
      }
    }

    const formatted = entries
      .map((e) =>
        [
          `## ${e.name} (${e.type})`,
          `**File:** ${e.filename}`,
          `**Description:** ${e.description}`,
          ``,
          e.body.trim(),
        ].join("\n"),
      )
      .join("\n\n---\n\n")

    return {
      title: `Recalled ${count} memor${count === 1 ? "y" : "ies"}`,
      output: formatted,
      metadata: { count, filenames },
    }
  },
})
