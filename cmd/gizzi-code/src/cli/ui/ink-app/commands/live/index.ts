// @ts-nocheck
import type { Command } from '../../commands'

export default {
  type: 'local',
  name: 'live',
  description: 'Show live session metrics (model, context, cost)',
  supportsNonInteractive: true,
  load: () => import('./live.js'),
} satisfies Command
