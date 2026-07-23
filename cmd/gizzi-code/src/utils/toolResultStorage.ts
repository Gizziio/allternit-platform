/**
 * Tool Result Storage
 */

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

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { PERSISTED_OUTPUT_CLOSING_TAG, PERSISTED_OUTPUT_TAG, PREVIEW_SIZE_BYTES, TOOL_RESULTS_SUBDIR, TOOL_RESULT_CLEARED_MESSAGE, applyToolResultBudget, buildLargeToolResultMessage, cloneContentReplacementState, createContentReplacementState, enforceToolResultBudget, ensureToolResultsDir, generatePreview, getPerMessageBudgetLimit, getPersistenceThreshold, getToolResultPath, getToolResultsDir, isPersistError, isToolResultContentEmpty, persistToolResult, processPreMappedToolResultBlock, processToolResultBlock, provisionContentReplacementState, reconstructContentReplacementState, reconstructForSubagentResume } from "../shared/utils/toolResultStorage.js";
export type { ContentReplacementRecord, ContentReplacementState, PersistToolResultError, PersistedToolResult, ToolResultReplacementRecord } from "../shared/utils/toolResultStorage.js";
