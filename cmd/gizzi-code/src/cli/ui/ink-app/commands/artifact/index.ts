// @ts-nocheck
import type { Command } from '../../commands.js'

const artifact = {
  type: 'local-jsx',
  name: 'artifact',
  aliases: ['artifacts'],
  description: 'List and read generated workspace markdown artifacts',
  load: () => import('./artifact.js'),
} satisfies Command

export default artifact
