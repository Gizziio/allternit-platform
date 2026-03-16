/**
 * Workspace Context for Sessions
 *
 * Injects workspace identity (SOUL.md, IDENTITY.md, USER.md, MEMORY.md, AGENTS.md)
 * into session system prompts. Caches workspace detection per directory.
 */

import * as Bridge from "@/runtime/kernel/bridge"

// Cache by directory. Cleared when workspace files change.
const workspaceCache = new Map<string, Bridge.DetectedWorkspace | null>()

/**
 * Get workspace context for a directory (cached).
 */
export async function getWorkspaceContext(
  directory: string,
): Promise<Bridge.DetectedWorkspace | null> {
  if (workspaceCache.has(directory)) return workspaceCache.get(directory) ?? null
  const workspace = await Bridge.detectWorkspace(directory)
  workspaceCache.set(directory, workspace)
  return workspace
}

/**
 * Build and return the workspace system prompt for a directory.
 * Returns empty string if no workspace detected or workspace has no content.
 */
export async function getWorkspaceSystemPrompt(directory: string): Promise<string> {
  const workspace = await getWorkspaceContext(directory)
  if (!workspace?.identity) return ""
  return Bridge.buildWorkspaceSystemPrompt(workspace.identity)
}

/**
 * Invalidate the cache for a directory (call when workspace files change).
 */
export function clearWorkspaceCache(directory?: string): void {
  if (directory) {
    workspaceCache.delete(directory)
  } else {
    workspaceCache.clear()
  }
}
