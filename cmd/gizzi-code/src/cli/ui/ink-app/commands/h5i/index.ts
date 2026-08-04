// @ts-nocheck
import type { Command } from '../../commands'

const h5i: Command = {
  type: 'local',
  name: 'h5i',
  description: 'Human-in-the-Loop Intelligence workspace tools',
  argumentHint: 'audit [--workspace <path>]',
  supportsNonInteractive: true,
  load: () => import('./h5i.js'),
}
export default h5i
