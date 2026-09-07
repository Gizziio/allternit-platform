// @ts-nocheck
import type { Command } from '../../commands'

const dash = {
  type: 'local',
  name: 'dash',
  // NOTE: 'dashboard' / 'sessions' / 'agents-dashboard' were claimed here by
  // an earlier Grok-slash pass, but they collide with the full-screen agent
  // dashboard (/dashboard, commands/dashboard). This command keeps its own
  // name; the stats screen is reached via /dash.
  description: 'Show a dashboard of current session status, model, context, and usage',
  supportsNonInteractive: true,
  load: () => import('./dash.js'),
} satisfies Command

export default dash
