// @ts-nocheck
import type { Command } from '../../commands'

const cd = {
  type: 'local',
  name: 'cd',
  description:
    'Change the working directory for tool execution (does not move the transcript)',
  argumentHint: '<path>',
  supportsNonInteractive: false,
  load: () => import('./cd.js'),
} satisfies Command

export default cd
