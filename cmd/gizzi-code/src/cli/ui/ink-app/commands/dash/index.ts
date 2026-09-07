// @ts-nocheck
import type { Command } from '../../commands'

const dash = {
  type: 'local',
  name: 'dash',
  aliases: ['dashboard', 'sessions', 'agents-dashboard'],
  description: 'Show a dashboard of current session status, model, context, and usage',
  supportsNonInteractive: true,
  load: () => import('./dash.js'),
} satisfies Command

export default dash
