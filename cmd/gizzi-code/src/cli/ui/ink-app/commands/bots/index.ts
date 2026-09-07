// @ts-nocheck
import type { Command } from '../../commands'

const bots = {
  type: 'local-jsx',
  name: 'bots',
  description:
    'Open the bots pane — roster of bot profiles with presence, canonical chats, and unread badges',
  immediate: true,
  load: () => import('./bots.js'),
} satisfies Command
export default bots
