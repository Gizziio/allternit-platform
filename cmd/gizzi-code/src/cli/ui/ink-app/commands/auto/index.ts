// @ts-nocheck
import { feature } from 'bun:bundle'
import type { Command } from '../../commands'

// feature() from bun:bundle may only appear directly in an if/ternary — the
// bundler rewrites it at compile time — so evaluate once via a ternary.
const transcriptClassifierEnabled = feature('TRANSCRIPT_CLASSIFIER')
  ? true
  : false

const auto = {
  type: 'local-jsx',
  name: 'auto',
  description:
    'Let the classifier approve safe tools. Run again to return to ask-before-acting.',
  immediate: true,
  isEnabled: () => transcriptClassifierEnabled,
  get isHidden() {
    return !transcriptClassifierEnabled
  },
  load: () => import('./auto.js'),
} satisfies Command

export default auto
