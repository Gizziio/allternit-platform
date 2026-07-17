import type { Tool } from '@modelcontextprotocol/sdk/types.js'

const sessionProperties = {
  slug: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
  workdir: { type: 'string', minLength: 1 },
  vendor: { type: 'string', enum: ['claude', 'kimi', 'codex', 'agy'] },
  mode: { type: 'string', enum: ['interactive', 'headless'] },
  backend: { type: 'string', enum: ['tmux', 'terminal-control'] },
  isolation: { type: 'string', enum: ['worktree', 'none'] },
  taskFile: { type: 'string', minLength: 1 },
  notesFile: { type: 'string', minLength: 1 },
  prompt: { type: 'string', minLength: 1 },
  timeoutMs: { type: 'integer', minimum: 1 },
  watchIntervalMs: { type: 'integer', minimum: 1 },
} as const

const sessionInputSchema = {
  type: 'object' as const,
  properties: sessionProperties,
  required: ['slug', 'workdir', 'vendor', 'mode', 'notesFile'],
  additionalProperties: false,
}

export const ORCHESTRATOR_MCP_TOOLS: Tool[] = [
  { name: 'orchestrator_doctor', description: 'Probe installed executor CLIs and supported execution modes.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } as any },
  { name: 'orchestrator_spawn', description: 'Spawn an executor session asynchronously. Alias of orchestrator_assign.', inputSchema: sessionInputSchema },
  { name: 'orchestrator_assign', description: 'Assign work to an executor asynchronously and return its live session.', inputSchema: sessionInputSchema },
  { name: 'orchestrator_handoff', description: 'Assign work and wait for completion notes plus the independently measured footprint.', inputSchema: sessionInputSchema },
  { name: 'orchestrator_status', description: 'List all sessions, or read one session status when slug is provided.', inputSchema: { type: 'object', properties: { slug: sessionProperties.slug }, additionalProperties: false } as any },
  { name: 'orchestrator_send', description: 'Steer or re-task a running executor using verified terminal submission.', inputSchema: { type: 'object', properties: { slug: sessionProperties.slug, prompt: sessionProperties.prompt }, required: ['slug', 'prompt'], additionalProperties: false } as any },
  { name: 'orchestrator_watch', description: 'Wait for completion and return executor notes plus the actual changed-file footprint for review.', inputSchema: { type: 'object', properties: { slug: sessionProperties.slug }, required: ['slug'], additionalProperties: false } as any },
  { name: 'orchestrator_review', description: 'Explicitly accept or reject executor work after inspecting its report and footprint.', inputSchema: { type: 'object', properties: { slug: sessionProperties.slug, decision: { type: 'string', enum: ['accepted', 'rejected'] }, reason: { type: 'string', minLength: 1 } }, required: ['slug', 'decision'], additionalProperties: false } as any },
  { name: 'orchestrator_kill', description: 'Terminate an executor session without interrupt keystrokes.', inputSchema: { type: 'object', properties: { slug: sessionProperties.slug, removeWorktree: { type: 'boolean' } }, required: ['slug'], additionalProperties: false } as any },
]

const names = new Set(ORCHESTRATOR_MCP_TOOLS.map((tool) => tool.name))

export function isOrchestratorMcpTool(name: string): boolean {
  return names.has(name)
}

function baseUrl(): string {
  return (process.env.GIZZI_ORCHESTRATOR_URL ?? process.env.GIZZI_SERVER_URL ?? 'http://127.0.0.1:4096').replace(/\/$/, '')
}

function headers(): Record<string, string> {
  const result: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' }
  const password = process.env.GIZZI_SERVER_PASSWORD
  if (password) {
    const username = process.env.GIZZI_SERVER_USERNAME ?? 'gizzi'
    result.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }
  return result
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  const url = `${baseUrl()}/v1/orchestrator${path}`
  let response: Response
  try {
    response = await fetch(url, { ...init, headers: { ...headers(), ...init?.headers } })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot reach the canonical Gizzi orchestrator at ${baseUrl()}: ${detail}`)
  }
  const body = await response.json().catch(() => null) as { message?: string; error?: string } | null
  if (!response.ok) throw new Error(body?.message ?? body?.error ?? `Orchestrator API ${response.status}: ${response.statusText}`)
  return body
}

function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${key} is required`)
  return value
}

export async function callOrchestratorMcpTool(name: string, rawArgs: unknown): Promise<unknown> {
  const args = rawArgs && typeof rawArgs === 'object' ? rawArgs as Record<string, unknown> : {}
  if (name === 'orchestrator_doctor') return call('/doctor')
  if (name === 'orchestrator_status') {
    const slug = typeof args.slug === 'string' && args.slug ? args.slug : null
    return call(slug ? `/sessions/${encodeURIComponent(slug)}` : '/sessions')
  }
  if (name === 'orchestrator_spawn' || name === 'orchestrator_assign' || name === 'orchestrator_handoff') {
    const path = name === 'orchestrator_handoff' ? '/handoff' : '/assign'
    return call(path, { method: 'POST', body: JSON.stringify(args) })
  }
  const slug = encodeURIComponent(requiredString(args, 'slug'))
  if (name === 'orchestrator_send') return call(`/sessions/${slug}/send`, { method: 'POST', body: JSON.stringify({ prompt: requiredString(args, 'prompt') }) })
  if (name === 'orchestrator_watch') return call(`/sessions/${slug}/watch`, { method: 'POST' })
  if (name === 'orchestrator_review') return call(`/sessions/${slug}/review`, { method: 'POST', body: JSON.stringify({ decision: requiredString(args, 'decision'), reason: args.reason }) })
  if (name === 'orchestrator_kill') return call(`/sessions/${slug}?removeWorktree=${args.removeWorktree === true}`, { method: 'DELETE' })
  throw new Error(`Unknown orchestrator MCP tool: ${name}`)
}
