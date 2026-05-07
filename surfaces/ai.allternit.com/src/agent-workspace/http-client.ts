/**
 * HTTP Client for Agent Workspace API
 *
 * Connects to the /v1/workspace/ route group in gizzi-code (or any compatible
 * backend implementing the same contract).
 *
 * Route mapping:
 *   Workspace info    → GET  /v1/workspace
 *   Init              → POST /v1/workspace/init
 *   Import openclaw   → POST /v1/workspace/import
 *   Identity (read)   → GET  /v1/workspace/identity
 *   Identity (write)  → PUT  /v1/workspace/identity
 *   Layers            → GET  /v1/workspace/layers
 *   Memory (read)     → GET  /v1/workspace/memory
 *   Memory (write)    → POST /v1/workspace/memory
 *   Skills            → GET  /v1/workspace/skills
 *   Sessions          → /v1/session/*  (existing routes)
 *   Config            → GET /v1/config (existing route)
 *   Health            → GET /health    (existing route)
 */

import type {
  WorkspaceAPI,
  WorkspaceInfo,
  Task,
  CreateTaskInput,
  TaskGraph,
  MemoryEntry,
  CreateMemoryInput,
  PolicyRule,
  PolicyDecision,
  Skill,
  Identity,
} from './index'
import { Backend } from './index'

export interface HttpWorkspaceAPI extends WorkspaceAPI {
  backend: Backend.HTTP
  serverUrl: string
  fetch: (path: string, options?: RequestInit) => Promise<Response>
  getAuthHeader: () => string | undefined
}

export interface HttpClientOptions {
  timeout?: number
  retries?: number
  retryDelay?: number
}

interface ParsedPolicyRule {
  id: string
  name: string
  description: string
  condition: string
  action: 'allow' | 'deny' | 'require_approval'
}

function normalizePolicyAction(value: unknown): ParsedPolicyRule['action'] {
  if (value === 'allow' || value === 'deny' || value === 'require_approval') return value
  if (value === 'ask') return 'require_approval'
  return 'require_approval'
}

function parsePolicySource(source: string): ParsedPolicyRule[] {
  const trimmed = source.trim()
  if (!trimmed) return []

  try {
    const parsed = JSON.parse(trimmed) as unknown
    const rules = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { rules?: unknown[] }).rules)
        ? (parsed as { rules: unknown[] }).rules
        : []

    return rules
      .map((rule, index) => {
        if (!rule || typeof rule !== 'object') return null
        const candidate = rule as Record<string, unknown>
        return {
          id: String(candidate.id ?? `policy-${index + 1}`),
          name: String(candidate.name ?? `Policy Rule ${index + 1}`),
          description: String(candidate.description ?? candidate.condition ?? ''),
          condition: String(candidate.condition ?? ''),
          action: normalizePolicyAction(candidate.action),
        }
      })
      .filter((rule): rule is ParsedPolicyRule => !!rule)
  } catch {
    // Fall through to line-based parsing.
  }

  return trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line, index) => {
      const normalized = line.replace(/^[-*]\s*/, '')
      const match = normalized.match(/^(allow|deny|ask|require_approval)\s*:\s*(.+)$/i)
      if (!match) return null
      const [, action, condition] = match
      return {
        id: `policy-${index + 1}`,
        name: `Policy Rule ${index + 1}`,
        description: normalized,
        condition: condition.trim(),
        action: normalizePolicyAction(action.toLowerCase()),
      }
    })
    .filter((rule): rule is ParsedPolicyRule => !!rule)
}

function ruleMatches(
  condition: string,
  action: string,
  params: Record<string, unknown>,
): boolean {
  const normalizedAction = action.toLowerCase()
  const target = String(
    params.path ??
      params.filePath ??
      params.toolId ??
      params.tool ??
      params.target ??
      '',
  ).toLowerCase()
  const normalizedCondition = condition.toLowerCase()

  if (!normalizedCondition || normalizedCondition === 'true' || normalizedCondition === '*') {
    return true
  }

  const segments = normalizedCondition
    .split(/\s+and\s+/i)
    .map((segment) => segment.trim())
    .filter(Boolean)

  return segments.every((segment) => {
    if (segment.startsWith('action=')) {
      return normalizedAction === segment.slice('action='.length).trim()
    }
    if (segment.startsWith('path=')) {
      return target.includes(segment.slice('path='.length).trim())
    }
    if (segment.startsWith('tool=')) {
      return target.includes(segment.slice('tool='.length).trim())
    }
    return target.includes(segment)
  })
}

