// @ts-nocheck
import type { Command } from '../../commands'

const memorySearch: Command = {
  type: 'local-jsx',
  name: 'memory-search',
  description: 'Search the current session memory',
  load: () => import('./memory-search.js'),
}
export default memorySearch
