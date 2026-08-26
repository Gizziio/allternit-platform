/**
 * @allternit/sdk/computer-use - Computer Use Engine Client
 */

export const COMPUTER_USE_CONTRACT_VERSION = "1.0.0-alpha.1" as const
export type ComputerExecutionMode = "background_strict" | "foreground_allowed" | "sandboxed"
export type ComputerOutcomeStatus = "worked" | "didnt" | "unknown" | "blocked" | "cancelled"

export interface CanonicalComputerCapabilityManifest {
  provider_id: string
  provider_version: string
  contract_version: typeof COMPUTER_USE_CONTRACT_VERSION
  invariant_version: string
  invariants: string[]
  operating_systems: Array<"macos" | "windows" | "linux" | "android">
  actions: string[]
  observation_channels: string[]
  execution_modes: ComputerExecutionMode[]
  strict_background: boolean
  semantic_input: boolean
  raw_input: boolean
  streaming: boolean
  clipboard: boolean
  shell: boolean
  files: boolean
  audio: boolean
  mobile: boolean
  max_concurrency: number
  limitations: string[]
  tools?: string[]
}

export interface HistoryStatusResponse {
  supported: boolean
  admitted: boolean
  enabled: boolean
  paused: boolean
  encrypted: boolean
  profile: string
  retention_days: number
  quota_bytes: number
  bytes_used: number
  dropped_events: number
  health: string
}

export interface HistoryQueryRequest {
  limit?: number
  session_id?: string
  since_sequence?: number
  until_sequence?: number
}

export interface HistoryQueryResponse {
  events: Record<string, unknown>[]
  metadata_only: boolean
  model_context_disclosure: boolean
}

export interface CanonicalProviderDiagnostic {
  available: boolean
  reason?: string
  message?: string
  executable?: string
  version?: string
  telemetry_enabled?: boolean
  telemetry_managed_by_allternit?: boolean
}

export interface CanonicalProviderCatalog {
  providers: CanonicalComputerCapabilityManifest[]
  diagnostics: Record<string, CanonicalProviderDiagnostic>
}

export interface CanonicalComputerElement {
  ref: string
  role: string
  name: string
  value: string
  description: string
  bounds?: { x: number; y: number; width: number; height: number } | null
  states: string[]
  actions: string[]
  children: CanonicalComputerElement[]
  provider_metadata: Record<string, unknown>
}

export interface CanonicalComputerObservation {
  state_id: string
  session_id: string
  environment_id: string
  resource_id: string
  epoch: number
  captured_at: string
  provider_id: string
  provider_version: string
  roots: Array<Record<string, unknown>>
  elements: CanonicalComputerElement[]
  image?: { artifact_id: string; media_type: string; width: number; height: number; sha256: string; coordinate_space: string } | null
  truncated: boolean
  metadata: Record<string, unknown>
}

export interface CanonicalComputerRootDiscovery {
  session_id: string
  environment_id: string
  providers: Record<string, Array<Record<string, unknown>>>
}

export interface CanonicalComputerTransaction {
  transaction_id: string
  session_id: string
  environment_id: string
  resource_id: string
  base_state_id: string
  mode: ComputerExecutionMode
  steps: Array<{
    action: string
    target?: { ref?: string | null; x?: number | null; y?: number | null; root_id?: string | null } | null
    arguments: Record<string, unknown>
  }>
  postcondition?: { kind: "text" | "role" | "value" | "visible" | "focused"; value: string; gone: boolean; timeout_ms: number } | null
  approval_id?: string | null
}

