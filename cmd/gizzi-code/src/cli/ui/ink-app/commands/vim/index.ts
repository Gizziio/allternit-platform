// @ts-nocheck
import type { Command } from '../../commands'

const command = {
  name: 'vim',
  aliases: ['vim-mode'],
  description: 'Toggle between Vim and Normal editing modes',
  supportsNonInteractive: false,
  type: 'local',
  load: () => import('./vim.js'),
} satisfies Command
export default command
