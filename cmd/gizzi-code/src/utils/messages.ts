/**
 * Message Utilities
 */

import type { Message } from '@/types/message.js'

export function countToolCalls(messages: Message[]): number {
  return messages.reduce((count, m) => {
    if (m.type === 'grouped_tool_use') return count + 1
    const content = m.content
    if (Array.isArray(content)) {
      return (
        count +
        content.filter(
          (c): c is { type: 'tool_use' } =>
            typeof c === 'object' && c !== null && (c as { type?: string }).type === 'tool_use',
        ).length
      )
    }
    return count
  }, 0)
}

export const SYNTHETIC_MESSAGES = {
  compact: 'COMPACT',
} as const
