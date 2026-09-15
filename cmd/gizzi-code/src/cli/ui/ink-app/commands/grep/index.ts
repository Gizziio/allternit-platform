// @ts-nocheck
import type { Command } from '../../commands'

export default {
  type: 'local-jsx',
  name: 'grep',
  description: 'Interactively search code content across files (ripgrep)',
  immediate: true,
  load: () => import('./grep.js'),
} satisfies Command
