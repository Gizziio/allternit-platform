// @ts-nocheck
import type { LocalCommandCall } from '../../types/command.js'
import { getGlobalConfig, saveGlobalConfig } from '../../utils/config.js'

export const call: LocalCommandCall = async () => {
  const config = getGlobalConfig()
  const next = !config.showMessageTimestamps
  saveGlobalConfig(current => ({
    ...current,
    showMessageTimestamps: next,
  }))
  return {
    type: 'text',
    value: next
      ? 'Message timestamps on.'
      : 'Message timestamps off.',
  }
}
