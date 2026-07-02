/**
 * Tool Result Storage
 */

export type { ContentReplacementRecord } from '../shared/utils/toolResultStorage.js'

export interface ToolResultEntry {
  tool: string
  result: unknown
  timestamp: number
}

export async function storeToolResult(entry: ToolResultEntry): Promise<void> {
  // Implementation
}

export async function getToolResults(tool: string): Promise<ToolResultEntry[]> {
  return []
}
