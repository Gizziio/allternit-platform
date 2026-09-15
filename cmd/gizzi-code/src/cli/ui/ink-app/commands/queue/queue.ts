// @ts-nocheck
import type { LocalCommandCall } from '../../types/command.js'
import { getCommandQueueSnapshot } from '../../utils/messageQueueManager.js'
import { extractTextContent } from '../../utils/messages.js'

const PREVIEW_LENGTH = 60

export const call: LocalCommandCall = async () => {
  const snapshot = getCommandQueueSnapshot()
  if (snapshot.length === 0) {
    return { type: 'text', value: 'Queue is empty.' }
  }

  const lines = snapshot.map((command, index) => {
    const raw =
      typeof command.value === 'string'
        ? command.value
        : extractTextContent(command.value, ' ')
    const preview =
      raw.length > PREVIEW_LENGTH ? `${raw.slice(0, PREVIEW_LENGTH)}…` : raw
    return `${index + 1}. [${command.mode}] (priority: ${command.priority ?? 'default'}) ${preview}`
  })

  return { type: 'text', value: lines.join('\n') }
}
