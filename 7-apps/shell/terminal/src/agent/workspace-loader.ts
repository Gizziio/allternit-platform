/**
 * Agent Workspace Loader
 * 
 * Loads agents from workspace directories (.a2r, .openclaw)
 * and integrates them with the main agent system.
 */

import { Agent } from "./agent"
import * as AgentWorkspaceBridge from "@/agent-workspace/bridge"
import { PermissionNext } from "@/permission/next"
import { Log } from "@/util/log"

const log = Log.create({ service: "agent-workspace-loader" })

export interface WorkspaceAgentInfo extends Agent.Info {
  /** Source of the agent */
  source: "config" | "a2r" | "openclaw"
  /** Path to agent definition if from workspace */
  workspacePath?: string
}

/**
 * Load all agents including those from workspace
 * @param directory - Optional directory to detect workspace from (defaults to process.cwd())
 */
export async function loadAllAgents(directory?: string): Promise<WorkspaceAgentInfo[]> {
  // Get config-based agents
  const configAgents = await Agent.list()
  
  // Detect workspace from the provided directory or current working directory
  const workspace = await AgentWorkspaceBridge.detectWorkspace(directory)
  if (!workspace) {
    return configAgents.map((a: Agent.Info) => ({ ...a, source: "config" as const }))
  }

  log.info("Detected workspace", { type: workspace.type, path: workspace.path })

  // Load workspace agents
  const workspaceAgentList = await AgentWorkspaceBridge.getWorkspaceAgents(
    workspace.path, 
    workspace.type
  )

  // Convert workspace agents to Agent.Info format
  const workspaceAgents: WorkspaceAgentInfo[] = []
  
  for (const wsAgent of workspaceAgentList) {
    try {
      const agentInfo = await convertWorkspaceAgent(wsAgent, workspace)
      if (agentInfo) {
        workspaceAgents.push(agentInfo)
      }
    } catch (e) {
      log.error("Failed to load workspace agent", { 
        name: wsAgent.name, 
        error: e instanceof Error ? e.message : String(e) 
      })
    }
  }

  // Also create a "workspace-native" agent that embodies the workspace identity
  if (workspace.identity) {
    const identityAgent = await createIdentityAgent(workspace)
    if (identityAgent) {
      workspaceAgents.push(identityAgent)
    }
  }

  // Merge config and workspace agents
  // Config agents take precedence if there's a name conflict
  const configNames = new Set(configAgents.map((a: Agent.Info) => a.name))
  const uniqueWorkspaceAgents = workspaceAgents.filter((a: WorkspaceAgentInfo) => !configNames.has(a.name))

  return [
    ...configAgents.map((a: Agent.Info) => ({ ...a, source: "config" as const })),
    ...uniqueWorkspaceAgents,
  ]
}

/**
 * Convert a workspace agent config to Agent.Info
 */
async function convertWorkspaceAgent(
  wsAgent: { name: string; path: string; config?: any },
  workspace: AgentWorkspaceBridge.DetectedWorkspace
): Promise<WorkspaceAgentInfo | null> {
  if (!wsAgent.config) return null

  const cfg = wsAgent.config
  
  // Generate system prompt from workspace context
  const basePrompt = cfg.purpose ? String(cfg.purpose) : `Agent: ${String(cfg.name)}`
  const enhancedPrompt = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt(
    basePrompt,
    workspace
  )

  // Build permissions from config
  const permissions: PermissionNext.Rule[] = []
  const perms = cfg.permissions || {}
  
  if (perms.spawn_agents) {
    permissions.push(...PermissionNext.fromConfig({ agent: "allow" }))
  }
  if (perms.delegate_work) {
    permissions.push(...PermissionNext.fromConfig({ todo: "allow" }))
  }
  if (perms.retire_agents) {
    permissions.push(...PermissionNext.fromConfig({ "agent.delete": "allow" }))
  }

  // Determine mode based on authority level
  let mode: "primary" | "subagent" | "all" = "subagent"
  if (cfg.authority_level === "highest") {
    mode = "all"
  } else if (cfg.authority_level === "high") {
    mode = "primary"
  }

  return {
    name: String(cfg.name).toLowerCase().replace(/[^a-z0-9_-]/g, "-") || wsAgent.name,
    description: String(cfg.purpose || `Workspace agent from ${workspace.type}`),
    prompt: enhancedPrompt,
    mode,
    permission: permissions.length > 0 
      ? PermissionNext.merge(PermissionNext.fromConfig({ "*": "ask" }), permissions)
      : PermissionNext.fromConfig({ "*": "ask" }),
    options: {
      workspace_source: workspace.type,
      workspace_path: wsAgent.path,
      original_config: cfg,
      core_functions: cfg.core_functions || [],
      owner: cfg.owner,
    },
    native: false,
    source: workspace.type,
    workspacePath: wsAgent.path,
  }
}

/**
 * Create an identity agent from workspace identity
 */
async function createIdentityAgent(
  workspace: AgentWorkspaceBridge.DetectedWorkspace
): Promise<WorkspaceAgentInfo | null> {
  if (!workspace.identity?.name) return null

  const name = workspace.identity.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
  
  // Generate the full system prompt
  const systemPrompt = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt(
    "",
    workspace
  )

  return {
    name,
    description: workspace.identity.creature || `${workspace.type} workspace identity agent`,
    prompt: systemPrompt,
    mode: "all",
    permission: PermissionNext.fromConfig({
      "*": "allow",
      bash: "allow",
      read: "allow",
      write: "allow",
      agent: "allow",
    }),
    options: {
      workspace_identity: true,
      workspace_source: workspace.type,
      workspace_path: workspace.path,
      vibe: workspace.identity.vibe,
    },
    native: false,
    source: workspace.type,
    workspacePath: workspace.path,
  }
}

/**
 * Get the default agent considering workspace context
 */
export async function getDefaultAgentWithContext(): Promise<string> {
  const workspace = await AgentWorkspaceBridge.detectWorkspace()
  
  if (workspace?.identity) {
    const identityName = workspace.identity.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-")
    // Check if identity agent exists
    const allAgents = await loadAllAgents()
    if (allAgents.some((a: WorkspaceAgentInfo) => a.name === identityName)) {
      log.info("Using workspace identity as default", { name: identityName })
      return identityName
    }
  }

  // Fall back to standard default
  return Agent.defaultAgent()
}

/**
 * Enhance agent prompt with workspace context
 */
export async function enhanceWithWorkspaceContext(
  agentName: string,
  basePrompt: string
): Promise<string> {
  const workspace = await AgentWorkspaceBridge.detectWorkspace()
  if (!workspace) return basePrompt

  // Don't double-enhance
  if (basePrompt.includes("# Workspace Identity") || basePrompt.includes("# Workspace Context")) {
    return basePrompt
  }

  return AgentWorkspaceBridge.generateWorkspaceAwarePrompt(basePrompt, workspace)
}
