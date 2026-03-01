/**
 * Agent Workspace Bridge
 * 
 * Bridges the A2R Agent Workspace with the OpenClaw workspace format.
 * Detects workspace context from .a2r or .openclaw directories and
 * integrates identity/conventions into agent creation.
 */

import { AgentWorkspace } from "./artifacts"
import { Global } from "@/global"
import path from "path"
import { Filesystem } from "@/util/filesystem"
import fs from "fs/promises"

export interface WorkspaceIdentity {
  /** Agent name from workspace */
  name: string
  /** Creature type description */
  creature?: string
  /** Vibe/personality description */
  vibe?: string
  /** Avatar path */
  avatar?: string
  /** Full system prompt from SOUL.md */
  systemPrompt?: string
  /** Source workspace type */
  source: "a2r" | "openclaw"
  /** Workspace root path */
  workspacePath: string
}

export interface DetectedWorkspace {
  type: "a2r" | "openclaw"
  path: string
  hasIdentity: boolean
  hasSoul: boolean
  identity?: WorkspaceIdentity
}

/**
 * Detect workspace in a directory
 * Looks for .a2r first, then .openclaw
 */
export async function detectWorkspace(
  dir: string = process.cwd()
): Promise<DetectedWorkspace | null> {
  // Check for A2R workspace first
  const a2rPath = path.join(dir, ".a2r")
  if (await AgentWorkspace.exists(a2rPath)) {
    const identity = await loadA2RIdentity(a2rPath)
    return {
      type: "a2r",
      path: a2rPath,
      hasIdentity: !!identity,
      hasSoul: false,
      identity: identity ?? undefined,
    }
  }

  // Check for OpenClaw workspace
  const openclawPath = path.join(dir, ".openclaw")
  if (await Filesystem.exists(openclawPath)) {
    const identity = await loadOpenClawIdentity(openclawPath)
    return {
      type: "openclaw",
      path: openclawPath,
      hasIdentity: !!identity,
      hasSoul: await Filesystem.exists(path.join(openclawPath, "workspace", "docs", "SOUL.md")),
      identity: identity ?? undefined,
    }
  }

  // Check user's home directory for global workspace
  const homeA2r = path.join(Global.Path.home, ".a2r")
  if (await AgentWorkspace.exists(homeA2r)) {
    const identity = await loadA2RIdentity(homeA2r)
    return {
      type: "a2r",
      path: homeA2r,
      hasIdentity: !!identity,
      hasSoul: false,
      identity: identity ?? undefined,
    }
  }

  const homeOpenclaw = path.join(Global.Path.home, ".openclaw")
  if (await Filesystem.exists(homeOpenclaw)) {
    const identity = await loadOpenClawIdentity(homeOpenclaw)
    return {
      type: "openclaw",
      path: homeOpenclaw,
      hasIdentity: !!identity,
      hasSoul: await Filesystem.exists(path.join(homeOpenclaw, "workspace", "docs", "SOUL.md")),
      identity: identity ?? undefined,
    }
  }

  return null
}

/**
 * Load identity from A2R workspace
 */
async function loadA2RIdentity(workspacePath: string): Promise<WorkspaceIdentity | null> {
  try {
    const paths = AgentWorkspace.getPaths(workspacePath)
    
    // Try to load IDENTITY.md from L2
    const identityContent = await Filesystem.readText(paths.l2_identity_md).catch(() => null)
    if (!identityContent) return null

    // Parse identity
    const name = extractField(identityContent, "Name") || 
                 extractField(identityContent, "name") || 
                 "A2R Agent"
    const creature = extractField(identityContent, "Creature") || 
                     extractField(identityContent, "creature")
    const vibe = extractField(identityContent, "Vibe") || 
                 extractField(identityContent, "vibe")
    const avatar = extractField(identityContent, "Avatar") || 
                   extractField(identityContent, "avatar")

    // Try to load SOUL.md equivalent (CONVENTIONS.md or VOICE.md)
    let systemPrompt = ""
    const soulContent = await Filesystem.readText(paths.l2_soul_md).catch(() => null)
    const conventionsContent = await Filesystem.readText(paths.l2_conventions_md).catch(() => null)
    const voiceContent = await Filesystem.readText(paths.l2_voice_md).catch(() => null)
    
    systemPrompt = soulContent || conventionsContent || voiceContent || ""

    return {
      name,
      creature,
      vibe,
      avatar,
      systemPrompt,
      source: "a2r",
      workspacePath,
    }
  } catch {
    return null
  }
}

/**
 * Load identity from OpenClaw workspace
 */
async function loadOpenClawIdentity(openclawPath: string): Promise<WorkspaceIdentity | null> {
  try {
    const docsPath = path.join(openclawPath, "workspace", "docs")
    
    // Load IDENTITY.md
    const identityPath = path.join(docsPath, "IDENTITY.md")
    const identityContent = await Filesystem.readText(identityPath).catch(() => null)
    if (!identityContent) {
      // Try to get from openclaw.json
      return await loadOpenClawJsonIdentity(openclawPath)
    }

    // Parse identity
    const name = extractField(identityContent, "Name") || 
                 extractField(identityContent, "name") || 
                 "OpenClaw Agent"
    const creature = extractField(identityContent, "Creature") || 
                     extractField(identityContent, "creature")
    const vibe = extractField(identityContent, "Vibe") || 
                 extractField(identityContent, "vibe")
    const avatar = extractField(identityContent, "Avatar") || 
                   extractField(identityContent, "avatar")

    // Load SOUL.md for system prompt
    const soulPath = path.join(docsPath, "SOUL.md")
    const systemPrompt = await Filesystem.readText(soulPath).catch(() => null)

    return {
      name,
      creature,
      vibe,
      avatar,
      systemPrompt: systemPrompt || undefined,
      source: "openclaw",
      workspacePath: openclawPath,
    }
  } catch {
    return null
  }
}

