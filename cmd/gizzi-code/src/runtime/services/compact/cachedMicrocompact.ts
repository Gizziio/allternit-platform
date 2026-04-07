/**
 * Cached microcompact
 * TEMPORARY SHIM
 */

import type { Message } from '@/types/message.js'

export interface CachedCompact {
  messages: Message[]
  hash: string
  timestamp: number
}

export interface CachedMCState {
  messages: Message[]
  hash: string
  timestamp: number
  toolsSent: Set<string>
  pinnedEdits?: PinnedCacheEdits[]
  registeredTools?: Map<string, unknown>
  registerToolMessage?: (msg: Message) => void
  // Additional properties used by microCompact
  toolOrder?: string[]
  deletedRefs?: Set<string>
  [key: string]: unknown
}

export interface CacheEditsBlock {
  type: 'cache_edits'
  edits: Array<{
    type: 'add' | 'remove' | 'replace'
    content: string
  }>
}

export interface PinnedCacheEdits {
  userMessageIndex: number
  block: CacheEditsBlock
}

export function getCachedMicrocompact(messages: Message[]): CachedCompact | null {
  return null
}

export function setCachedMicrocompact(messages: Message[], compact: CachedCompact): void {
  // Placeholder
}

export function isCachedMicrocompactEnabled(): boolean {
  return false
}

export function isModelSupportedForCacheEditing(model: string): boolean {
  return false
}

// Cached MC config
export function getCachedMCConfig(): { enabled: boolean; model: string; triggerThreshold?: number; keepRecent?: number } {
  return { enabled: false, model: '', triggerThreshold: 0, keepRecent: 0 }
}

// Placeholder functions
export function createCachedMCState(messages?: Message[]): CachedMCState {
  return {
    messages: messages || [],
    hash: '',
    timestamp: Date.now(),
    toolsSent: new Set(),
    pinnedEdits: [],
    registeredTools: new Map(),
  }
}

export function markToolsSentToAPI(state?: CachedMCState, toolNames?: string[]): void {
  // Placeholder
}

export function resetCachedMCState(arg?: { preserveMessages?: boolean }): void {
  // Placeholder
}

export function registerToolResult(state: CachedMCState, toolUseId: string, result: unknown): void {
  // Placeholder
}

export function registerToolMessage(toolMessage: Message): void {
  // Placeholder
}

export function getToolResultsToDelete(state?: CachedMCState): string[] {
  return []
}

export function createCacheEditsBlock(state?: CachedMCState, toolsToDelete?: string[]): CacheEditsBlock | null {
  return { type: 'cache_edits', edits: [] }
}

export const CACHE_EDITING_BETA_HEADER = 'claude-beta-cache-editing'

export default { 
  getCachedMicrocompact, 
  setCachedMicrocompact, 
  isCachedMicrocompactEnabled, 
  isModelSupportedForCacheEditing, 
  getCachedMCConfig,
  createCachedMCState,
  markToolsSentToAPI,
  resetCachedMCState,
  registerToolResult,
  registerToolMessage,
  getToolResultsToDelete,
  createCacheEditsBlock,
}
