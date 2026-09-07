// @ts-nocheck
import { feature } from 'bun:bundle'
import type { Command } from '../../commands'

const auto = {
  type: 'local-jsx',
  name: 'auto',
  description:
    'Let the classifier approve safe tools. Run again to return to ask-before-acting.',
  immediate: true,
  isEnabled: () => feature('TRANSCRIPT_CLASSIFIER'),
  get isHidden() {
    return !feature('TRANSCRIPT_CLASSIFIER')
  },
  load: () => import('./auto.js'),
} satisfies Command

export default auto