/**
 * Load identity from openclaw.json config
 */
async function loadOpenClawJsonIdentity(openclawPath: string): Promise<WorkspaceIdentity | null> {
  try {
    const configPath = path.join(openclawPath, "openclaw.json")
    const configContent = await Filesystem.readText(configPath).catch(() => null)
    if (!configContent) return null

    const config = JSON.parse(configContent)
    
    // Extract identity from config if available
    const agentName = config.agents?.defaults?.agent || "OpenClaw Agent"
    
    // Check for gizzi orchestrator
    const workspaceAgentsPath = path.join(openclawPath, "workspace", "agents")
    if (await Filesystem.exists(workspaceAgentsPath)) {
      const gizziPath = path.join(workspaceAgentsPath, "gizzi-orchestrator", "config.json")
      const gizziConfig = await Filesystem.readText(gizziPath).catch(() => null)
      if (gizziConfig) {
        const gizzi = JSON.parse(gizziConfig)
        return {
          name: gizzi.name || "Gizzi",
          creature: "Persistent distributed intelligence node",
          vibe: "Calm, precise, relentless, strategic",
          systemPrompt: undefined, // Would need to be constructed from config
          source: "openclaw",
          workspacePath: openclawPath,
        }
      }
    }

    return {
      name: agentName,
      source: "openclaw",
      workspacePath: openclawPath,
    }
  } catch {
    return null
  }
}

/**
 * Extract a field from markdown content
 */
function extractField(content: string, field: string): string | undefined {
  const patterns = [
    new RegExp("[-*]\\s*\\*\\*" + field + ":\\*\\*\\s*(.+?)(?:\\n|$)", "i"),
    new RegExp("[-*]\\s*" + field + ":\\s*(.+?)(?:\\n|$)", "i"),
    new RegExp("##\\s*" + field + "\\s*\\n(.+?)(?:\\n##|\\n\\n|$)", "is"),
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match) return match[1].trim()
  }

  return undefined
}

/**
 * Generate enhanced system prompt with workspace context
 */
export async function generateWorkspaceAwarePrompt(
  basePrompt: string,
  workspace: DetectedWorkspace
): Promise<string> {
  const parts: string[] = []

  // Add workspace identity header
  if (workspace.identity) {
    parts.push("# Workspace Identity")
    parts.push("You are operating in the " + workspace.identity.name + " workspace.")
    
    if (workspace.identity.creature) {
      parts.push("Identity: " + workspace.identity.creature)
    }
    
    if (workspace.identity.vibe) {
      parts.push("Vibe: " + workspace.identity.vibe)
    }
    
    parts.push("")
  }

  // Add the original system prompt if available
  if (workspace.identity?.systemPrompt) {
    parts.push("# Base Identity")
    parts.push(workspace.identity.systemPrompt)
    parts.push("")
  }

  // Add the agent-specific prompt
  if (basePrompt) {
    parts.push("# Agent Configuration")
    parts.push(basePrompt)
    parts.push("")
  }

  // Add workspace-aware instructions
  parts.push("# Workspace Context")
  parts.push("This agent has access to the following workspace layers:")
  
  if (workspace.type === "a2r") {
    parts.push("- L1-COGNITIVE: Task graph, memory, state")
    parts.push("- L2-IDENTITY: Identity, conventions, values")
    parts.push("- L3-GOVERNANCE: Rules, playbooks, tools")
    parts.push("- L4-SKILLS: Skill definitions")
    parts.push("- L5-BUSINESS: Client/project context (if enabled)")
  } else if (workspace.type === "openclaw") {
    parts.push("- workspace/agents/: Agent configurations")
    parts.push("- workspace/docs/: Identity and soul documents")
    parts.push("- workspace/memory/: Persistent memory")
    parts.push("- workspace/skills/: Skill definitions")
  }

  parts.push("")
  parts.push("Workspace path: " + workspace.path)

  return parts.join("\n")
}

/**
 * Get list of available agents from workspace
 */
export async function getWorkspaceAgents(
  workspacePath: string,
  type: "a2r" | "openclaw"
): Promise<Array<{ name: string; path: string; config?: any }>> {
  const agents: Array<{ name: string; path: string; config?: any }> = []

  if (type === "openclaw") {
    const agentsPath = path.join(workspacePath, "workspace", "agents")
    if (!(await Filesystem.exists(agentsPath))) return agents

    try {
      const entries = await fs.readdir(agentsPath, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = path.join(agentsPath, entry.name, "config.json")
          const config = await Filesystem.readText(configPath)
            .then((c: string) => JSON.parse(c))
            .catch(() => undefined)
          
          agents.push({
            name: config?.name || entry.name,
            path: path.join(agentsPath, entry.name),
            config,
          })
        }
      }
    } catch {
      // Ignore errors
    }
  }

  // A2R agents are stored differently - as part of the workspace config
  if (type === "a2r") {
    // A2R agents would be defined in L4-SKILLS or through the manifest
    // For now, we return an empty list
  }

  return agents
}
