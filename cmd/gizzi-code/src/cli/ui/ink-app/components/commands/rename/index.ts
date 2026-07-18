// @ts-nocheck
import type { Command } from '../../../commands'

const rename = {
  type: 'local-jsx',
  name: 'rename',
  description: 'Rename the current conversation',
  immediate: true,
  argumentHint: '[name]',
  load: () => import('../../../commands/rename/rename.js'),
} satisfies Command
export default rename
