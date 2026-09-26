import type { Command } from '../../commands.js'

const artifact = {
  type: 'local-jsx',
  name: 'artifact',
  aliases: ['artifacts'],
  description:
    'Browse generated artifacts (.gizzi/artifacts) with a rendered markdown viewer',
  load: () => import('./artifact.js'),
} satisfies Command

export default artifact
