// @ts-nocheck
import { feature } from 'bun:bundle'
import { isBridgeEnabled } from '../../../../../../runtime/integrations/bridgeEnabled'
import type { Command } from '../../../commands'

function isEnabled(): boolean {
  if (!feature('BRIDGE_MODE')) {
    return false
  }
  return isBridgeEnabled()
}
const bridge = {
  type: 'local-jsx',
  name: 'remote-control',
  aliases: ['rc'],
  description: 'Connect this terminal for remote-control sessions',
  argumentHint: '[name]',
  isEnabled,
  get isHidden() {
    return !isEnabled()
  },
  immediate: true,
  load: () => import('../../../commands/bridge/bridge.js'),
} satisfies Command
export default bridge
