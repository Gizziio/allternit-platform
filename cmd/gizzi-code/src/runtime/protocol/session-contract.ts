export interface SessionRecord {
  id: string
  [key: string]: unknown
}

export interface ReplayPage {
  sessionID: string
  head: number
  cursor: number
  hasMore: boolean
  snapshot?: unknown
  entries: unknown[]
}

export interface ScratchpadFile {
  path: string
  bytes: number
  updatedAt: number
  shared: boolean
}

export interface ScratchpadCatalog {
  sessionID: string
  rootSessionID: string
  entries: ScratchpadFile[]
}

export interface SessionContract {
  list(input?: { agentID?: string }): Promise<SessionRecord[]>
  get(sessionID: string): Promise<SessionRecord>
  create(input?: Record<string, unknown>): Promise<SessionRecord>
  replay(sessionID: string, input?: { after?: number; limit?: number; snapshot?: boolean }): Promise<ReplayPage>
  scratchpadList(sessionID: string): Promise<ScratchpadCatalog>
  scratchpadRead(sessionID: string, path: string, shared?: boolean): Promise<{ content: string; path: string; shared: boolean; bytes: number }>
  scratchpadWrite(sessionID: string, input: { path: string; content: string; shared?: boolean }): Promise<{ path: string; shared: boolean; bytes: number }>
  scratchpadRemove(sessionID: string, path: string, shared?: boolean): Promise<boolean>
}

export function createLocalSessionContract(operations: SessionContract): SessionContract {
  return operations
}

export function createHttpSessionContract(input: {
  baseUrl: string
  fetch?: typeof fetch
  headers?: Record<string, string>
}): SessionContract {
  const request = input.fetch ?? fetch
  const base = input.baseUrl.replace(/\/$/, "")
  const call = async <T>(path: string, init?: RequestInit): Promise<T> => {
    const response = await request(`${base}/v1/session${path}`, {
      ...init,
      headers: { Accept: "application/json", ...input.headers, ...init?.headers },
    })
    const body = await response.json() as any
    if (!response.ok) {
      const error = new Error(body?.error?.message ?? body?.message ?? `Session request failed (${response.status})`)
      Object.assign(error, { status: response.status, code: body?.error?.code ?? body?.error })
      throw error
    }
    return (body?.version === 1 && "data" in body ? body.data : body) as T
  }
  return {
    list(query = {}) {
      const params = new URLSearchParams()
      if (query.agentID) params.set("agentID", query.agentID)
      return call(`/list${params.size ? `?${params}` : ""}`)
    },
    get(sessionID) {
      return call(`/${encodeURIComponent(sessionID)}`)
    },
    create(body = {}) {
      return call("/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    replay(sessionID, query = {}) {
      const params = new URLSearchParams()
      if (query.after !== undefined) params.set("after", String(query.after))
      if (query.limit !== undefined) params.set("limit", String(query.limit))
      if (query.snapshot !== undefined) params.set("snapshot", String(query.snapshot))
      return call(`/${encodeURIComponent(sessionID)}/replay${params.size ? `?${params}` : ""}`)
    },
    scratchpadList(sessionID) {
      return call(`/${encodeURIComponent(sessionID)}/scratchpad`)
    },
    scratchpadRead(sessionID, path, shared = false) {
      const params = new URLSearchParams({ path, shared: String(shared) })
      return call(`/${encodeURIComponent(sessionID)}/scratchpad/file?${params}`)
    },
    scratchpadWrite(sessionID, body) {
      return call(`/${encodeURIComponent(sessionID)}/scratchpad/file`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    },
    scratchpadRemove(sessionID, path, shared = false) {
      const params = new URLSearchParams({ path, shared: String(shared) })
      return call(`/${encodeURIComponent(sessionID)}/scratchpad/file?${params}`, { method: "DELETE" })
    },
  }
}