export async function createHttpWorkspace(
  workspacePath: string,
  serverUrl: string,
  auth?: { username: string; password: string },
  options: HttpClientOptions = {},
): Promise<HttpWorkspaceAPI> {
  const { timeout = 30000, retries = 3, retryDelay = 1000 } = options
  const baseUrl = serverUrl.replace(/\/$/, '')
  const authHeader = auth
    ? `Basic ${btoa(`${auth.username}:${auth.password}`)}`
    : undefined

  async function authFetch(
    path: string,
    fetchOptions: RequestInit = {},
    attempt = 1,
  ): Promise<Response> {
    const url = `${baseUrl}${path}`
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...((fetchOptions.headers as Record<string, string>) || {}),
    }
    if (authHeader) headers['Authorization'] = authHeader

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal })
      clearTimeout(timeoutId)
      if (!response.ok) {
        const text = await response.text().catch(() => 'Unknown error')
        throw new Error(`HTTP ${response.status}: ${text}`)
      }
      return response
    } catch (error) {
      clearTimeout(timeoutId)
      if (attempt < retries) {
        const retryable =
          error instanceof TypeError ||
          (error instanceof Error && error.message.startsWith('HTTP 5'))
        if (retryable) {
          await new Promise((r) => setTimeout(r, retryDelay * attempt))
          return authFetch(path, fetchOptions, attempt + 1)
        }
      }
      throw error
    }
  }

  async function json<T>(path: string, opts: RequestInit = {}): Promise<T> {
    return (await authFetch(path, opts)).json()
  }

  // ── Cached workspace info ──────────────────────────────────────────────
  let _info: any = null

  async function getWorkspaceInfo(): Promise<any> {
    if (_info) return _info
    _info = await json<any>('/v1/workspace')
    return _info
  }

  // ── Session management (backed by /v1/session) ────────────────────────
  let _sessionId: string | undefined

  async function ensureSession(): Promise<string> {
    if (_sessionId) return _sessionId
    const result = await json<{ id: string }>('/v1/session', {
      method: 'POST',
      body: JSON.stringify({ directory: workspacePath }),
    })
    _sessionId = result.id
    return _sessionId
  }

  return {
    backend: Backend.HTTP,
    serverUrl: baseUrl,
    path: workspacePath,

    fetch: (p, opts) => authFetch(p, opts),
    getAuthHeader: () => authHeader,

    // ── Workspace ──────────────────────────────────────────────────────
    getInfo: async (): Promise<WorkspaceInfo> => {
      const ws = await getWorkspaceInfo()
      if (!ws) {
        return {
          id: workspacePath,
          name: workspacePath.split('/').pop() || 'Workspace',
          path: workspacePath,
          version: '1.0.0',
          isBooted: false,
        }
      }
      return {
        id: ws.path ?? workspacePath,
        name: ws.name ?? workspacePath.split('/').pop() ?? 'Workspace',
        path: ws.path ?? workspacePath,
        version: ws.format === 'layered' ? '2.0.0' : '1.0.0',
        isBooted: true,
        lastSyncAt: new Date().toISOString(),
      }
    },

    boot: async () => {
      // Ensure workspace exists; init flat if not
      const ws = await json<any>('/v1/workspace').catch(() => null)
      if (!ws) {
        await json('/v1/workspace/init', { method: 'POST', body: JSON.stringify({ format: 'flat' }) })
      }
      _info = null // invalidate cache
    },

    sync: async () => {
      _info = null // force re-detect on next call
    },

    // ── Tasks (backed by session todos) ───────────────────────────────
    listTasks: async (): Promise<Task[]> => {
      const sid = await ensureSession()
      const todos = await json<any[]>(`/v1/session/${sid}/todo/list`).catch(() => [])
      return todos.map(mapTodo)
    },

    getTask: async (id: string): Promise<Task | null> => {
      const sid = await ensureSession()
      const todos = await json<any[]>(`/v1/session/${sid}/todo/list`).catch(() => [])
      const found = todos.find((t: any) => t.id === id)
      return found ? mapTodo(found) : null
    },

    createTask: async (input: CreateTaskInput): Promise<Task> => {
      const sid = await ensureSession()
      const result = await json<any>(`/v1/session/${sid}/todo`, {
        method: 'POST',
        body: JSON.stringify({ title: input.title, description: input.description }),
      })
      return mapTodo(result)
    },

    updateTask: async (id: string, updates: Partial<Task>): Promise<Task> => {
      const sid = await ensureSession()
      const result = await json<any>(`/v1/session/${sid}/todo/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      return mapTodo(result)
    },

    deleteTask: async (id: string): Promise<void> => {
      const sid = await ensureSession()
      await authFetch(`/v1/session/${sid}/todo/${id}`, { method: 'DELETE' })
    },

    getTaskGraph: async (): Promise<TaskGraph> => {
      const sid = await ensureSession()
      const todos = await json<any[]>(`/v1/session/${sid}/todo/list`).catch(() => [])
      const tasks = todos.map(mapTodo)
      return { tasks, edges: tasks.flatMap((t) => t.dependencies.map((dep) => ({ from: dep, to: t.id }))) }
    },

    // ── Memory (backed by /v1/workspace/memory) ───────────────────────
    listMemoryEntries: async (): Promise<MemoryEntry[]> => {
      const mem = await json<any>('/v1/workspace/memory').catch(() => null)
      if (!mem) return []
      // Layered: return jsonl entries; flat: parse MEMORY.md lines
      if (Array.isArray(mem.entries)) {
        return mem.entries.map((e: any, i: number) => ({
          id: String(i),
          type: e.type ?? 'note',
          content: e.content ?? '',
          tags: e.tags ?? [],
          timestamp: e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
        }))
      }
      // Flat: return memory_md as a single entry
      if (mem.memory_md) {
        return [{ id: 'memory-md', type: 'note', content: mem.memory_md, tags: [], timestamp: new Date().toISOString() }]
      }
      return []
    },

    getMemoryEntry: async (id: string): Promise<MemoryEntry | null> => {
      const mem = await json<any>('/v1/workspace/memory').catch(() => null)
      if (!mem || !Array.isArray(mem.entries)) return null
      const e = mem.entries[Number(id)]
      if (!e) return null
      return { id, type: e.type ?? 'note', content: e.content ?? '', tags: e.tags ?? [], timestamp: new Date(e.ts ?? Date.now()).toISOString() }
    },

    createMemoryEntry: async (input: CreateMemoryInput): Promise<MemoryEntry> => {
      const result = await json<any>('/v1/workspace/memory', {
        method: 'POST',
        body: JSON.stringify({ content: input.content, type: input.type, tags: input.tags }),
      })
      return {
        id: String(Date.now()),
        type: input.type,
        content: input.content,
        tags: input.tags ?? [],
        timestamp: new Date().toISOString(),
      }
    },

    searchMemory: async (query: string): Promise<MemoryEntry[]> => {
      const mem = await json<any>('/v1/workspace/memory').catch(() => null)
      if (!mem) return []
      const entries: MemoryEntry[] = Array.isArray(mem.entries)
        ? mem.entries.map((e: any, i: number) => ({
            id: String(i),
            type: e.type ?? 'note',
            content: e.content ?? '',
            tags: e.tags ?? [],
            timestamp: new Date(e.ts ?? Date.now()).toISOString(),
          }))
        : []
      const q = query.toLowerCase()
      return entries.filter(
        (e) => e.content.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)),
      )
    },

    // ── Policy ────────────────────────────────────────────────────────
    listPolicyRules: async (): Promise<PolicyRule[]> => {
      const identity = await json<any>('/v1/workspace/identity').catch(() => null)
      if (!identity?.files?.policy) return []
      return parsePolicySource(identity.files.policy).map((rule) => ({
        id: rule.id,
        name: rule.name,
        description: rule.description,
        condition: rule.condition,
        action: rule.action,
      }))
    },

    checkPolicy: async (action: string, params: Record<string, unknown>): Promise<PolicyDecision> => {
      const identity = await json<any>('/v1/workspace/identity').catch(() => null)
      const policySource = identity?.files?.policy

      if (!policySource) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: 'Workspace policy is unavailable, so this action must be reviewed explicitly.',
        }
      }

      const rules = parsePolicySource(policySource)
      if (!rules.length) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: 'Workspace policy could not be parsed into enforceable rules.',
        }
      }

      const matchedRule = rules.find((rule) => ruleMatches(rule.condition, action, params))
      if (!matchedRule) {
        return {
          allowed: false,
          requiresApproval: true,
          reason: `No policy rule allows "${action}" for the requested target.`,
        }
      }

      if (matchedRule.action === 'deny') {
        return {
          allowed: false,
          requiresApproval: false,
          reason: matchedRule.description || `Policy denied "${action}".`,
        }
      }

      if (matchedRule.action === 'require_approval') {
        return {
          allowed: false,
          requiresApproval: true,
          reason: matchedRule.description || `Policy requires approval for "${action}".`,
        }
      }

      return {
        allowed: true,
        requiresApproval: false,
        reason: matchedRule.description || undefined,
      }
    },

    // ── Skills ────────────────────────────────────────────────────────
    listSkills: async (): Promise<Skill[]> => {
      const skillsPayload = await json<any>('/v1/workspace/skills').catch(() => [])
      const skills = Array.isArray(skillsPayload)
        ? skillsPayload
        : Array.isArray(skillsPayload?.skills)
          ? skillsPayload.skills
          : Array.isArray(skillsPayload?.items)
            ? skillsPayload.items
            : []
      return skills.map((s: any) => ({
        id: s.id ?? s.name,
        name: s.name ?? s.id,
        description: s.description ?? '',
        version: s.version ?? '1.0.0',
        installed: true,
      }))
    },

    installSkill: async (id: string): Promise<void> => {
      await authFetch('/v1/skill/add', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
    },

    uninstallSkill: async (id: string): Promise<void> => {
      await authFetch('/v1/skill/remove', {
        method: 'POST',
        body: JSON.stringify({ id }),
      })
    },

    // ── Identity ──────────────────────────────────────────────────────
    getIdentity: async (): Promise<Identity> => {
      const identity = await json<any>('/v1/workspace/identity').catch(() => null)
      return {
        name: identity?.name ?? 'Gizzi Agent',
        role: 'assistant',
        capabilities: ['code', 'analysis', 'memory'],
        soul: identity?.files?.soul
          ? { values: [], personality: identity.files.soul }
          : undefined,
      }
    },

    updateIdentity: async (updates: Partial<Identity>): Promise<Identity> => {
      if (updates.name || updates.soul) {
        // Update IDENTITY.md with new name/vibe
        const current = await json<any>('/v1/workspace/identity').catch(() => null)
        const content = current?.files?.identity ?? `# Identity\n\n- **Name:** ${updates.name ?? 'Gizzi Agent'}\n`
        await json('/v1/workspace/identity', {
          method: 'PUT',
          body: JSON.stringify({ file: 'IDENTITY.md', content }),
        })
        if (updates.soul?.personality) {
          await json('/v1/workspace/identity', {
            method: 'PUT',
            body: JSON.stringify({ file: 'SOUL.md', content: updates.soul.personality }),
          })
        }
      }
      return {
        name: updates.name ?? 'Gizzi Agent',
        role: updates.role ?? 'assistant',
        capabilities: updates.capabilities ?? ['code', 'analysis'],
        soul: updates.soul,
      }
    },

    // ── Connection ────────────────────────────────────────────────────
    isConnected: () => true,

    reconnect: async (): Promise<boolean> => {
      try {
        const r = await authFetch('/health', { method: 'GET' }, 1)
        return r.ok
      } catch {
        return false
      }
    },
  }
}

/** Map a session todo object to the Task shape */
function mapTodo(t: any): Task {
  return {
    id: t.id,
    title: t.title ?? t.content ?? '',
    description: t.description,
    status: t.status ?? 'pending',
    priority: t.priority ?? 'medium',
    dependencies: t.dependencies ?? [],
    createdAt: t.created_at ?? t.createdAt ?? new Date().toISOString(),
    updatedAt: t.updated_at ?? t.updatedAt ?? new Date().toISOString(),
  }
}

export default createHttpWorkspace
