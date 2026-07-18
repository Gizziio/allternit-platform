/**
 * OfficeCLI Client — typed HTTP client for the gateway-hosted officecli backend.
 *
 * The gateway (same service as platform-gateway.ts, default http://127.0.0.1:8013)
 * runs the `officecli` binary server-side against uploaded document snapshots.
 * Mirrors the platform-gateway patterns: same auth headers, same timeout fetch
 * wrapper, same base URL resolution.
 *
 * API contract (all under /api/v1/office/cli):
 *   POST /document                                  binary body + x-office-* headers
 *   POST /exec                                      JSON command envelope
 *   GET  /document/:doc_id/artifact/:name           raw bytes
 *   GET  /capabilities                              feature detection (cached 5 min)
 *   POST /watch · DELETE /watch/:doc_id             live preview server
 *   POST /mcp                                       JSON-RPC 2.0 passthrough
 */

import { buildGatewayHeaders, fetchWithTimeout, getGatewayApiBaseUrl } from './platform-gateway'

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfficeCliCapabilities {
  ok: boolean
  available: boolean
  version?: string | null
  commands?: string[]
  live_fs?: boolean
}

export interface OfficeCliUploadResponse {
  ok: boolean
  doc_id: string
  size: number
  format: string
}

export interface OfficeCliArtifact {
  name: string
  kind: string
  url: string
}

export interface OfficeCliExecRequest {
  doc_id?: string
  new_filename?: string
  command: string
  path?: string
  props?: Record<string, unknown>
  args?: string[]
  /** Raw JSON array string for `batch` (forwarded as one --commands argv item). */
  commands?: string
  timeout_ms?: number
  session?: boolean
  /**
   * Direct on-disk editing (transport model 3): when the gateway shares the
   * filesystem with the client, this is the local absolute path of the open
   * document. The gateway may ignore it.
   */
  live_path?: string
}

export interface OfficeCliExecResponse {
  ok: boolean
  exit_code: number
  result: unknown
  stdout: string
  stderr: string
  artifacts: OfficeCliArtifact[]
  duration_ms: number
  truncated: boolean
}

export interface OfficeCliWatchResponse {
  ok: boolean
  watch_url: string
  port: number
}

export interface OfficeCliJsonRpcRequest {
  id: number | string
  method: string
  params?: Record<string, unknown>
}

export interface OfficeCliJsonRpcResponse {
  jsonrpc: string
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

/**
 * Transport-level failure talking to the officecli backend. `code`/`suggestion`
 * pass officecli's structured error fields through untouched when the gateway
 * relays them, so the model can self-correct.
 */
export class OfficeCliError extends Error {
  readonly status?: number
  readonly code?: string
  readonly suggestion?: string

  constructor(message: string, options: { status?: number; code?: string; suggestion?: string } = {}) {
    super(message)
    this.name = 'OfficeCliError'
    this.status = options.status
    this.code = options.code
    this.suggestion = options.suggestion
  }
}

// ── Error helper ─────────────────────────────────────────────────────────────

async function throwForBadResponse(response: Response, action: string): Promise<never> {
  let message = `${action} failed (${response.status})`
  let code: string | undefined
  let suggestion: string | undefined
  try {
    const data = (await response.json()) as {
      error?: string
      message?: string
      code?: string
      suggestion?: string
    }
    const detail = data.message ?? data.error
    if (detail) message = `${action} failed (${response.status}): ${detail}`
    code = data.code
    suggestion = data.suggestion
  } catch {
    // Non-JSON error body — keep the status-only message
  }
  throw new OfficeCliError(message, { status: response.status, code, suggestion })
}

// ── Capabilities (5 min TTL cache) ───────────────────────────────────────────

const CAPABILITIES_TTL_MS = 5 * 60 * 1000

let capabilitiesCache: { at: number; value: OfficeCliCapabilities } | null = null

export async function getCapabilities(forceRefresh = false): Promise<OfficeCliCapabilities> {
  if (!forceRefresh && capabilitiesCache && Date.now() - capabilitiesCache.at < CAPABILITIES_TTL_MS) {
    return capabilitiesCache.value
  }
  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/office/cli/capabilities`, {
    headers: buildGatewayHeaders(),
    timeout: 8000,
  })
  if (!response.ok) {
    await throwForBadResponse(response, 'officecli capabilities')
  }
  const value = (await response.json()) as OfficeCliCapabilities
  capabilitiesCache = { at: Date.now(), value }
  return value
}

/** Clears the capabilities cache. Exported for test isolation. */
export function clearCapabilitiesCache(): void {
  capabilitiesCache = null
}

// ── Document upload ──────────────────────────────────────────────────────────

/**
 * HTTP header values must be Latin-1; non-ASCII filenames are URI-encoded so
 * they survive the header channel. The gateway must decodeURIComponent the
 * x-office-filename header before writing the file.
 */
function toHeaderSafeFilename(filename: string): string {
  return /^[\x20-\x7e]*$/.test(filename) ? filename : encodeURIComponent(filename)
}

export async function uploadDocument(
  bytes: Uint8Array,
  meta: { filename: string; host: string; bindingId?: string | null },
): Promise<OfficeCliUploadResponse> {
  const headers: Record<string, string> = {
    ...(buildGatewayHeaders() as Record<string, string>),
    'Content-Type': 'application/octet-stream',
    'x-office-filename': toHeaderSafeFilename(meta.filename),
    'x-office-host': meta.host,
  }
  if (meta.bindingId) {
    headers['x-office-binding-id'] = meta.bindingId
  }

  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/office/cli/document`, {
    method: 'POST',
    headers,
    // Uint8Array is a valid fetch body at runtime (BufferSource); the installed
    // DOM lib's BodyInit union is just missing it.
    body: bytes as unknown as BodyInit,
    timeout: 60000,
  })
  if (!response.ok) {
    await throwForBadResponse(response, 'officecli document upload')
  }
  return (await response.json()) as OfficeCliUploadResponse
}

