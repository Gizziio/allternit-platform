/**
 * Assistant module
 * Handles assistant mode and session management
 */

import type { Message } from '../types/message.js'

export interface AssistantSession {
  id: string
  status: 'idle' | 'active' | 'paused'
  messages: Message[]
  createdAt: number
  metadata?: Record<string, unknown>
}

// Session storage
const sessions = new Map<string, AssistantSession>()

/**
 * Check if assistant mode is active
 */
export function isAssistantMode(): boolean {
  return process.env.CLAUDE_ASSISTANT_MODE === 'true'
}

/**
 * Create a new assistant session
 */
export async function createAssistantSession(
  metadata?: Record<string, unknown>
): Promise<AssistantSession> {
  const session: AssistantSession = {
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status: 'idle',
    messages: [],
    createdAt: Date.now(),
    metadata,
  }
  sessions.set(session.id, session)
  return session
}

/**
 * Get an existing assistant session by ID
 */
export function getAssistantSession(id: string): AssistantSession | null {
  return sessions.get(id) ?? null
}

/**
 * Update an assistant session
 */
export function updateAssistantSession(
  id: string,
  updates: Partial<AssistantSession>
): AssistantSession | null {
  const session = sessions.get(id)
  if (!session) return null
  const updated = { ...session, ...updates }
  sessions.set(id, updated)
  return updated
}

/**
 * End an assistant session
 */
export function endAssistantSession(id: string): boolean {
  return sessions.delete(id)
}

/**
 * Get all active assistant sessions
 */
export function getActiveSessions(): AssistantSession[] {
  return Array.from(sessions.values()).filter(s => s.status === 'active')
}

// Default export
export default {
  isAssistantMode,
  createAssistantSession,
  getAssistantSession,
  updateAssistantSession,
  endAssistantSession,
  getActiveSessions,
}

// Re-export from sessionHistory
export {
  HISTORY_PAGE_SIZE,
  fetchLatestEvents,
  fetchOlderEvents,
  createHistoryAuthCtx,
  type HistoryPage,
  type HistoryAuthCtx,
} from './sessionHistory.js'
