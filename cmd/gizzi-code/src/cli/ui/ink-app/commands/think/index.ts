// @ts-nocheck
import type { Command } from '../../commands'

const think = {
  type: 'local-jsx',
  name: 'think',
  aliases: ['thinking', 'ultrathink'],
  description: 'Control extended thinking mode',
  argumentHint: '[on|off|hard|status]',
  load: () => import('./think.js'),
} satisfies Command
export default think
