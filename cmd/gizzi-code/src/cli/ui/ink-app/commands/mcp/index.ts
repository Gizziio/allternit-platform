// @ts-nocheck
import type { Command } from '../../commands'

const mcp = {
  type: 'local-jsx',
  name: 'mcp',
  aliases: ['mcps'],
  description: 'Manage MCP servers',
  immediate: true,
  argumentHint: '[enable|disable [server-name]]',
  load: () => import('./mcp.js'),
} satisfies Command
export default mcp
