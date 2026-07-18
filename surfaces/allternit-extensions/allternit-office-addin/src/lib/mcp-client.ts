/**
 * MCP Client — JSON-RPC 2.0 bridge to the officecli MCP server via the gateway.
 *
 * The gateway (POST /api/v1/office/cli/mcp) spawns one officecli MCP stdio
 * server per user and passes envelopes through. The server is already
 * initialized after connect, so `tools/list` and `tools/call` can be used
 * directly. Any string value "@doc" inside params is rewritten server-side to
 * the synced snapshot's absolute path.
 *
 * Degrades gracefully: any failure leaves the client uninitialized and logs a
 * warning — the static officecli_* tools remain available regardless.
 */

import { getCapabilities, mcpRequest } from './officecli-client'

// ── Types ────────────────────────────────────────────────────────────────────

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: {
    type?: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

// ── State ────────────────────────────────────────────────────────────────────

let nextId = 1
let initialized = false
let toolsCache: McpToolDefinition[] = []

/** Resets the module state. Exported for test isolation. */
export function resetMcpClient(): void {
  initialized = false
  toolsCache = []
}

function normalizeTool(raw: unknown): McpToolDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const tool = raw as { name?: unknown; description?: unknown; inputSchema?: unknown }
  if (typeof tool.name !== 'string' || !tool.name) return null
  return {
    name: tool.name,
    description: typeof tool.description === 'string' ? tool.description : '',
    inputSchema:
      tool.inputSchema && typeof tool.inputSchema === 'object'
        ? (tool.inputSchema as McpToolDefinition['inputSchema'])
        : {},
  }
}

// ── Discovery ────────────────────────────────────────────────────────────────

/**
 * Checks gateway capabilities and lists the officecli MCP tools. Idempotent:
 * once initialized, subsequent calls return true without refetching.
 */
export async function initMcp(): Promise<boolean> {
  if (initialized) return true
  try {
    const capabilities = await getCapabilities()
    if (!capabilities.available) return false

    const response = await mcpRequest({ id: nextId++, method: 'tools/list', params: {} })
    const tools = (response.result as { tools?: unknown[] } | undefined)?.tools
    if (!Array.isArray(tools)) {
      throw new Error('tools/list returned no tools array')
    }
    toolsCache = tools.map(normalizeTool).filter((t): t is McpToolDefinition => t !== null)
    initialized = true
    return true
  } catch (err) {
    console.warn('[mcp-client] officecli MCP unavailable:', err instanceof Error ? err.message : String(err))
    initialized = false
    toolsCache = []
    return false
  }
}

/** Returns the tools discovered by initMcp (empty when MCP is unavailable). */
export function getMcpTools(): McpToolDefinition[] {
  return toolsCache
}

// ── Calls ────────────────────────────────────────────────────────────────────

/** Property names treated as the target-file argument for @doc injection */
const FILEISH_PROPS = ['file', 'path', 'filename']

/**
 * Calls an officecli MCP tool. When the tool's inputSchema declares a file-ish
 * property (file|path|filename) that the caller did not fill, "@doc" is
 * injected — the gateway rewrites it to the synced snapshot's absolute path.
 */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  docId?: string,
): Promise<unknown> {
  const tool = toolsCache.find((t) => t.name === name)
  const finalArgs: Record<string, unknown> = { ...(args ?? {}) }

  if (tool) {
    const schemaProps = Object.keys(tool.inputSchema?.properties ?? {})
    const fileProp = FILEISH_PROPS.find((p) => schemaProps.includes(p))
    if (fileProp && finalArgs[fileProp] === undefined) {
      finalArgs[fileProp] = '@doc'
    }
  }

  const response = await mcpRequest(
    { id: nextId++, method: 'tools/call', params: { name, arguments: finalArgs } },
    docId,
  )
  if (response.error) {
    throw new Error(`MCP tool "${name}" failed: ${response.error.message}`)
  }
  return response.result ?? null
}

// ── Destructive heuristic (approval gate) ────────────────────────────────────

const MCP_DESTRUCTIVE_NAMES = new Set([
  // The officecli MCP server exposes a single catch-all `officecli` tool whose
  // `command` string can mutate (set/add/remove/batch/...), so it is always
  // approval-gated.
  'officecli',
  'set',
  'add',
  'remove',
  'move',
  'swap',
  'batch',
  'merge',
  'create',
  'raw-set',
  'raw_set',
  'delete',
])

/**
 * Returns true when an MCP tool name (with or without the mcp_officecli_
 * prefix) looks like a mutating officecli command and should require approval.
 */
export function isDestructiveMcpTool(name: string): boolean {
  const stripped = name.startsWith('mcp_officecli_') ? name.slice('mcp_officecli_'.length) : name
  return MCP_DESTRUCTIVE_NAMES.has(stripped)
}
