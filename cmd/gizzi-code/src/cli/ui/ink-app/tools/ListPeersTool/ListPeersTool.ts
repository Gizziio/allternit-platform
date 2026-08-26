// @ts-nocheck
import { feature } from 'bun:bundle'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { errorMessage } from '../../utils/errors.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { jsonStringify } from '../../utils/slowOperations.js'
import { DESCRIPTION, LIST_PEERS_TOOL_NAME, PROMPT } from './prompt.js'
import { renderToolResultMessage, renderToolUseMessage } from './UI.js'

const RAILS_BASE = process.env.GIZZI_RAILS_URL ?? 'http://127.0.0.1:8013/api/rails'

const inputSchema = lazySchema(() =>
  z.object({}).describe('No input required'),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.array(
    z.object({
      peer_id: z.string(),
      display_name: z.string(),
      address: z.string(),
      kind: z.string(),
      cwd: z.string(),
    }),
  ),
)
type OutputSchema = ReturnType<typeof outputSchema>

export type Output = z.infer<OutputSchema>

type RailsPeerAddress =
  | { type: 'uds'; socket_path?: string }
  | { type: 'bridge'; endpoint?: string }
  | { type: string }

type RailsPeer = {
  peer_id: string
  display_name: string
  address: RailsPeerAddress
  kind: string
  cwd: string
}

export const ListPeersTool = buildTool({
  name: LIST_PEERS_TOOL_NAME,
  searchHint: 'list discoverable agent peers',
  maxResultSizeChars: 100_000,
  isReadOnly() {
    return true
  },
  isConcurrencySafe() {
    return true
  },
  shouldDefer: true,
  isEnabled() {
    return feature('UDS_INBOX')
  },
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  toAutoClassifierInput() {
    return 'list peers'
  },
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return PROMPT
  },
  async call() {
    const signal = AbortSignal.timeout(8_000)
    const response = await fetch(`${RAILS_BASE}/v1/peers`, { signal })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `ListPeers failed: ${response.status} ${response.statusText}${text ? ` — ${text}` : ''}`,
      )
    }
    const data = (await response.json()) as { peers?: RailsPeer[] }
    const peers = (data.peers ?? []).map(peer => ({
      peer_id: peer.peer_id,
      display_name: peer.display_name,
      address: formatAddress(peer.address),
      kind: peer.kind,
      cwd: peer.cwd,
    }))
    return { data: peers }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result' as const,
      content: jsonStringify(content),
    }
  },
  renderToolUseMessage,
  renderToolResultMessage,
} satisfies ToolDef<InputSchema, Output>)

function formatAddress(address: RailsPeerAddress): string {
  if (address.type === 'uds' && 'socket_path' in address && address.socket_path) {
    return `uds:${address.socket_path}`
  }
  if (address.type === 'bridge' && 'endpoint' in address && address.endpoint) {
    return `bridge:${address.endpoint}`
  }
  return `${address.type}:unknown`
}
