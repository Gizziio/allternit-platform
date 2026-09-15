// @ts-nocheck
import type { Command } from '../../commands'

const rename = {
  type: 'local-jsx',
  name: 'rename',
  aliases: ['title'],
  description: 'Rename the current conversation',
  immediate: true,
  argumentHint: '[name]',
  load: () => import('./rename.js'),
} satisfies Command
export default rename
