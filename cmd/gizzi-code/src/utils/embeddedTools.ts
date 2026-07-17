/**
 * Embedded Tools Utilities
 */

export interface EmbeddedTool {
  name: string
  code: string
}

export function getEmbeddedTools(): EmbeddedTool[] {
  return []
}

/** Whether embedded search tools are available in this build. */
export function hasEmbeddedSearchTools(): boolean {
  return false
}
