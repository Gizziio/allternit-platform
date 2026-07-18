// @ts-nocheck
import type { Command } from '../../../commands'
import {
  FAST_MODE_MODEL_DISPLAY,
  isFastModeEnabled,
} from '../../../../../../shared/utils/fastMode'
import { shouldInferenceConfigCommandBeImmediate } from '../../../../../../shared/utils/immediateCommand'

const fast = {
  type: 'local-jsx',
  name: 'fast',
  get description() {
    return `Toggle fast mode (${FAST_MODE_MODEL_DISPLAY} only)`
  },
  availability: ['claude-ai', 'console'],
  isEnabled: () => isFastModeEnabled(),
  get isHidden() {
    return !isFastModeEnabled()
  },
  argumentHint: '[on|off]',
  get immediate() {
    return shouldInferenceConfigCommandBeImmediate()
  },
  load: () => import('./fast.js'),
} satisfies Command

export default fast
