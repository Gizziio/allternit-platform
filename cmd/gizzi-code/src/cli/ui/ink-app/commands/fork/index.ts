// @ts-nocheck
import type { Command } from '../../commands'

const fork = {
  type: 'local-jsx',
  name: 'fork',
  description:
    'Branch this session into a background peer agent that inherits the full conversation',
  argumentHint: '[--worktree|--no-worktree] [directive]',
  immediate: true,
  load: () => import('./fork.js'),
} satisfies Command

export default fork
