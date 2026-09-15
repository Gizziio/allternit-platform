// @ts-nocheck
import type { Command } from '../../commands'

const memory: Command = {
  type: 'local-jsx',
  name: 'memory',
  aliases: ['mem'],
  description: 'Edit Gizzi memory files',
  argumentHint: '[on|off]',
  load: () => import('./memory.js'),
}
export default memory