export interface CanonicalComputerOutcome {
  transaction_id: string
  status: ComputerOutcomeStatus
  step_outcomes: Array<Record<string, unknown>>
  stopped_at: number | null
  successor_state_id: string | null
  receipt_id?: string | null
  receipt?: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface CanonicalComputerApprovalGrant {
  approval_id: string
  action_hash: string
  approved_by: string
  issued_at: number
  expires_at: number
}

export interface CanonicalComputerEnvironment {
  environment_id: string
  owner_id: string
  provider_id: string
  os: "macos" | "windows" | "linux" | "android"
  isolation: "host" | "container" | "vm"
  state: "requested" | "provisioning" | "running" | "stopping" | "stopped" | "failed" | "destroyed"
  image_digest?: string | null
  created_at: string
  updated_at: string
  expires_at?: string | null
  metadata: Record<string, unknown>
}

export interface CanonicalEnvironmentProviderManifest {
  provider_id: string
  operating_systems: string[]
  isolations: string[]
  available: boolean
  reason?: string | null
  capabilities: string[]
}

export interface CanonicalEnvironmentLease {
  lease_id: string
  environment_id: string
  holder_id: string
  kind: "agent" | "human_takeover"
  issued_at: string
  expires_at: string
}

export interface ComputerUseRequest {
  mode: 'intent' | 'direct' | 'assist'
  task: string
  session_id?: string
  run_id?: string
  target_scope?: 'browser' | 'desktop' | 'hybrid' | 'auto'
  options?: Record<string, unknown>
  context?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface ComputerUseResponse {
  run_id: string
  session_id: string
  status: string
  mode: string
  target_scope: string
  summary?: string
  result?: Record<string, unknown> | null
  error?: string | null
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

export interface CompatibilityComputerActionRequest {
  [key: string]: unknown
  action: string
  session_id: string
  run_id?: string
  parameters?: Record<string, unknown>
  coordinate?: [number, number]
  text?: string
  key?: string
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
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/execute`, {
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

  async executeStream(request: ComputerUseRequest): Promise<Response> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/execute?stream=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Computer use stream failed: ${response.status} ${response.statusText}`)
    return response
  }

