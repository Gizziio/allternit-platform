// @ts-nocheck
import type { Command } from '../../commands'

const help = {
  type: 'local-jsx',
  name: 'help',
  aliases: ['docs', 'howto', 'guides', 'tutorial', 'tour'],
  description: 'Show help and available commands',
  load: () => import('./help.js'),
} satisfies Command
export default help
