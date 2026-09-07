// @ts-nocheck
import type { Command } from '../../commands'

const queue = {
  type: 'local',
  name: 'queue',
  description: 'Show the pending command queue (read-only)',
  immediate: true,
  supportsNonInteractive: true,
  load: () => import('./queue.js'),
} satisfies Command

export default queue
