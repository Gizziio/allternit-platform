// @ts-nocheck
import type { Command } from '../../commands'

const remember = {
  type: 'local',
  name: 'remember',
  description: 'Save a note to memory immediately, without waiting for a summary',
  argumentHint: '<note>',
  supportsNonInteractive: true,
  load: () => import('./remember.js'),
} satisfies Command

export default remember
