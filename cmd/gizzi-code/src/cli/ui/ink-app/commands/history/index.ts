// @ts-nocheck
import type { Command } from '../../commands'

const history = {
  type: 'local-jsx',
  name: 'history',
  description: 'Fuzzy-search previous prompts and drop one back into the composer',
  immediate: true,
  load: () => import('./history.js'),
} satisfies Command

export default history
