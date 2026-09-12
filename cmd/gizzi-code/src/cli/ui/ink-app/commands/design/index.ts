// @ts-nocheck
import type { Command } from '../../commands'

function isSupportedPlatform(): boolean {
  if (process.platform === 'darwin') {
    return true
  }
  if (process.platform === 'win32' && process.arch === 'x64') {
    return true
  }
  return false
}

const design = {
  type: 'local-jsx',
  name: 'design',
  aliases: ['studio'],
  description: 'Open A:// Studio (Design mode) in Allternit Desktop, optionally with a prompt',
  isEnabled: isSupportedPlatform,
  get isHidden() {
    return !isSupportedPlatform()
  },
  load: () => import('./design.js'),
} satisfies Command

export default design
