// @ts-nocheck
import type { Command } from '../../commands'

const timestamps = {
  type: 'local',
  name: 'timestamps',
  description: 'Toggle message timestamps on or off',
  supportsNonInteractive: true,
  load: () => import('./timestamps.js'),
} satisfies Command

export default timestamps
