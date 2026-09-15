// @ts-nocheck
import type { Command } from '../../commands'

const theme = {
  type: 'local-jsx',
  name: 'theme',
  aliases: ['t'],
  description: 'Change the theme',
  load: () => import('./theme.js'),
} satisfies Command
export default theme
