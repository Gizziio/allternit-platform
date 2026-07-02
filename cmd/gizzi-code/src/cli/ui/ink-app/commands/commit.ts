// @ts-nocheck
import type { Command } from '../commands'

export default {
  type: 'local-jsx',
  name: 'commit',
  description: 'Create a git commit interactively',
  load: () => import('./commit/commit.js'),
} satisfies Command
