/**
 * Workspace Context for Sessions
 * 
 * Provides workspace-aware system prompt injection for sessions.
 * Caches workspace detection results to avoid repeated filesystem checks.
 */

import * as AgentWorkspaceBridge from "./bridge"

// Cache workspace detection results by directory
const workspaceCache = new Map<string, AgentWorkspaceBridge.DetectedWorkspace | null>()

/**
 * Get workspace context for a directory (cached)
 */
export async function getWorkspaceContext(
  directory: string
): Promise<AgentWorkspaceBridge.DetectedWorkspace | null> {
  // Check cache first
  const cached = workspaceCache.get(directory)
  if (cached !== undefined) {
    return cached
  }

  // Detect workspace
  const workspace = await AgentWorkspaceBridge.detectWorkspace(directory)
  
  // Cache result (even if null)
  workspaceCache.set(directory, workspace)
  
  return workspace
}

/**
 * Get workspace system prompt for a directory
 * Returns empty string if no workspace detected
 */
export async function getWorkspaceSystemPrompt(directory: string): Promise<string> {
  const workspace = await getWorkspaceContext(directory)
  
  if (!workspace) {
    return ""
  }

  // Build workspace context prompt
  const parts: string[] = []
  parts.push("# Workspace Context")
  
  if (workspace.identity) {
    parts.push(`You are operating in the ${workspace.identity.name} workspace.`)
    
    if (workspace.identity.creature) {
      parts.push(`Identity: ${workspace.identity.creature}`)
    }
    
    if (workspace.identity.vibe) {
      parts.push(`Vibe: ${workspace.identity.vibe}`)
    }
    
    if (workspace.identity.systemPrompt) {
      parts.push("")
      parts.push("## Base Identity")
      parts.push(workspace.identity.systemPrompt)
    }
  }
  
  parts.push("")
  parts.push("## Workspace Layers")
  
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
  parts.push(`Workspace path: ${workspace.path}`)
  
  return parts.join("\n")
}

/**
 * Clear workspace cache for a directory (useful when workspace files change)
 */
export function clearWorkspaceCache(directory?: string): void {
  if (directory) {
    workspaceCache.delete(directory)
  } else {
    workspaceCache.clear()
  }
}
