// @ts-nocheck
import type { Command } from '../../../commands'

const stickers = {
  type: 'local',
  name: 'stickers',
  description: 'Order Gizzi Code stickers',
  supportsNonInteractive: false,
  load: () => import('./stickers.js'),
} satisfies Command
export default stickers
