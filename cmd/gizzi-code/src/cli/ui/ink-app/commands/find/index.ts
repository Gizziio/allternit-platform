// @ts-nocheck
import type { Command } from '../../commands'

export default {
  type: 'local-jsx',
  name: 'find',
  description: 'Interactively search for and open files in the repository',
  immediate: true,
  load: () => import('./find.js'),
} satisfies Command
