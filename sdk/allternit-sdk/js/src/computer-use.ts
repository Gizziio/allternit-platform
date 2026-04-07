/**
 * @allternit/sdk/computer-use - Computer Use Engine Client
 */

export interface ComputerUseRequest {
  mode: string
  task: string
  target_scope?: string
  metadata?: Record<string, unknown>
}

export interface ComputerUseResponse {
  run_id: string
  [key: string]: unknown
}

export interface WatchOptions {
  runId: string
  signal?: AbortSignal
}

export interface WatchRunOptions {
  intervalMs?: number
  signal?: AbortSignal
}

export interface WaitForRunOptions {
  intervalMs?: number
  signal?: AbortSignal
}

export interface ApprovalOptions {
  approver_id?: string
  comment?: string
  [key: string]: unknown
}

export interface CancelOptions {
  approver_id?: string
  comment?: string
  [key: string]: unknown
}

export interface ResumeOptions {
  approver_id?: string
  comment?: string
  [key: string]: unknown
}

export interface RequestOptions {
  baseUrl?: string
  fetch?: typeof fetch
  headers?: Record<string, string>
}

export class AllternitComputerUseClient {
  readonly baseUrl: string
  readonly fetch: typeof fetch
  readonly headers: Record<string, string>

  constructor(config: RequestOptions = {}) {
    this.baseUrl = resolveComputerUseBaseUrl(config.baseUrl)
    this.fetch = config.fetch || globalThis.fetch
    this.headers = config.headers || {}
  }

  async execute(request: ComputerUseRequest): Promise<ComputerUseResponse> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      throw new Error(`Computer use execution failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async watch(options: WatchOptions): Promise<Response> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/watch/${options.runId}`, {
      method: "GET",
      headers: this.headers,
      signal: options.signal,
    })
    if (!response.ok) {
      throw new Error(`Watch failed: ${response.status} ${response.statusText}`)
    }
    return response
  }

  async getReceipts(runId: string): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/receipts/${runId}`, {
      method: "GET",
      headers: this.headers,
    })
    if (!response.ok) {
      throw new Error(`Get receipts failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getSnapshot(runId: string): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/snapshot/${runId}`, {
      method: "GET",
      headers: this.headers,
    })
    if (!response.ok) {
      throw new Error(`Get snapshot failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async approveRun(runId: string, options: ApprovalOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({
        decision: "approve",
        ...options,
      }),
    })
    if (!response.ok) {
      throw new Error(`Approve run failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async denyRun(runId: string, options: ApprovalOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/approval`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify({
        decision: "deny",
        ...options,
      }),
    })
    if (!response.ok) {
      throw new Error(`Deny run failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async cancelRun(runId: string, options: CancelOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(options),
    })
    if (!response.ok) {
      throw new Error(`Cancel run failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async pauseRun(runId: string, options: CancelOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/pause`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(options),
    })
    if (!response.ok) {
      throw new Error(`Pause run failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async resumeRun(runId: string, options: ResumeOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/resume`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(options),
    })
    if (!response.ok) {
      throw new Error(`Resume run failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async *watchRun(runId: string, options: WatchRunOptions = {}) {
    const { intervalMs = 1000, signal } = options
    let nextIndex = 0

    while (!signal?.aborted) {
      const response = await this.fetch(`${this.baseUrl}/v1/engine/runs/${runId}/events?next_index=${nextIndex}`, {
        method: "GET",
        headers: this.headers,
        signal,
      })
      if (!response.ok) {
        throw new Error(`Watch run failed: ${response.status} ${response.statusText}`)
      }
      const batch = await response.json()
      yield batch
      if ((batch as any).completed) break
      nextIndex = (batch as any).next_index ?? nextIndex + 1
      if (intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }
  }

  async waitForRun(runId: string, options: WaitForRunOptions = {}) {
    const { intervalMs = 1000, signal } = options
    while (!signal?.aborted) {
      const snapshot = await this.getSnapshot(runId) as { status?: string }
      if (
        snapshot.status === "needs_approval" ||
        snapshot.status === "paused" ||
        snapshot.status === "completed" ||
        snapshot.status === "failed" ||
        snapshot.status === "cancelled"
      ) {
        return snapshot
      }
      if (intervalMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs))
      }
    }
    throw new Error("Wait for run was aborted")
  }
}

export function createComputerUseClient(config?: RequestOptions) {
  return new AllternitComputerUseClient(config)
}

export function resolveComputerUseBaseUrl(url?: string): string {
  if (!url) {
    return (process.env.ALLTERNIT_BASE_URL || process.env.GIZZI_SERVER_URL || "http://localhost:4096").replace(/\/+$/g, "")
  }
  return String(url).replace(/\/+$/g, "")
}

export type EngineEventBatch = unknown
export type EngineEventRecord = unknown
export type EngineExecutionRequestInput = ComputerUseRequest
export type EngineReceiptsResponse = unknown
export type EngineRunSnapshot = unknown
