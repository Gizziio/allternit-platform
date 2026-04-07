/**
 * Snip projection utility
 * TEMPORARY SHIM
 */

import type { Message } from '@/types/message.js'

export interface SnipViewOptions {
  includeSnipped?: boolean
}

export function projectSnippedView(
  messages: Message[],
  options?: SnipViewOptions,
): Message[] {
  if (options?.includeSnipped) {
    return messages
  }
  // Filter out snipped messages (placeholder implementation)
  return messages.filter(m => {
    // Keep all messages for now (placeholder)
    return true
  })
}

export function isSnipBoundaryMessage(message: Message): boolean {
  return false
}

export default { projectSnippedView, isSnipBoundaryMessage }
