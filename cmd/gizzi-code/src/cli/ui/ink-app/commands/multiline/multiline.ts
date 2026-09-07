// @ts-nocheck
import type { LocalCommandCall } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

export const call: LocalCommandCall = async () => {
  const config = getGlobalConfig()
  const next = !config.multilineEnter

  saveGlobalConfig(current => ({
    ...current,
    multilineEnter: next,
  }))

  return {
    type: 'text',
    value: `Multiline Enter ${next ? 'on' : 'off'}. ${
      next
        ? 'Plain Enter now inserts a newline; use Shift+Enter or Cmd+Enter to submit.'
        : 'Plain Enter submits again; use Shift+Enter for a newline.'
    }`,
  }
}
