// @ts-nocheck
import type { Command } from '../../commands'

const status = {
  type: 'local-jsx',
  name: 'status',
  aliases: ['info', 'session-info'],
  description:
    'Show Gizzi Code status including version, model, account, API connectivity, and tool statuses',
  immediate: true,
  load: () => import('./status.js'),
} satisfies Command
export default status
