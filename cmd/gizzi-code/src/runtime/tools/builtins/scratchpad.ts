import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { Scratchpad } from "@/runtime/session/scratchpad"

export const ScratchpadListTool = Tool.define("scratchpad_list", {
  description: "List private and shared scratchpad files for this session without reading their contents.",
  parameters: z.object({}),
  async execute(_params, ctx) {
    const result = await Scratchpad.list(ctx.sessionID)
    return {
      title: "Scratchpad files",
      metadata: { count: result.entries.length },
      output: JSON.stringify({
        sessionID: result.scope.sessionID,
        rootSessionID: result.scope.rootSessionID,
        entries: result.entries,
      }, null, 2),
    }
  },
})

export const ScratchpadReadTool = Tool.define("scratchpad_read", {
  description: "Read a UTF-8 file from this agent's private scratchpad or the root session's shared scratchpad.",
  parameters: z.object({
    path: z.string().min(1).describe("Relative scratchpad path."),
    shared: z.boolean().default(false).describe("Read from the shared root-session area instead of this agent's private area."),
  }),
  async execute(params, ctx) {
    const result = await Scratchpad.read({ sessionID: ctx.sessionID, path: params.path, shared: params.shared })
    return {
      title: result.path,
      metadata: { path: result.path, shared: result.shared, bytes: result.bytes },
      output: result.content,
    }
  },
})

export const ScratchpadWriteTool = Tool.define("scratchpad_write", {
  description: "Atomically write a UTF-8 working file to this agent's private or deliberately shared scratchpad. This does not modify the project or long-term memory.",
  parameters: z.object({
    path: z.string().min(1).describe("Relative scratchpad path."),
    content: z.string(),
    shared: z.boolean().default(false).describe("Write to the shared root-session area for sibling-agent coordination."),
  }),
  async execute(params, ctx) {
    const result = await Scratchpad.write({
      sessionID: ctx.sessionID,
      path: params.path,
      content: params.content,
      shared: params.shared,
    })
    return {
      title: result.path,
      metadata: result,
      output: `Wrote ${result.bytes} bytes to ${result.shared ? "shared" : "private"} scratchpad file ${result.path}.`,
    }
  },
})

export const ScratchpadRemoveTool = Tool.define("scratchpad_remove", {
  description: "Remove one file from this agent's private or shared scratchpad. This cannot delete project files or directories.",
  parameters: z.object({
    path: z.string().min(1).describe("Relative scratchpad path."),
    shared: z.boolean().default(false),
  }),
  async execute(params, ctx) {
    const removed = await Scratchpad.remove({ sessionID: ctx.sessionID, path: params.path, shared: params.shared })
    return {
      title: params.path,
      metadata: { path: params.path, shared: params.shared, removed },
      output: removed ? `Removed scratchpad file ${params.path}.` : `Scratchpad file ${params.path} did not exist.`,
    }
  },
})
