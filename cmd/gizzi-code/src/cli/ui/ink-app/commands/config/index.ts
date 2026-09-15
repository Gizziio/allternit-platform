// @ts-nocheck
import type { Command } from '../../commands'

const config = {
  aliases: ['settings', 'preferences', 'prefs'],
  type: 'local-jsx',
  name: 'config',
  description: 'Open config panel',
  load: () => import('./config.js'),
} satisfies Command
export default config
