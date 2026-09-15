// @ts-nocheck
import type { Command } from '../../commands'

const releaseNotes: Command = {
  description: 'View release notes',
  name: 'release-notes',
  aliases: ['changelog'],
  type: 'local',
  supportsNonInteractive: true,
  load: () => import('./release-notes.js'),
}
export default releaseNotes
