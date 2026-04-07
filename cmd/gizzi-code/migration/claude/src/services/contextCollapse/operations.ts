/**
 * Context collapse operations
 * TEMPORARY SHIM
 */

import type { Message } from '../../types/message.js'

export interface CollapseOptions {
  maxMessages?: number
  maxTokens?: number
  preserveRecent?: number
}

export interface CollapseResult {
  collapsed: boolean
  messages: Message[]
  removedCount: number
  summary?: string
}

export async function collapseMessages(
  messages: Message[],
  options: CollapseOptions = {}
): Promise<CollapseResult> {
  const { maxMessages = 100 } = options
  
  if (messages.length <= maxMessages) {
    return { collapsed: false, messages, removedCount: 0 }
  }

  const toPreserve = messages.slice(-10)
  const summary = `Previous context: ${messages.length - 10} messages collapsed`
  
  return {
    collapsed: true,
    messages: [
      { type: 'system', content: summary } as Message,
      ...toPreserve
    ],
    removedCount: messages.length - 10,
    summary,
  }
}

export function identifySnipBoundaries(messages: Message[]): Array<[number, number]> {
  return []
}

export function isContextCollapseEnabled(): boolean {
  return false
}

// Project view for context visualization
export function projectView(_view?: unknown): { files: string[]; totalTokens: number } {
  return { files: [], totalTokens: 0 }
}

// Get stats for context collapse
export function getStats(): { 
  messageCount: number; 
  tokenCount: number; 
  collapsedCount: number;
  health?: string;
  collapsedSpans?: number;
  stagedSpans?: number;
} {
  return { messageCount: 0, tokenCount: 0, collapsedCount: 0 }
}

// Subscribe to context collapse events
export function subscribe(_callback: (event: unknown) => void): () => void {
  return () => {}
}

export default { collapseMessages, identifySnipBoundaries, isContextCollapseEnabled, projectView, getStats, subscribe }