  /** Compatibility-only atomic action transport for products migrating to canonical transactions. */
  async executeCompatibilityAction(request: CompatibilityComputerActionRequest): Promise<Record<string, unknown>> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify({
        ...request,
        run_id: request.run_id ?? `sdk-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
        parameters: request.parameters ?? {},
      }),
    })
    if (!response.ok) throw new Error(`Compatibility action failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  /** Compatibility-only physical browser session creation; logical ownership remains canonical. */
  async createCompatibilitySession(): Promise<{ session_id: string }> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
    })
    if (!response.ok) throw new Error(`Compatibility session creation failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async listCanonicalProviders(): Promise<CanonicalComputerCapabilityManifest[]> {
    return (await this.getCanonicalProviderCatalog()).providers
  }

  async getCanonicalProviderCatalog(): Promise<CanonicalProviderCatalog> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/providers`, {
      method: "GET",
      headers: this.headers,
    })
    if (!response.ok) throw new Error(`Provider discovery failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async observeCanonical(request: {
    provider_id?: string
    session_id: string
    environment_id?: string
    resource_id?: string
  }): Promise<CanonicalComputerObservation> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/observe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Canonical observation failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async findCanonicalRoots(request: {
    session_id: string
    environment_id?: string
    provider_id?: string
  }): Promise<CanonicalComputerRootDiscovery> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/roots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Canonical root discovery failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async executeCanonicalTransaction(
    transaction: CanonicalComputerTransaction,
    providerId = "browser.playwright.canonical",
  ): Promise<CanonicalComputerOutcome> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify({ provider_id: providerId, transaction }),
    })
    if (!response.ok) throw new Error(`Canonical transaction failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async approveCanonicalTransaction(
    transaction: CanonicalComputerTransaction,
    approvedBy: string,
    ttlSeconds = 120,
  ): Promise<CanonicalComputerApprovalGrant> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/approvals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify({ transaction, approved_by: approvedBy, ttl_seconds: ttlSeconds }),
    })
    if (!response.ok) throw new Error(`Canonical approval failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async canonicalHistoryStatus(providerId = "desktop.cua-driver"): Promise<HistoryStatusResponse> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/history/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify({ provider_id: providerId }),
    })
    if (!response.ok) throw new Error(`Canonical history status failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async canonicalHistoryQuery(
    request: HistoryQueryRequest,
    providerId = "desktop.cua-driver",
  ): Promise<HistoryQueryResponse> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/history/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify({ provider_id: providerId, ...request }),
    })
    if (!response.ok) throw new Error(`Canonical history query failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async getCanonicalEvents(sessionId: string, afterSequence = 0): Promise<unknown> {
    const response = await this.fetch(
      `${this.baseUrl}/v1/computer-use/canonical/sessions/${encodeURIComponent(sessionId)}/events?after_sequence=${afterSequence}`,
      { method: "GET", headers: this.headers },
    )
    if (!response.ok) throw new Error(`Canonical event query failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async listCanonicalEnvironmentProviders(): Promise<CanonicalEnvironmentProviderManifest[]> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environment-providers`, {
      method: "GET", headers: this.headers,
    })
    if (!response.ok) throw new Error(`Environment provider discovery failed: ${response.status} ${response.statusText}`)
    return ((await response.json()) as { providers: CanonicalEnvironmentProviderManifest[] }).providers
  }

  async createCanonicalEnvironment(request: {
    owner_id: string
    provider_id: string
    os: string
    isolation: string
    image_digest?: string
    ttl_seconds?: number
    metadata?: Record<string, unknown>
  }): Promise<CanonicalComputerEnvironment> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/environments`, {
      method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Environment creation failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async approveCanonicalEnvironmentOperation(request: {
    environment_id: string
    holder_id: string
    operation: string
    payload: Record<string, unknown>
    approved_by: string
    ttl_seconds?: number
  }): Promise<{ approval_id: string; operation_hash: string; approved_by: string; expires_at: number }> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical/operation-approvals`, {
      method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error(`Operation approval failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async provisionCanonicalEnvironment(
    environmentId: string,
    control: { lease_id: string; holder_id: string; approval_id: string },
  ): Promise<CanonicalComputerEnvironment> {
    const response = await this.fetch(
      `${this.baseUrl}/v1/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/provision`,
      { method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(control) },
    )
    if (!response.ok) throw new Error(`Environment provisioning failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async stopCanonicalEnvironment(
    environmentId: string,
    control: { lease_id: string; holder_id: string; approval_id: string },
  ): Promise<CanonicalComputerEnvironment> {
    const response = await this.fetch(
      `${this.baseUrl}/v1/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/stop`,
      { method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(control) },
    )
    if (!response.ok) throw new Error(`Environment stop failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async acquireCanonicalEnvironmentLease(
    environmentId: string,
    holderId: string,
    kind: "agent" | "human_takeover",
    ttlSeconds = 300,
  ): Promise<CanonicalEnvironmentLease> {
    const response = await this.fetch(
      `${this.baseUrl}/v1/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/leases`,
      {
        method: "POST", headers: { "Content-Type": "application/json", ...this.headers },
        body: JSON.stringify({ holder_id: holderId, kind, ttl_seconds: ttlSeconds }),
      },
    )
    if (!response.ok) throw new Error(`Environment lease failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async getCanonicalTrajectory(sessionId: string): Promise<Record<string, unknown>> {
    const response = await this.fetch(
      `${this.baseUrl}/v1/computer-use/canonical/sessions/${encodeURIComponent(sessionId)}/trajectory`,
      { method: "GET", headers: this.headers },
    )
    if (!response.ok) throw new Error(`Canonical trajectory failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  private async canonicalPost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/canonical${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", ...this.headers }, body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Canonical operation failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async releaseCanonicalEnvironmentLease(leaseId: string, holderId: string): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/leases/${encodeURIComponent(leaseId)}/release`, { holder_id: holderId })
  }

  async executeCanonicalEnvironmentCommand(environmentId: string, request: {
    command: string[]; env?: Record<string, string>; secret_refs?: Record<string, string>;
    lease_id: string; holder_id: string; approval_id: string
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/exec`, request)
  }

  async readCanonicalEnvironmentFile(environmentId: string, request: {
    path: string; lease_id: string; holder_id: string
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/files/read`, request)
  }

  async writeCanonicalEnvironmentFile(environmentId: string, request: {
    path: string; content: string; lease_id: string; holder_id: string; approval_id: string
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/files/write`, request)
  }

  async canonicalEnvironmentClipboard(environmentId: string, request: {
    lease_id: string; holder_id: string; text?: string; approval_id?: string
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/clipboard`, request)
  }

  async executeCanonicalMobileAction(environmentId: string, request: {
    action: string; arguments?: Record<string, unknown>; lease_id: string; holder_id: string; approval_id: string
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/mobile/actions`, request)
  }

  async watch(options: WatchOptions): Promise<Response> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${options.runId}/events`, {
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
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}`, {
      method: "GET",
      headers: this.headers,
    })
    if (!response.ok) {
      throw new Error(`Get receipts failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getSnapshot(runId: string): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}`, {
      method: "GET",
      headers: this.headers,
    })
    if (!response.ok) {
      throw new Error(`Get snapshot failed: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async approveRun(runId: string, options: ApprovalOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/approve`, {
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
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/approve`, {
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
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/cancel`, {
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

  async captureRunScreenshot(runId: string): Promise<{ screenshot_b64?: string }> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${encodeURIComponent(runId)}/screenshot`, {
      method: "POST", headers: this.headers,
    })
    if (!response.ok) throw new Error(`Screenshot failed: ${response.status} ${response.statusText}`)
    return response.json()
  }

  async pauseRun(runId: string, options: CancelOptions = {}): Promise<unknown> {
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/pause`, {
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
    const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/resume`, {
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
      const response = await this.fetch(`${this.baseUrl}/v1/computer-use/runs/${runId}/events?after_index=${nextIndex}`, {
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
