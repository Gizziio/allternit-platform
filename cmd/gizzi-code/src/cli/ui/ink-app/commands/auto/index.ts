// @ts-nocheck
import { feature } from 'bun:bundle'
import type { Command } from '../../commands'

// feature() is a compile-time macro: it may only appear directly in an if
// statement or ternary condition, so resolve it once at module scope.
let transcriptClassifier = false
if (feature('TRANSCRIPT_CLASSIFIER')) {
  transcriptClassifier = true
}

const auto = {
  type: 'local-jsx',
  name: 'auto',
  description:
    'Let the classifier approve safe tools. Run again to return to ask-before-acting.',
  immediate: true,
  isEnabled: () => transcriptClassifier,
  get isHidden() {
    return !transcriptClassifier
  },
  load: () => import('./auto.js'),
} satisfies Command

export default auto
