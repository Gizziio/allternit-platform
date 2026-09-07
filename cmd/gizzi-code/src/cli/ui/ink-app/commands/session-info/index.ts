// @ts-nocheck
import type { Command } from '../../commands'

const sessionInfo = {
  type: 'local-jsx',
  name: 'session-info',
  description:
    'Show a compact panel with model, directory, session id, and context usage. Press c to copy the session id.',
  immediate: true,
  load: () => import('./session-info.js'),
} satisfies Command

export default sessionInfo
