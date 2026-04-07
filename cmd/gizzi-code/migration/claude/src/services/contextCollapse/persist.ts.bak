/**
 * Context collapse persistence
 * TEMPORARY SHIM
 */

import type { Message } from '../../types/message.js'

export interface PersistedContext {
  messages: Message[]
  timestamp: number
  version: string
}

export async function persistContext(context: PersistedContext): Promise<void> {
  // Placeholder
}

export async function loadPersistedContext(): Promise<PersistedContext | null> {
  return null
}

// Restore context from entries (for session resume)
export async function restoreFromEntries(entries: unknown[], _snapshot?: unknown): Promise<Message[]> {
  return []
}

export default { persistContext, loadPersistedContext, restoreFromEntries }
