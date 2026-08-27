// @ts-nocheck
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '@/Tool.js'
import { lazySchema } from '../../../shared/utils/lazySchema.js'
import { jsonStringify } from '../../../shared/utils/slowOperations.js'
import {
  getAllternitApiConfig,
  listApiPeers,
  type ApiPeer,
} from '../../services/api/allternitApi.js'
import { LIST_PEERS_TOOL_NAME } from './constants.js'
import { DESCRIPTION, getPrompt } from './prompt.js'

const inputSchema = lazySchema(() =>
  z.strictObject({
    status: z
      .enum(['active', 'idle', 'dead'])
      .optional()
      .describe('Optional filter by peer status'),
    vendor: z
      .string()
      .optional()
      .describe('Optional filter by vendor (e.g. "gizzi", "claude", "kimi")'),
  }),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    peers: z.array(
      z.object({
        peer_id: z.string(),
        name: z.string(),
        cwd: z.string(),
        vendor: z.string(),
        inbox_socket: z.string(),
        status: z.string(),
        registered_at: z.string(),
        last_heartbeat_at: z.string(),
      }),
    ),
    count: z.number(),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

function formatPeer(peer: ApiPeer): string {
  return `${peer.name} (${peer.vendor}, ${peer.status}) — ${peer.cwd}`
}

export const ListPeersTool = buildTool({
  name: LIST_PEERS_TOOL_NAME,
  aliases: ['ListAgents'],
  searchHint: 'list local agent peers for cross-session messaging',
  maxResultSizeChars: 100_000,
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return getPrompt()
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  userFacingName() {
    return 'ListPeers'
  },
  shouldDefer: true,
  isEnabled() {
    return true
  },
  isConcurrencySafe() {
    return true
  },
  isReadOnly() {
    return true
  },
  toAutoClassifierInput(input) {
    return input.vendor ?? input.status ?? 'list peers'
  },
  renderToolUseMessage() {
    return null
  },
  async call({ status, vendor }) {
    const config = getAllternitApiConfig()
    const response = await listApiPeers(config)
    let peers = response.peers
    if (status) {
      peers = peers.filter(p => p.status === status)
    }
    if (vendor) {
      const v = vendor.toLowerCase()
      peers = peers.filter(p => p.vendor.toLowerCase() === v)
    }

    return {
      data: {
        peers,
        count: peers.length,
      },
    }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const { peers, count } = content as Output
    const summary =
      count === 0
        ? 'No local peers found.'
        : `${count} local peer(s):\n${peers.map(formatPeer).join('\n')}`
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: [
        {
          type: 'text',
          text: summary,
        },
      ],
    }
  },
} satisfies ToolDef<InputSchema, Output>)
