/**
 * Snip compact utility
 * TEMPORARY SHIM
 */

import type { Message } from '../../types/message.js'

export interface SnipBoundary {
  start: number
  end: number
  summary: string
}

export interface SnipProjection {
  id: string
  range: [number, number]
  count: number
  summary?: string
}

export const SNIP_NUDGE_TEXT =
  'History snip is enabled. Older messages have been summarized to save context space.'

export const ERROR_MESSAGE_USER_ABORT = 'API Error: Request was aborted.'

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export function isSnipMarkerMessage(message: Message): boolean {
  return false
}

export function snipCompactIfNeeded(messages: Message[]): Message[] {
  return messages
}

export function identifySnipBoundaries(messages: Message[]): SnipBoundary[] {
  const boundaries: SnipBoundary[] = []
  // Implementation placeholder
  return boundaries
}

export function projectMessagesWithSnips(
  messages: Message[],
  snipRanges: Array<[number, number]>,
): unknown[] {
  return messages.map((m, i) => ({ type: 'message', index: i, data: m }))
}

export default { identifySnipBoundaries, projectMessagesWithSnips, isSnipRuntimeEnabled, isSnipMarkerMessage, snipCompactIfNeeded }
