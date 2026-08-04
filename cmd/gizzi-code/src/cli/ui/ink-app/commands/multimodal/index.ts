// @ts-nocheck
import type { Command } from '../../commands.js'

const multimodal = {
  type: 'local-jsx',
  name: 'multimodal',
  aliases: ['mm'],
  description: 'Connect to the multimodal WebSocket stream and monitor connection health',
  load: () => import('./multimodal.js'),
} satisfies Command

export default multimodal
