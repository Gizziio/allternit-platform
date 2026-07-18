// @ts-nocheck
import type { Command } from '../../../commands'

const ide = {
  type: 'local-jsx',
  name: 'ide',
  description: 'Manage IDE integrations and show status',
  argumentHint: '[open]',
  load: () => import('../../../commands/ide/ide.js'),
} satisfies Command
export default ide
