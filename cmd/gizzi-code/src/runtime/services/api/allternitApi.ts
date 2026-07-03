/**
 * Allternit Platform API client for task/cron sync.
 *
 * When ALLTERNIT_API_URL is set, the task and cron tools can persist to the
 * Allternit platform instead of (or in addition to) local files. This makes
 * schedules durable across restarts and accessible from the web UI.
 *
 * Auth precedence:
 * 1. ALLTERNIT_API_TOKEN as a Bearer token (Clerk JWT in production)
 * 2. Local dev fallback: x-allternit-user-id + x-allternit-desktop-access-token
 */

const DEFAULT_API_URL = 'http://127.0.0.1:8013'

export type AllternitApiConfig = {
  baseUrl: string
  token?: string
  userId: string
  userEmail?: string
  userName?: string
}

export function getAllternitApiConfig(): AllternitApiConfig | null {
  const baseUrl = (
    process.env.ALLTERNIT_API_URL ||
    process.env.ALLTERNIT_API_BASE_URL ||
    DEFAULT_API_URL
  )
    .trim()
    .replace(/\/$/, '')

  const token = process.env.ALLTERNIT_API_TOKEN?.trim()
  const userId = (
    process.env.ALLTERNIT_USER_ID ||
    process.env.ALLTERNIT_API_USER_ID ||
    'gizzi-local'
  ).trim()

  // If the user explicitly disables platform sync, stay local.
  if (process.env.ALLTERNIT_API_URL === 'none') {
    return null
  }

  return {
    baseUrl,
    token,
    userId,
    userEmail: process.env.ALLTERNIT_USER_EMAIL?.trim(),
    userName: process.env.ALLTERNIT_USER_NAME?.trim(),
  }
}

export function isAllternitApiEnabled(): boolean {
  return getAllternitApiConfig() !== null
}

function getHeaders(config: AllternitApiConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-allternit-user-id': config.userId,
  }

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`
  } else {
    // Local dev fallback accepted by allternit-api auth_middleware when Clerk
    // verification is not configured.
    headers['x-allternit-desktop-access-token'] = 'gizzi-local-token'
  }

  if (config.userEmail) {
    headers['x-allternit-user-email'] = config.userEmail
  }
  if (config.userName) {
    headers['x-allternit-user-name'] = config.userName
  }

  return headers
}

export async function apiFetch(
  config: AllternitApiConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${config.baseUrl}${path}`
  return fetch(url, {
    ...init,
    headers: {
      ...getHeaders(config),
      ...(init.headers as Record<string, string>),
    },
  })
}

export async function apiFetchJson<T>(
  config: AllternitApiConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(config, path, init)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Allternit API ${init.method || 'GET'} ${path} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
  return (await res.json()) as T
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tasks
// ═══════════════════════════════════════════════════════════════════════════════

export type ApiTask = {
  id: string
  title: string
  description?: string
  status: string
  assignee_id?: string
  assignee_name?: string
  metadata?: string
  created_at: string
  updated_at: string
}

export type ApiTaskListResponse = {
  tasks: ApiTask[]
  count: number
}

export async function createApiTask(
  config: AllternitApiConfig,
  input: {
    title: string
    description?: string
    status?: string
    assignee_id?: string
    assignee_name?: string
    metadata?: string
  },
): Promise<ApiTask> {
  return apiFetchJson<ApiTask>(config, '/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function listApiTasks(
  config: AllternitApiConfig,
  query?: { status?: string; limit?: number },
): Promise<ApiTaskListResponse> {
  const params = new URLSearchParams()
  if (query?.status) params.set('status', query.status)
  if (query?.limit) params.set('limit', String(query.limit))
  const qs = params.toString()
  return apiFetchJson<ApiTaskListResponse>(
    config,
    `/tasks${qs ? `?${qs}` : ''}`,
  )
}

export async function getApiTask(
  config: AllternitApiConfig,
  id: string,
): Promise<ApiTask> {
  return apiFetchJson<ApiTask>(config, `/tasks/${id}`)
}

export async function updateApiTask(
  config: AllternitApiConfig,
  id: string,
  input: {
    title?: string
    description?: string
    status?: string
    assignee_id?: string
    assignee_name?: string
    metadata?: string
  },
): Promise<ApiTask> {
  return apiFetchJson<ApiTask>(config, `/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function deleteApiTask(
  config: AllternitApiConfig,
  id: string,
): Promise<void> {
  const res = await apiFetch(config, `/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Allternit API DELETE /tasks/${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Automation: Routines (persistent cron) and Loops (session cron)
// ═══════════════════════════════════════════════════════════════════════════════

export type ApiRoutine = {
  id: string
  name: string
  description?: string
  status: string
  schedule_type: string
  schedule_expression: string
  timezone?: string
  config: Record<string, unknown>
  max_runs?: number
  created_at: string
  updated_at: string
}

export type ApiLoop = {
  id: string
  name: string
  description?: string
  status: string
  schedule_type: string
  schedule_expression: string
  config: Record<string, unknown>
  expires_at?: string
  created_at: string
  updated_at: string
}

export async function createApiRoutine(
  config: AllternitApiConfig,
  input: {
    name: string
    schedule_expression: string
    description?: string
    timezone?: string
    config?: Record<string, unknown>
    max_runs?: number
  },
): Promise<ApiRoutine> {
  return apiFetchJson<ApiRoutine>(config, '/automation/routines', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      schedule_type: 'cron',
    }),
  })
}

export async function listApiRoutines(
  config: AllternitApiConfig,
): Promise<ApiRoutine[]> {
  return apiFetchJson<ApiRoutine[]>(config, '/automation/routines')
}

export async function deleteApiRoutine(
  config: AllternitApiConfig,
  id: string,
): Promise<void> {
  const res = await apiFetch(config, `/automation/routines/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Allternit API DELETE /automation/routines/${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
}

export async function createApiLoop(
  config: AllternitApiConfig,
  input: {
    name: string
    schedule_expression: string
    description?: string
    config?: Record<string, unknown>
    expires_at?: string
  },
): Promise<ApiLoop> {
  return apiFetchJson<ApiLoop>(config, '/automation/loops', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      schedule_type: 'cron',
    }),
  })
}

export async function listApiLoops(
  config: AllternitApiConfig,
): Promise<ApiLoop[]> {
  return apiFetchJson<ApiLoop[]>(config, '/automation/loops')
}

export async function deleteApiLoop(
  config: AllternitApiConfig,
  id: string,
): Promise<void> {
  const res = await apiFetch(config, `/automation/loops/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Allternit API DELETE /automation/loops/${id} failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ''}`,
    )
  }
}
