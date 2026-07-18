import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { initMcp, getMcpTools, callMcpTool, isDestructiveMcpTool, resetMcpClient } from './mcp-client'
import * as client from './officecli-client'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./officecli-client', () => ({
  getCapabilities: vi.fn(),
  mcpRequest: vi.fn(),
}))

const getCapabilitiesMock = vi.mocked(client.getCapabilities)
const mcpRequestMock = vi.mocked(client.mcpRequest)

const MCP_TOOLS = [
  {
    name: 'view',
    description: 'View a document',
    inputSchema: { type: 'object', properties: { file: { type: 'string' }, mode: { type: 'string' } }, required: ['file'] },
  },
  {
    name: 'set',
    description: 'Edit a document',
    inputSchema: { type: 'object', properties: { path: { type: 'string' }, value: { type: 'string' } } },
  },
  {
    name: 'stats',
    description: 'No file argument',
    inputSchema: { type: 'object', properties: { verbose: { type: 'boolean' } } },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  resetMcpClient()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  getCapabilitiesMock.mockResolvedValue({ ok: true, available: true, version: '0.1.0', commands: [], live_fs: false })
  mcpRequestMock.mockResolvedValue({ jsonrpc: '2.0', id: 1, result: { tools: MCP_TOOLS } })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Discovery ────────────────────────────────────────────────────────────────

describe('initMcp', () => {
  it('lists and caches tools when the backend is available', async () => {
    const ok = await initMcp()

    expect(ok).toBe(true)
    expect(mcpRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'tools/list' }),
    )
    expect(getMcpTools().map((t) => t.name)).toEqual(['view', 'set', 'stats'])
  })

  it('is idempotent — subsequent calls do not refetch', async () => {
    await initMcp()
    await initMcp()
    expect(mcpRequestMock).toHaveBeenCalledTimes(1)
  })

  it('returns false without calling MCP when capabilities are unavailable', async () => {
    getCapabilitiesMock.mockResolvedValue({ ok: true, available: false })

    expect(await initMcp()).toBe(false)
    expect(mcpRequestMock).not.toHaveBeenCalled()
    expect(getMcpTools()).toEqual([])
  })

  it('degrades gracefully on failure — false + console.warn, no throw', async () => {
    mcpRequestMock.mockRejectedValue(new Error('gateway down'))

    await expect(initMcp()).resolves.toBe(false)
    expect(console.warn).toHaveBeenCalled()
    expect(getMcpTools()).toEqual([])
  })
})

// ── @doc injection ───────────────────────────────────────────────────────────

describe('callMcpTool', () => {
  beforeEach(async () => {
    await initMcp()
    mcpRequestMock.mockClear()
    mcpRequestMock.mockResolvedValue({ jsonrpc: '2.0', id: 2, result: { content: [] } })
  })

  it('injects file:"@doc" when the schema has a file-ish property and args lack it', async () => {
    await callMcpTool('view', { mode: 'text' }, 'doc-1')

    expect(mcpRequestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'tools/call',
        params: { name: 'view', arguments: { mode: 'text', file: '@doc' } },
      }),
      'doc-1',
    )
  })

  it('injects "@doc" into a path property too', async () => {
    await callMcpTool('set', { value: 'x' }, 'doc-1')

    const call = mcpRequestMock.mock.calls[0][0]
    expect(call.params?.arguments).toEqual({ value: 'x', path: '@doc' })
  })

  it('keeps a caller-provided file argument', async () => {
    await callMcpTool('view', { file: '/tmp/other.docx' }, 'doc-1')

    const call = mcpRequestMock.mock.calls[0][0]
    expect(call.params?.arguments).toEqual({ file: '/tmp/other.docx' })
  })

  it('does not inject when the schema has no file-ish property', async () => {
    await callMcpTool('stats', { verbose: true }, 'doc-1')

    const call = mcpRequestMock.mock.calls[0][0]
    expect(call.params?.arguments).toEqual({ verbose: true })
  })

  it('throws the JSON-RPC error message', async () => {
    mcpRequestMock.mockResolvedValue({ jsonrpc: '2.0', id: 2, error: { code: -32000, message: 'tool exploded' } })

    await expect(callMcpTool('view', {}, 'doc-1')).rejects.toThrow('tool exploded')
  })
})

// ── Destructive heuristic ────────────────────────────────────────────────────

describe('isDestructiveMcpTool', () => {
  it('flags mutating tool names, with or without the prefix', () => {
    expect(isDestructiveMcpTool('set')).toBe(true)
    expect(isDestructiveMcpTool('mcp_officecli_merge')).toBe(true)
    expect(isDestructiveMcpTool('mcp_officecli_raw-set')).toBe(true)
  })

  it('does not flag read-only names', () => {
    expect(isDestructiveMcpTool('view')).toBe(false)
    expect(isDestructiveMcpTool('mcp_officecli_stats')).toBe(false)
  })
})
