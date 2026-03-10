import { QuestionTool } from "@/runtime/tools/builtins/question"
import { VerifyTool } from "@/runtime/tools/builtins/verify"
import { BashTool } from "@/runtime/tools/builtins/bash"
import { EditTool } from "@/runtime/tools/builtins/edit"
import { GlobTool } from "@/runtime/tools/builtins/glob"
import { GrepTool } from "@/runtime/tools/builtins/grep"
import { BatchTool } from "@/runtime/tools/builtins/batch"
import { ReadTool } from "@/runtime/tools/builtins/read"
import { TaskTool } from "@/runtime/tools/builtins/task"
import { TodoWriteTool } from "@/runtime/tools/builtins/todo"
import { WebFetchTool } from "@/runtime/tools/builtins/webfetch"
import { WriteTool } from "@/runtime/tools/builtins/write"
import { InvalidTool } from "@/runtime/tools/builtins/invalid"
import { SkillTool } from "@/runtime/tools/builtins/skill"
import { AgentCommunicateTool } from "@/runtime/tools/builtins/agent-communicate"
import type { Agent } from "@/runtime/loop/agent"
import { Tool } from "@/runtime/tools/builtins/tool"
import { Instance } from "@/runtime/context/project/instance"
import { Config } from "@/runtime/context/config/config"
import path from "path"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@a2r/plugin"
import z from "zod/v4"
import { Plugin } from "@/runtime/integrations/plugin"
import { WebSearchTool } from "@/runtime/tools/builtins/websearch"
import { CodeSearchTool } from "@/runtime/tools/builtins/codesearch"
import { Flag } from "@/runtime/context/flag/flag"
import { Log } from "@/shared/util/log"
import { LspTool } from "@/runtime/tools/builtins/lsp"
import { Truncate } from "@/runtime/tools/builtins/truncation"
import { PlanExitTool, PlanEnterTool } from "@/runtime/tools/builtins/plan"
import { ApplyPatchTool } from "@/runtime/tools/builtins/apply_patch"
import { NotebookEditTool } from "@/runtime/tools/builtins/notebook"
import { Glob } from "@/shared/util/glob"

export namespace ToolRegistry {
  const log = Log.create({ service: "tool.registry" })

  export const state = Instance.state(async () => {
    const custom = [] as Tool.Info[]

    const matches = await Config.directories().then((dirs) =>
      dirs.flatMap((dir) =>
        Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
      ),
    )
    if (matches.length) await Config.waitForDependencies()
    for (const match of matches) {
      const namespace = path.basename(match, path.extname(match))
      const mod = await import(match)
      for (const [id, def] of Object.entries<ToolDefinition>(mod)) {
        custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
      }
    }

    const plugins = await Plugin.list()
    for (const plugin of plugins) {
      for (const [id, def] of Object.entries(plugin.tool ?? {})) {
        custom.push(fromPlugin(id, def))
      }
    }

    return { custom }
  })

  function fromPlugin(id: string, def: ToolDefinition): Tool.Info {
    return {
      id,
      init: async (initCtx) => ({
        parameters: z.object(def.args),
        description: def.description,
        execute: async (args, ctx) => {
          const pluginCtx = {
            ...ctx,
            directory: Instance.directory,
            worktree: Instance.worktree,
          } as unknown as PluginToolContext
          const result = await def.execute(args as any, pluginCtx)
          const out = await Truncate.output(result, {}, initCtx?.agent)
          return {
            title: "",
            output: out.truncated ? out.content : result,
            metadata: { truncated: out.truncated, outputPath: out.truncated ? out.outputPath : undefined },
          }
        },
      }),
    }
  }

  export async function register(tool: Tool.Info) {
    const { custom } = await state()
    const idx = custom.findIndex((t) => t.id === tool.id)
    if (idx >= 0) {
      custom.splice(idx, 1, tool)
      return
    }
    custom.push(tool)
  }

  async function all(): Promise<Tool.Info[]> {
    const custom = await state().then((x) => x.custom)
    const config = await Config.get()
    const question = ["app", "cli", "desktop"].includes(Flag.GIZZI_CLIENT) || Flag.GIZZI_ENABLE_QUESTION_TOOL

    return [
      InvalidTool,
      ...(question ? [QuestionTool] : []),
      AgentCommunicateTool,
      VerifyTool,
      BashTool,
      ReadTool,
      GlobTool,
      GrepTool,
      EditTool,
      WriteTool,
      TaskTool,
      WebFetchTool,
      TodoWriteTool,
      // TodoReadTool,
      WebSearchTool,
      CodeSearchTool,
      SkillTool,
      ApplyPatchTool,
      NotebookEditTool,
      ...(Flag.GIZZI_EXPERIMENTAL_LSP_TOOL ? [LspTool] : []),
      ...(config.experimental?.batch_tool === true ? [BatchTool] : []),
      ...(Flag.GIZZI_EXPERIMENTAL_PLAN_MODE && Flag.GIZZI_CLIENT === "cli" ? [PlanExitTool, PlanEnterTool] : []),
      ...custom,
    ]
  }

  export async function ids() {
    return all().then((x) => x.map((t) => t.id))
  }

  export async function tools(
    model: {
      providerID: string
      modelID: string
    },
    agent?: Agent.Info,
  ) {
    const tools = await all()
    const result = await Promise.all(
      tools
        .filter((t) => {
          // Enable websearch/codesearch for zen users OR via enable flag
          if (t.id === "codesearch" || t.id === "websearch") {
            return model.providerID === "gizzi" || Flag.GIZZI_ENABLE_EXA
          }

          // use apply tool in same format as codex
          const usePatch =
            model.modelID.includes("gpt-") && !model.modelID.includes("oss") && !model.modelID.includes("gpt-4")
          if (t.id === "apply_patch") return usePatch
          if (t.id === "edit" || t.id === "write") return !usePatch

          return true
        })
        .map(async (t) => {
          using _ = log.time(t.id)
          const tool = await t.init({ agent })
          const output = {
            description: tool.description,
            parameters: tool.parameters,
          }
          await Plugin.trigger("tool.definition", { toolID: t.id }, output)
          return {
            id: t.id,
            ...tool,
            description: output.description,
            parameters: output.parameters,
          }
        }),
    )
    return result
  }
}