// ── Command execution ────────────────────────────────────────────────────────

export async function execCommand(req: OfficeCliExecRequest): Promise<OfficeCliExecResponse> {
  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/office/cli/exec`, {
    method: 'POST',
    headers: buildGatewayHeaders(),
    body: JSON.stringify(req),
    // Leave headroom over the server-side timeout (default 60 s, cap 300 s)
    timeout: Math.min((req.timeout_ms ?? 60000) + 15000, 330000),
  })
  if (!response.ok) {
    await throwForBadResponse(response, 'officecli exec')
  }
  return (await response.json()) as OfficeCliExecResponse
}

// ── Artifacts ────────────────────────────────────────────────────────────────

export async function fetchArtifact(docId: string, name: string): Promise<Blob> {
  const response = await fetchWithTimeout(
    `${getGatewayApiBaseUrl()}/office/cli/document/${encodeURIComponent(docId)}/artifact/${encodeURIComponent(name)}`,
    {
      headers: buildGatewayHeaders(),
      timeout: 60000,
    },
  )
  if (!response.ok) {
    await throwForBadResponse(response, `officecli artifact "${name}"`)
  }
  return response.blob()
}

// ── Watch (live preview) ─────────────────────────────────────────────────────

export async function startWatch(docId: string): Promise<OfficeCliWatchResponse> {
  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/office/cli/watch`, {
    method: 'POST',
    headers: buildGatewayHeaders(),
    body: JSON.stringify({ doc_id: docId }),
    timeout: 15000,
  })
  if (!response.ok) {
    await throwForBadResponse(response, 'officecli watch start')
  }
  return (await response.json()) as OfficeCliWatchResponse
}

export async function stopWatch(docId: string): Promise<{ ok: boolean }> {
  const response = await fetchWithTimeout(
    `${getGatewayApiBaseUrl()}/office/cli/watch/${encodeURIComponent(docId)}`,
    {
      method: 'DELETE',
      headers: buildGatewayHeaders(),
      timeout: 15000,
    },
  )
  if (!response.ok) {
    await throwForBadResponse(response, 'officecli watch stop')
  }
  return (await response.json()) as { ok: boolean }
}

// ── MCP bridge ───────────────────────────────────────────────────────────────

export async function mcpRequest(
  rpc: OfficeCliJsonRpcRequest,
  docId?: string,
): Promise<OfficeCliJsonRpcResponse> {
  const body: Record<string, unknown> = {
    jsonrpc: '2.0',
    id: rpc.id,
    method: rpc.method,
    params: rpc.params ?? {},
  }
  if (docId) {
    body.doc_id = docId
  }

  const response = await fetchWithTimeout(`${getGatewayApiBaseUrl()}/office/cli/mcp`, {
    method: 'POST',
    headers: buildGatewayHeaders(),
    body: JSON.stringify(body),
    timeout: 65000,
  })
  if (!response.ok) {
    await throwForBadResponse(response, 'officecli mcp')
  }
  return (await response.json()) as OfficeCliJsonRpcResponse
}
