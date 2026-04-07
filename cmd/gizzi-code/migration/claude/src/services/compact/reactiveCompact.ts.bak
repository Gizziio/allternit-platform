/**
 * Reactive Compact Service
 * Handles dynamic compaction based on prompt size and errors
 */

import type { Message } from '../../types/message.js'

export interface ReactiveCompactOptions {
  messages: Message[]
  toolUseResult?: unknown
  force?: boolean
}

export interface ReactiveCompactResult {
  success: boolean
  messages?: Message[]
  compacted?: boolean
  removedCount?: number
}

export interface CompactOutcome {
  type: 'success' | 'skipped' | 'error'
  ok?: boolean
  messages?: Message[]
  result?: Message[]
  reason?: string
}

/**
 * Check if reactive compact is enabled
 */
export function isReactiveCompactEnabled(): boolean {
  return false // Placeholder - implement based on feature flags
}

/**
 * Check if we're in reactive-only mode
 */
export function isReactiveOnlyMode(): boolean {
  return false // Placeholder
}

/**
 * Check if the withheld prompt is too long (413 error)
 */
export function isWithheldPromptTooLong(message?: Message | string): boolean {
  if (!message) return false
  const content = typeof message === 'string' ? message : message.content
  return typeof content === 'string' && content.includes('413')
}

/**
 * Check if the withheld error is a media size error
 */
export function isWithheldMediaSizeError(message?: Message | string): boolean {
  if (!message) return false
  const content = typeof message === 'string' ? message : message.content
  return typeof content === 'string' && 
    (content.includes('media') || content.includes('size') || content.includes('too large'))
}

/**
 * Try reactive compact on the given messages
 */
export async function tryReactiveCompact(
  options: ReactiveCompactOptions
): Promise<ReactiveCompactResult> {
  // Placeholder implementation
  return {
    success: false,
    compacted: false,
  }
}

/**
 * Reactive compact on prompt too long error
 */
export async function reactiveCompactOnPromptTooLong(
  messages: Message[],
  toolUseResult?: unknown,
  options?: { customInstructions?: string; trigger?: string }
): Promise<CompactOutcome> {
  // Placeholder implementation
  return {
    type: 'skipped',
    reason: 'Not implemented',
  }
}

// Default export for compatibility
export default {
  isReactiveCompactEnabled,
  isReactiveOnlyMode,
  isWithheldPromptTooLong,
  isWithheldMediaSizeError,
  tryReactiveCompact,
  reactiveCompactOnPromptTooLong,
}
