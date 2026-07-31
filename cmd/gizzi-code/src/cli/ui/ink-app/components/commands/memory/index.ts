// @ts-nocheck
import type { Command } from '../../../commands'

const memory: Command = {
  type: 'local-jsx',
  name: 'memory',
  description: 'Edit Gizzi memory files',
  load: () => import('../../../commands/memory/memory.js'),
}
export default memory
