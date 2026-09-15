// @ts-nocheck
import type { Command } from '../../commands'

const multiline = {
  name: 'multiline',
  aliases: ['ml'],
  description:
    'Toggle multiline Enter: when on, plain Enter inserts a newline and Shift/Cmd+Enter submits',
  supportsNonInteractive: false,
  type: 'local',
  load: () => import('./multiline.js'),
} satisfies Command

export default multiline
