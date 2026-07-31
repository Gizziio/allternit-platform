// @ts-nocheck
import type { Command } from '../../../commands'

const stats = {
  type: 'local-jsx',
  name: 'stats',
  description: 'Show your Gizzi Code usage statistics and activity',
  load: () => import('./stats.js'),
} satisfies Command
export default stats
