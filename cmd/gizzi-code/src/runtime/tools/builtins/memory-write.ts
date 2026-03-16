import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { MemoryService, type MemoryType } from "@/runtime/memory/memory-service"

const DESCRIPTION = `Save or update a persistent memory entry.

Memories persist across conversations and are automatically loaded into future sessions.
Use this tool when:
- The user asks you to remember something
- You learn a stable pattern, preference, or important project fact
- You want to correct or remove an outdated memory

Memory format uses frontmatter with name, description (one-line summary used to decide
relevance in future sessions), and type (user | feedback | project | reference).

Do NOT save:
- Session-specific details or in-progress work state
- Information that's derivable from reading the code
- Speculative or unverified conclusions`

export const MemoryWriteTool = Tool.define("memory_write", {
  description: DESCRIPTION,
  parameters: z.object({
    name: z
      .string()
      .describe(
        "Short kebab/snake_case identifier for this memory (e.g. 'user_role', 'testing_feedback'). Used as the filename stem.",
      ),
    description: z
      .string()
      .describe(
        "One-line description used to determine relevance when loading context in future sessions. Be specific.",
      ),
    type: z
      .enum(["user", "feedback", "project", "reference"])
      .describe(
        "Memory type: 'user' = user preferences/role, 'feedback' = corrections/guidance, 'project' = project context, 'reference' = pointers to external resources",
      ),
    body: z
      .string()
      .describe(
        "The memory content. For feedback/project types, lead with the fact/rule then add **Why:** and **How to apply:** lines.",
      ),
  }),
  async execute(params) {
    const entry = await MemoryService.save(
      {
        name: params.name,
        description: params.description,
        type: params.type as MemoryType,
      },
      params.body,
    )
    return {
      title: `Memory saved: ${entry.filename}`,
      output: `Saved memory "${entry.name}" → ${entry.filepath}`,
      metadata: { filename: entry.filename, filepath: entry.filepath, type: entry.type },
    }
  },
})
