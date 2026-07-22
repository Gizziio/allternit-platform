// @ts-nocheck
import type { Command } from '../../commands'

export default {
  type: 'local',
  name: 'usage',
  description: 'Show token usage, context window, and session cost inline',
  supportsNonInteractive: true,
  load: () => import('./usage.js'),
} satisfies Command
