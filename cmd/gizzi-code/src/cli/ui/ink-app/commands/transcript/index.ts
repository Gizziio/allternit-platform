// @ts-nocheck
import type { Command } from '../../commands'

const transcript = {
  type: 'local',
  name: 'transcript',
  description: 'Open this session\'s transcript file in your pager ($PAGER, less -R, or more)',
  supportsNonInteractive: false,
  load: () => import('./transcript.js'),
} satisfies Command

export default transcript
