// @ts-nocheck
import type { Command } from '../../commands'

const native = {
  type: 'local',
  name: 'native',
  description: 'List or pick up a native CLI session (Claude, Codex, Grok, Kimi, …) into Gizzi',
  aliases: ['cli-session'],
  argumentHint: '[list|pickup <harness> <id>|fetch|export [ses_id] [harness]]',
  supportsNonInteractive: true,
  load: () => import('./native.js'),
} satisfies Command
export default native
