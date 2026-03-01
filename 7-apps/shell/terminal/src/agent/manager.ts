import { Config } from "@/config/config"
import { Agent } from "./agent"
import { Log } from "@/util/log"
import z from "zod/v4"
import { PermissionNext } from "@/permission/next"
import { mergeDeep } from "remeda"
import * as AgentWorkspaceLoader from "./workspace-loader"

export namespace AgentManager {
  const log = Log.create({ service: "agent-manager" })

  export const AgentInput = z.object({
    name: z.string().min(1).max(64).regex(/^[a-z0-9_-]+$/),
    description: z.string().optional(),
    prompt: z.string().optional(),
    mode: z.enum(["subagent", "primary", "all"]).default("primary"),
    model: z
      .object({
        providerID: z.string(),
        modelID: z.string(),
      })
      .optional(),
    variant: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    color: z.string().optional(),
    hidden: z.boolean().optional(),
    steps: z.number().int().positive().optional(),
    permission: z.record(z.string(), z.any()).optional(),
    options: z.record(z.string(), z.any()).optional(),
  })
  export type AgentInput = z.infer<typeof AgentInput>

  export const AgentUpdateInput = AgentInput.partial().omit({ name: true })
  export type AgentUpdateInput = z.infer<typeof AgentUpdateInput>

  export async function create(input: AgentInput): Promise<Agent.Info> {
    const cfg = await Config.get()
    const existing = await Agent.list()

    if (existing.some((a) => a.name === input.name)) {
      throw new Error(`Agent "${input.name}" already exists`)
    }

    const defaults = await getDefaultPermissions()
    const userPerms = input.permission ? PermissionNext.fromConfig(input.permission) : []

    const agentConfig: Agent.Info = {
      name: input.name,
      description: input.description ?? `Custom ${input.mode} agent`,
      prompt: input.prompt,
      mode: input.mode,
      model: input.model,
      variant: input.variant,
      temperature: input.temperature,
      topP: input.topP,
      color: input.color,
      hidden: input.hidden ?? false,
      steps: input.steps,
      options: input.options ?? {},
      permission: PermissionNext.merge(defaults, userPerms),
      native: false,
    }

    const updatedAgents = {
      ...cfg.agent,
      [input.name]: agentToConfig(input.name, agentConfig),
    }

    await Config.updateGlobal({
      agent: updatedAgents,
    })

    log.info("agent created", { name: input.name, mode: input.mode })

    return agentConfig
  }

  export async function update(name: string, input: AgentUpdateInput): Promise<Agent.Info> {
    const cfg = await Config.get()
    const existing = await Agent.get(name)

    if (!existing) {
      throw new Error(`Agent "${name}" not found`)
    }

    if (existing.native) {
      throw new Error(`Cannot modify native agent "${name}"`)
    }

    const currentConfig = cfg.agent?.[name] ?? {}

    const updatedConfig = {
      ...currentConfig,
      ...(input.description !== undefined && { description: input.description }),
      ...(input.prompt !== undefined && { prompt: input.prompt }),
      ...(input.mode !== undefined && { mode: input.mode }),
      ...(input.model !== undefined && { model: `${input.model.providerID}/${input.model.modelID}` }),
      ...(input.variant !== undefined && { variant: input.variant }),
      ...(input.temperature !== undefined && { temperature: input.temperature }),
      ...(input.topP !== undefined && { top_p: input.topP }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.hidden !== undefined && { hidden: input.hidden }),
      ...(input.steps !== undefined && { steps: input.steps }),
      ...(input.permission !== undefined && { permission: input.permission }),
      ...(input.options !== undefined && { options: mergeDeep(currentConfig.options ?? {}, input.options) }),
    }

    await Config.updateGlobal({
      agent: {
        ...cfg.agent,
        [name]: updatedConfig,
      },
    })

    log.info("agent updated", { name })

    const updated = await Agent.get(name)
    if (!updated) throw new Error(`Agent "${name}" not found after update`)
    return updated
  }

  export async function remove(name: string): Promise<void> {
    const cfg = await Config.get()
    const existing = await Agent.get(name)

    if (!existing) {
      throw new Error(`Agent "${name}" not found`)
    }

    if (existing.native) {
      throw new Error(`Cannot remove native agent "${name}"`)
    }

    const { [name]: _, ...remainingAgents } = cfg.agent ?? {}

    await Config.updateGlobal({
      agent: remainingAgents,
    })

    log.info("agent removed", { name })
  }

  export async function list(directory?: string): Promise<Agent.Info[]> {
    // Use workspace-aware loader to include agents from .a2r/.openclaw
    const agents = await AgentWorkspaceLoader.loadAllAgents(directory)
    return agents as Agent.Info[]
  }

  export async function get(name: string, directory?: string): Promise<Agent.Info | undefined> {
    // Try config-based agents first
    const configAgent = await Agent.get(name)
    if (configAgent) return configAgent
    
    // Fall back to workspace agents (from the specified directory)
    const allAgents = await AgentWorkspaceLoader.loadAllAgents(directory)
    const found = allAgents.find((a: AgentWorkspaceLoader.WorkspaceAgentInfo) => a.name === name)
    return found as Agent.Info | undefined
  }

  export async function setDefault(name: string): Promise<void> {
    const cfg = await Config.get()
    const existing = await Agent.get(name)

    if (!existing) {
      throw new Error(`Agent "${name}" not found`)
    }

    if (existing.mode === "subagent") {
      throw new Error(`Cannot set subagent "${name}" as default`)
    }

    await Config.updateGlobal({
      default_agent: name,
    })

    log.info("default agent set", { name })
  }

  async function getDefaultPermissions() {
    const cfg = await Config.get()
    const skillDirs = await (await import("@/skill")).Skill.dirs()
    const { Truncate } = await import("@/tool/truncation")
    const path = await import("path")

    const whitelistedDirs = [Truncate.GLOB, ...skillDirs.map((dir) => path.join(dir, "*"))]

    return PermissionNext.fromConfig({
      "*": "allow",
      doom_loop: "ask",
      external_directory: {
        "*": "ask",
        ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
      },
      question: "deny",
      plan_enter: "deny",
      plan_exit: "deny",
      read: {
        "*": "allow",
        "*.env": "ask",
        "*.env.*": "ask",
        "*.env.example": "allow",
      },
    })
  }

  function agentToConfig(name: string, agent: Agent.Info): Record<string, any> {
    const config: Record<string, any> = {
      name: agent.name,
      description: agent.description,
      mode: agent.mode,
      hidden: agent.hidden,
      options: agent.options,
    }

    if (agent.prompt) config.prompt = agent.prompt
    if (agent.model) config.model = `${agent.model.providerID}/${agent.model.modelID}`
    if (agent.variant) config.variant = agent.variant
    if (agent.temperature !== undefined) config.temperature = agent.temperature
    if (agent.topP !== undefined) config.top_p = agent.topP
    if (agent.color) config.color = agent.color
    if (agent.steps) config.steps = agent.steps

    return config
  }
}
