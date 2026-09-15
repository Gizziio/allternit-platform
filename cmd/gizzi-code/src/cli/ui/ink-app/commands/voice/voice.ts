import type { LocalCommandCall } from '../../types/command.js'
import { isLocalVoiceAvailable } from '../../services/localVoiceSTT.js'
import { settingsChangeDetector } from '../../utils/settings/changeDetector.js'
import {
  getInitialSettings,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'

export const call: LocalCommandCall = async () => {
  const current = getInitialSettings().voiceEnabled === true
  const next = !current
  const result = updateSettingsForSource('userSettings', {
    voiceEnabled: next,
  })
  if (result.error) {
    return {
      type: 'text',
      value: `Could not update voice setting: ${result.error.message}`,
    }
  }
  settingsChangeDetector.notifyChange('userSettings')

  if (!next) {
    return { type: 'text', value: 'Voice dictation off.' }
  }

  const available = await isLocalVoiceAvailable()
  if (!available) {
    return {
      type: 'text',
      value:
        'Voice dictation on, but the local engine is not ready. Start Allternit Desktop or install whisper.cpp (whisper-cli) and place ggml-tiny.en.bin in ~/.allternit/models/whisper/. Hold Ctrl+Space or F8 to talk once it is available.',
    }
  }
  return {
    type: 'text',
    value:
      'Voice dictation on. Hold Ctrl+Space (or F8) to talk. Speech stays on this machine.',
  }
}
