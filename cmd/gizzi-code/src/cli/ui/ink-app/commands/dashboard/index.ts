// @ts-nocheck
import type { Command } from '../../commands'

const dashboard = {
  type: 'local-jsx',
  name: 'dashboard',
  aliases: ['agents-dashboard', 'sessions'],
  description: 'Open the agent dashboard — live roster of top-level sessions',
  immediate: true,
  load: () => import('./dashboard.js'),
} satisfies Command
export default dashboard
