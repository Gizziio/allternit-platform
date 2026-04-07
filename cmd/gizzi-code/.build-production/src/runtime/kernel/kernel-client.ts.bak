/**
 * Agent Workspace - Kernel Client
 * 
 * HTTP client for communicating with the kernel ledger.
 * Provides real-time sync between agent workspace and authoritative kernel state.
 */

import { Log } from "@/shared/util/log"

const log = Log.create({ service: "agent_workspace.kernel_client" })

export namespace KernelClient {
  export interface ClientOptions {
    endpoint: string
    apiKey?: string
    timeout?: number
  }

  export interface LedgerQuery {
    afterSequence: number
    limit?: number
    types?: ("tool_call" | "state_change" | "checkpoint")[]
  }

  export interface LedgerEntry {
    sequence: number
    timestamp: number
    type: "tool_call" | "state_change" | "checkpoint"
    sessionId: string
    data: unknown
    hash: string
  }

  export interface LedgerResponse {
    entries: LedgerEntry[]
    lastSequence: number
    hasMore: boolean
  }

  export interface SessionState {
    sessionId: string
    workspace: string
    dag: {
      currentNodeId: string
      rootNodeId: string
      depth: number
    }
    context: {
      tokensUsed: number
      contextWindow: number
      filesAccessed: string[]
    }
    status: "active" | "paused" | "handoff" | "complete"
  }

  let defaultOptions: ClientOptions | null = null

  /**
   * Initialize kernel client with default options
   */
  export function initialize(options: ClientOptions): void {
    defaultOptions = {
      timeout: 30000,
      ...options,
    }
    log.info("Kernel client initialized", { endpoint: options.endpoint })
  }

  /**
   * Query ledger for entries
   */
  export async function queryLedger(
    query: LedgerQuery,
    options?: Partial<ClientOptions>
  ): Promise<LedgerResponse> {
    const opts = { ...defaultOptions, ...options }
    
    if (!opts.endpoint) {
      throw new Error("Kernel endpoint not configured")
    }

    const url = new URL("/api/v1/ledger", opts.endpoint)
    url.searchParams.set("after", query.afterSequence.toString())
    
    if (query.limit) {
      url.searchParams.set("limit", query.limit.toString())
    }
    
    if (query.types?.length) {
      url.searchParams.set("types", query.types.join(","))
    }

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(opts.apiKey && { "Authorization": `Bearer ${opts.apiKey}` }),
        },
        signal: AbortSignal.timeout(opts.timeout ?? 30000),
      })

      if (!response.ok) {
        throw new Error(`Kernel query failed: ${response.status} ${response.statusText}`)
      }

      const data: LedgerResponse = await response.json()
      
      log.debug("Ledger query complete", {
        entries: data.entries.length,
        lastSequence: data.lastSequence,
      })
      
      return data
    } catch (error) {
      log.error("Ledger query failed", { error })
      throw error
    }
  }

  /**
   * Get current session state from kernel
   */
  export async function getSessionState(
    sessionId: string,
    options?: Partial<ClientOptions>
  ): Promise<SessionState> {
    const opts = { ...defaultOptions, ...options }
    
    if (!opts.endpoint) {
      throw new Error("Kernel endpoint not configured")
    }

    const url = new URL(`/api/v1/sessions/${sessionId}/state`, opts.endpoint)

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(opts.apiKey && { "Authorization": `Bearer ${opts.apiKey}` }),
        },
        signal: AbortSignal.timeout(opts.timeout ?? 30000),
      })

      if (!response.ok) {
        throw new Error(`Failed to get session state: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      log.error("Get session state failed", { sessionId, error })
      throw error
    }
  }

  /**
   * Post new entry to ledger
   */
  export async function postEntry(
    entry: Omit<LedgerEntry, "sequence" | "hash">,
    options?: Partial<ClientOptions>
  ): Promise<LedgerEntry> {
    const opts = { ...defaultOptions, ...options }
    
    if (!opts.endpoint) {
      throw new Error("Kernel endpoint not configured")
    }

    const url = new URL("/api/v1/ledger", opts.endpoint)

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(opts.apiKey && { "Authorization": `Bearer ${opts.apiKey}` }),
        },
        body: JSON.stringify(entry),
        signal: AbortSignal.timeout(opts.timeout ?? 30000),
      })

      if (!response.ok) {
        throw new Error(`Failed to post entry: ${response.status}`)
      }

      const result: LedgerEntry = await response.json()
      
      log.debug("Entry posted to ledger", {
        sequence: result.sequence,
        type: entry.type,
      })
      
      return result
    } catch (error) {
      log.error("Post entry failed", { error })
      throw error
    }
  }

  /**
   * Subscribe to real-time ledger updates via WebSocket
   */
  export function subscribeToLedger(
    sessionId: string,
    onEntry: (entry: LedgerEntry) => void,
    options?: Partial<ClientOptions>
  ): () => void {
    const opts = { ...defaultOptions, ...options }
    
    if (!opts.endpoint) {
      throw new Error("Kernel endpoint not configured")
    }

    // Convert HTTP URL to WebSocket URL
    const wsUrl = opts.endpoint
      .replace(/^http/, "ws")
      .replace(/^https/, "wss")
    
    const url = new URL(`/api/v1/ledger/ws?session=${sessionId}`, wsUrl)

    try {
      const ws = new WebSocket(url.toString())
      
      ws.onopen = () => {
        log.debug("WebSocket connected", { sessionId })
      }
      
      ws.onmessage = (event) => {
        try {
          const entry: LedgerEntry = JSON.parse(event.data)
          onEntry(entry)
        } catch (error) {
          log.error("Failed to parse WebSocket message", { error })
        }
      }
      
      ws.onerror = (error) => {
        log.error("WebSocket error", { error })
      }
      
      ws.onclose = () => {
        log.debug("WebSocket closed", { sessionId })
      }

      // Return unsubscribe function
      return () => {
        ws.close()
      }
    } catch (error) {
      log.error("Failed to create WebSocket", { error })
      throw error
    }
  }

  /**
   * Check kernel health
   */
  export async function healthCheck(
    options?: Partial<ClientOptions>
  ): Promise<{ status: string; version: string }> {
    const opts = { ...defaultOptions, ...options }
    
    if (!opts.endpoint) {
      throw new Error("Kernel endpoint not configured")
    }

    const url = new URL("/health", opts.endpoint)

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      log.error("Health check failed", { error })
      throw error
    }
  }

  /**
   * Get kernel info
   */
  export async function getInfo(
    options?: Partial<ClientOptions>
  ): Promise<{
    version: string
    features: string[]
    limits: {
      maxContextTokens: number
      maxSessionDuration: number
    }
  }> {
    const opts = { ...defaultOptions, ...options }
    
    if (!opts.endpoint) {
      throw new Error("Kernel endpoint not configured")
    }

    const url = new URL("/api/v1/info", opts.endpoint)

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          ...(opts.apiKey && { "Authorization": `Bearer ${opts.apiKey}` }),
        },
        signal: AbortSignal.timeout(opts.timeout ?? 30000),
      })

      if (!response.ok) {
        throw new Error(`Failed to get info: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      log.error("Get info failed", { error })
      throw error
    }
  }
}
