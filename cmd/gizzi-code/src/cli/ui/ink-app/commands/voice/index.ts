import type { Command } from '../../commands'

const voice = {
  type: 'local',
  name: 'voice',
  aliases: ['dictation'],
  description: 'Toggle local voice dictation (hold Ctrl+Space or F8 to talk)',
  supportsNonInteractive: true,
  load: () => import('./voice.js'),
} satisfies Command

export default voice
