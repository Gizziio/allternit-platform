// @ts-nocheck
import type { Command } from '../../commands'

const agents = {
  type: 'local-jsx',
  name: 'agents',
  aliases: ['config-agents', 'personas'],
  description: 'Manage agent configurations',
  load: () => import('./agents.js'),
} satisfies Command
export default agents
