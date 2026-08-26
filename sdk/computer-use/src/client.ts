/**
 * Allternit Computer Use Engine - TypeScript SDK Client
 * 
 * HTTP client wrapper for the canonical engine HTTP API.
 * Thin transport layer - no business logic, just HTTP transport.
 */

import {
  ClientConfig,
  ExecuteShortcutOptions,
  EngineMode,
  EngineAction,
  ExecuteResponse,
  SessionCreateResponse,
  SessionResponse,
  SessionCloseResponse,
  ApprovalRequest,
  ApprovalResponse,
  PendingApprovalResponse,
  ControlResponse,
  RunStatusResponse,
  RunEventsResponse,
  RunsListResponse,
  SessionsListResponse,
  SessionCreateRequest,
  ControlRequest,
  BrowserTaskRequest,
  BrowserTaskResponse,
  BrowserTaskDetailResponse,
  BrowserTaskExecuteRequest,
  BrowserTaskExecuteResponse,
  BrowserSearchRequest,
  BrowserRetrieveRequest,
  BrowserHealthResponse,
  VisionProposeRequest,
  VisionProposeResponse,
  VisionScreenshotResponse,
  DesktopExecuteRequest,
  DesktopExecuteResponse,
  ParallelRunRequest,
  ParallelRunStatus,
  ParallelRunResults,
  TelemetryProviderInfo,
  TelemetrySnapshot,
} from './types';
import { EventStream } from './events';
import { normalizeEndpoint, buildRequestHeaders, handleApiError } from './utils';
import type {
  ComputerActionTransaction,
  ComputerApprovalGrant,
  ComputerCapabilityManifest,
  ComputerEnvironmentRecord,
  ComputerEnvironmentLease,
  ComputerEnvironmentProviderManifest,
  ComputerHistoryQueryRequest,
  ComputerHistoryQueryResponse,
  ComputerHistoryStatusResponse,
  ComputerImageRecord,
  ComputerObservation,
  ComputerRootDiscovery,
  ComputerTransactionOutcome,
  HistoryQueryRequest,
  HistoryQueryResponse,
  HistoryStatusResponse,
} from './canonical';

/**
 * Main client for the Allternit Computer Use Engine HTTP API.
 */
export class AllternitComputerUseClient {
  private endpoint: string;
  private apiKey?: string;
  private headers: Record<string, string>;

  /**
   * Event stream manager for SSE subscriptions.
   * Lazily initialized on first use.
   */
  private _eventStream?: EventStream;

  /**
   * Create a new client instance.
   * 
   * @param config - Client configuration
   */
  constructor(config: ClientConfig) {
    this.endpoint = normalizeEndpoint(config.endpoint);
    this.apiKey = config.apiKey;
    this.headers = config.headers ?? {};
  }

  /**
   * Get the event stream manager (lazy initialization).
   */
  private get eventStream(): EventStream {
    if (!this._eventStream) {
      this._eventStream = new EventStream(this.endpoint, this.apiKey, this.headers);
    }
    return this._eventStream;
  }

  // ===========================================================================
  // Core Execute Endpoint
  // ===========================================================================

  /** Discover canonical providers and their enforceable capabilities. */
  async listCanonicalProviders(): Promise<ComputerCapabilityManifest[]> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/providers`, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });
    if (!response.ok) await handleApiError(response);
    const body = await response.json() as { providers: ComputerCapabilityManifest[] };
    return body.providers;
  }

  /** Capture and persist one immutable canonical observation. */
  async observeCanonical(request: {
    provider_id?: string;
    session_id: string;
    environment_id?: string;
    resource_id?: string;
  }): Promise<ComputerObservation> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/observe`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerObservation>;
  }

  /** Discover browser and native roots across canonical providers. */
  async findCanonicalRoots(request: {
    session_id: string;
    environment_id?: string;
    provider_id?: string;
  }): Promise<ComputerRootDiscovery> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/roots`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerRootDiscovery>;
  }

  /** Execute a state-bound canonical transaction. */
  async executeCanonicalTransaction(
    transaction: ComputerActionTransaction,
    providerId = 'browser.playwright.canonical',
  ): Promise<ComputerTransactionOutcome> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/transactions`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify({ provider_id: providerId, transaction }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerTransactionOutcome>;
  }

  /** Issue a short-lived, single-use approval bound to an exact transaction. */
  async approveCanonicalTransaction(
    transaction: ComputerActionTransaction,
    approvedBy: string,
    ttlSeconds = 120,
  ): Promise<ComputerApprovalGrant> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/approvals`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify({
        transaction,
        approved_by: approvedBy,
        ttl_seconds: ttlSeconds,
      }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerApprovalGrant>;
  }

  /** Check whether CUA Driver Computer History is available and enabled.
   *
   * Requires the `desktop.cua-driver` provider to advertise history tools.
   */
  async canonicalHistoryStatus(providerId = 'desktop.cua-driver'): Promise<HistoryStatusResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/history/status`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify({ provider_id: providerId }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<HistoryStatusResponse>;
  }

  /** Query a bounded, metadata-only slice of CUA Driver Computer History.
   *
   * Use this for continuation/recent-work context. Results are metadata-only;
   * do not treat them as a full transcript.
   */
  async canonicalHistoryQuery(
    request: HistoryQueryRequest,
    providerId = 'desktop.cua-driver',
  ): Promise<HistoryQueryResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/history/query`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify({ provider_id: providerId, ...request }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<HistoryQueryResponse>;
  }

  async listCanonicalEnvironmentProviders(): Promise<ComputerEnvironmentProviderManifest[]> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/environment-providers`, {
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });
    if (!response.ok) await handleApiError(response);
    return (await response.json() as { providers: ComputerEnvironmentProviderManifest[] }).providers;
  }

  async registerCanonicalImage(request: {
    source: string; os: string; architecture: string; digest: string;
    provenance?: Record<string, unknown>; scan_status?: string;
  }): Promise<ComputerImageRecord> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/images`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey), body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerImageRecord>;
  }

  async createCanonicalEnvironment(request: {
    owner_id: string; provider_id: string; os: string; isolation: string;
    image_digest?: string; ttl_seconds?: number; metadata?: Record<string, unknown>;
  }): Promise<ComputerEnvironmentRecord> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/environments`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey), body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerEnvironmentRecord>;
  }

  async approveCanonicalEnvironmentOperation(request: {
    environment_id: string; holder_id: string; operation: string;
    payload: Record<string, unknown>; approved_by: string; ttl_seconds?: number;
  }): Promise<{ approval_id: string; operation_hash: string; approved_by: string; expires_at: number }> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/operation-approvals`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey), body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json();
  }

  async provisionCanonicalEnvironment(
    environmentId: string, control: { lease_id: string; holder_id: string; approval_id: string },
  ): Promise<ComputerEnvironmentRecord> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/provision`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey), body: JSON.stringify(control),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerEnvironmentRecord>;
  }

  async stopCanonicalEnvironment(
    environmentId: string, control: { lease_id: string; holder_id: string; approval_id: string },
  ): Promise<ComputerEnvironmentRecord> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/stop`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey), body: JSON.stringify(control),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerEnvironmentRecord>;
  }

  async acquireCanonicalEnvironmentLease(
    environmentId: string, holderId: string, kind: 'agent' | 'human_takeover', ttlSeconds = 300,
  ): Promise<ComputerEnvironmentLease> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/environments/${encodeURIComponent(environmentId)}/leases`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify({ holder_id: holderId, kind, ttl_seconds: ttlSeconds }),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerEnvironmentLease>;
  }

  async getCanonicalTrajectory(sessionId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/sessions/${encodeURIComponent(sessionId)}/trajectory`, {
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<Record<string, unknown>>;
  }

  /** Check whether CUA Driver Computer History is available and enabled. */
  async canonicalHistoryStatus(): Promise<ComputerHistoryStatusResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/history/status`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify({}),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerHistoryStatusResponse>;
  }

  /** Query a bounded slice of CUA Driver Computer History metadata events. */
  async canonicalHistoryQuery(request: ComputerHistoryQueryRequest = {}): Promise<ComputerHistoryQueryResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical/history/query`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ComputerHistoryQueryResponse>;
  }

  private async canonicalPost(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.endpoint}/computer-use/canonical${path}`, {
      method: 'POST', headers: buildRequestHeaders(this.headers, this.apiKey), body: JSON.stringify(body),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<Record<string, unknown>>;
  }

  releaseCanonicalEnvironmentLease(leaseId: string, holderId: string): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/leases/${encodeURIComponent(leaseId)}/release`, { holder_id: holderId });
  }

  executeCanonicalEnvironmentCommand(environmentId: string, request: {
    command: string[]; env?: Record<string, string>; secret_refs?: Record<string, string>;
    lease_id: string; holder_id: string; approval_id: string;
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/exec`, request);
  }

  readCanonicalEnvironmentFile(environmentId: string, request: {
    path: string; lease_id: string; holder_id: string;
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/files/read`, request);
  }

  writeCanonicalEnvironmentFile(environmentId: string, request: {
    path: string; content: string; lease_id: string; holder_id: string; approval_id: string;
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/files/write`, request);
  }

  canonicalEnvironmentClipboard(environmentId: string, request: {
    lease_id: string; holder_id: string; text?: string; approval_id?: string;
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/clipboard`, request);
  }

  executeCanonicalMobileAction(environmentId: string, request: {
    action: string; arguments?: Record<string, unknown>; lease_id: string; holder_id: string; approval_id: string;
  }): Promise<Record<string, unknown>> {
    return this.canonicalPost(`/environments/${encodeURIComponent(environmentId)}/mobile/actions`, request);
  }

  /**
   * Execute a canonical engine request.
   * 
   * POST /v1/execute
   * 
   * @param request - The execution request
   * @returns Promise resolving to the execution result
   */
  async execute(request: {
    mode: EngineMode;
    run_id?: string;
    session_id?: string;
    target_scope?: string;
    task?: string;
    actions?: EngineAction[];
    options?: Record<string, unknown>;
    context?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }): Promise<ExecuteResponse> {
    // Routes to the ACU planning loop + waterfall (extension → CDP → playwright → desktop)
    const response = await fetch(`${this.endpoint}/computer-use/execute`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<ExecuteResponse>;
  }

  /**
   * Execute in direct mode with explicit actions.
   * 
   * Shortcut for execute() with mode='direct'.
   * 
   * @param actions - Array of actions to execute
   * @param options - Execution options
   * @returns Promise resolving to the execution result
   */
  async executeDirect(
    actions: EngineAction[],
    options: ExecuteShortcutOptions = {}
  ): Promise<ExecuteResponse> {
    const {
      target_scope = 'auto',
      session_id,
      run_id,
      context = {},
      metadata,
      ...engineOptions
    } = options;

    return this.execute({
      mode: 'direct',
      run_id,
      session_id,
      target_scope,
      actions,
      options: engineOptions,
      context,
      metadata,
    });
  }

  /**
   * Execute in intent mode with a natural language task.
   * 
   * Shortcut for execute() with mode='intent'.
   * 
   * @param task - Natural language task description
   * @param options - Execution options
   * @returns Promise resolving to the execution result
   */
  async executeIntent(
    task: string,
    options: ExecuteShortcutOptions = {}
  ): Promise<ExecuteResponse> {
    const {
      target_scope = 'auto',
      session_id,
      run_id,
      context = {},
      metadata,
      ...engineOptions
    } = options;

    return this.execute({
      mode: 'intent',
      run_id,
      session_id,
      target_scope,
      task,
      options: engineOptions,
      context,
      metadata,
    });
  }

  /**
   * Execute in assist mode requiring explicit approval.
   * 
   * Shortcut for execute() with mode='assist'.
   * 
   * @param task - Natural language task description
   * @param options - Execution options
   * @returns Promise resolving to the execution result (may need approval)
   */
  async executeAssist(
    task: string,
    options: ExecuteShortcutOptions = {}
  ): Promise<ExecuteResponse> {
    const {
      target_scope = 'auto',
      session_id,
      run_id,
      context = {},
      metadata,
      ...engineOptions
    } = options;

    return this.execute({
      mode: 'assist',
      run_id,
      session_id,
      target_scope,
      task,
      options: {
        ...engineOptions,
        approvals: 'always',
      },
      context,
      metadata,
    });
  }

  // ===========================================================================
  // Run Status Endpoints
  // ===========================================================================

  /**
   * Get the status and results of a run.
   * 
   * GET /v1/runs/{run_id}
   * 
   * @param runId - The run ID
   * @returns Promise resolving to the run status
   */
  async getRun(runId: string): Promise<RunStatusResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/runs/${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<RunStatusResponse>;
  }

  /**
   * List all runs, optionally filtered by session or status.
   * 
   * GET /v1/runs
   * 
   * @param sessionId - Optional session ID filter
   * @param status - Optional status filter
   * @returns Promise resolving to the list of runs
   */
  async listRuns(
    sessionId?: string,
    status?: string
  ): Promise<RunsListResponse> {
    const params = new URLSearchParams();
    if (sessionId) params.set('session_id', sessionId);
    if (status) params.set('status', status);

    const url = `${this.endpoint}/computer-use/runs${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<RunsListResponse>;
  }

  /**
   * Get the event history for a run.
   * 
   * GET /v1/runs/{run_id}/events
   * 
   * @param runId - The run ID
   * @param afterIndex - Start from a specific event index
   * @returns Promise resolving to the event history
   */
  async getRunEvents(
    runId: string,
    afterIndex: number = 0
  ): Promise<RunEventsResponse> {
    const url = `${this.endpoint}/runs/${encodeURIComponent(runId)}/events?after_index=${afterIndex}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<RunEventsResponse>;
  }

  // ===========================================================================
  // Control Endpoints
  // ===========================================================================

  /**
   * Cancel an active run.
   * 
   * POST /v1/runs/{run_id}/cancel
   * 
   * @param runId - The run ID
   * @param request - Optional control request with actor_id and comment
   * @returns Promise resolving to the control response
   */
  async cancelRun(
    runId: string,
    request?: ControlRequest
  ): Promise<ControlResponse> {
    const response = await fetch(
      `${this.endpoint}/runs/${encodeURIComponent(runId)}/cancel`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: request ? JSON.stringify(request) : undefined,
      }
    );

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<ControlResponse>;
  }

  /**
   * Pause an active run.
   * 
   * POST /v1/runs/{run_id}/pause
   * 
   * @param runId - The run ID
   * @param request - Optional control request with actor_id and comment
   * @returns Promise resolving to the control response
   */
  async pauseRun(
    runId: string,
    request?: ControlRequest
  ): Promise<ControlResponse> {
    const response = await fetch(
      `${this.endpoint}/runs/${encodeURIComponent(runId)}/pause`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: request ? JSON.stringify(request) : undefined,
      }
    );

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<ControlResponse>;
  }

  /**
   * Resume a paused run.
   * 
   * POST /v1/runs/{run_id}/resume
   * 
   * @param runId - The run ID
   * @param request - Optional control request with actor_id and comment
   * @returns Promise resolving to the control response
   */
  async resumeRun(
    runId: string,
    request?: ControlRequest
  ): Promise<ControlResponse> {
    const response = await fetch(
      `${this.endpoint}/runs/${encodeURIComponent(runId)}/resume`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: request ? JSON.stringify(request) : undefined,
      }
    );

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<ControlResponse>;
  }

  // ===========================================================================
  // Approval Endpoints
  // ===========================================================================

  /**
   * Submit an approval response for a run awaiting approval.
   * 
   * POST /v1/approve/{run_id}
   * 
   * @param runId - The run ID
   * @param approval - The approval request with decision
   * @returns Promise resolving to the approval response
   */
  async approve(
    runId: string,
    approval: ApprovalRequest
  ): Promise<ApprovalResponse> {
    const response = await fetch(
      `${this.endpoint}/computer-use/runs/${encodeURIComponent(runId)}/approve`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: JSON.stringify(approval),
      }
    );

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<ApprovalResponse>;
  }

  /**
   * Get the pending approval request for a run, if any.
   *
   * GET /v1/runs/{run_id}/approval
   *
   * @param runId - The run ID
   * @returns Promise resolving to the pending approval status
   */
  async getPendingApproval(runId: string): Promise<PendingApprovalResponse> {
    const response = await fetch(
      `${this.endpoint}/runs/${encodeURIComponent(runId)}/approval`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey),
      }
    );

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<PendingApprovalResponse>;
  }

  // ===========================================================================
  // Session Endpoints
  // ===========================================================================

  /**
   * Create a new session for grouping related runs.
   * 
   * POST /v1/sessions
   * 
   * @param request - Optional session creation request
   * @returns Promise resolving to the session creation response
   */
  async createSession(
    request?: SessionCreateRequest
  ): Promise<SessionCreateResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/sessions`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: request ? JSON.stringify(request) : undefined,
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<SessionCreateResponse>;
  }

  /**
   * Get the current state of a session.
   * 
   * GET /v1/sessions/{session_id}
   * 
   * @param sessionId - The session ID
   * @returns Promise resolving to the session state
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    const response = await fetch(
      `${this.endpoint}/computer-use/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey, false),
      }
    );

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<SessionResponse>;
  }

  /**
   * Close a session.
   * 
   * DELETE /v1/sessions/{session_id}
   * 
   * @param sessionId - The session ID
   * @param cleanup - Whether to clean up associated resources
   * @returns Promise resolving to the session close response
   */
  async closeSession(
    sessionId: string,
    cleanup: boolean = false
  ): Promise<SessionCloseResponse> {
    const url = `${this.endpoint}/computer-use/sessions/${encodeURIComponent(sessionId)}?cleanup=${cleanup}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<SessionCloseResponse>;
  }

  /**
   * List all active sessions.
   * 
   * GET /v1/sessions
   * 
   * @returns Promise resolving to the list of sessions
   */
  async listSessions(): Promise<SessionsListResponse> {
    const response = await fetch(`${this.endpoint}/computer-use/sessions`, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response.json() as Promise<SessionsListResponse>;
  }

  // ===========================================================================
  // Event Streaming
  // ===========================================================================

  /**
   * Subscribe to events for a run via SSE.
   * 
   * GET /v1/stream/{run_id}
   * 
   * @param runId - The run ID to subscribe to
   * @param callback - Function called for each event
   * @param options - Subscription options
   * @returns Unsubscribe function
   */
  subscribeToRun(
    runId: string,
    callback: (event: import('./types').EngineEvent) => void | Promise<void>,
    options?: import('./types').SubscribeOptions
  ): () => void {
    return this.eventStream.subscribe(runId, callback, options);
  }

  /**
   * Wait for a run to complete and return the final result.
   * 
   * @param runId - The run ID
   * @returns Promise that resolves when the run completes
   */
  waitForRun(runId: string): Promise<import('./types').EngineEvent> {
    return this.eventStream.waitForRun(runId);
  }

  /**
   * Wait for an approval request for a run.
   *
   * @param runId - The run ID
   * @returns Promise that resolves when an approval is requested
   */
  waitForApproval(runId: string): Promise<import('./types').EngineEvent> {
    return this.eventStream.waitForApproval(runId);
  }

  // ===========================================================================
  // Browser Automation Endpoints
  // ===========================================================================

  /** GET /v1/browser/health */
  async getBrowserHealth(): Promise<BrowserHealthResponse> {
    const response = await fetch(`${this.endpoint}/browser/health`, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<BrowserHealthResponse>;
  }

  /** POST /v1/browser/tasks */
  async createBrowserTask(request: BrowserTaskRequest): Promise<BrowserTaskResponse> {
    const response = await fetch(`${this.endpoint}/browser/tasks`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<BrowserTaskResponse>;
  }

  /** POST /v1/browser/tasks/{task_id}/execute */
  async executeBrowserTask(
    taskId: string,
    request?: BrowserTaskExecuteRequest
  ): Promise<BrowserTaskExecuteResponse> {
    const response = await fetch(
      `${this.endpoint}/browser/tasks/${encodeURIComponent(taskId)}/execute`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: request ? JSON.stringify(request) : undefined,
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<BrowserTaskExecuteResponse>;
  }

  /** GET /v1/browser/tasks/{task_id} */
  async getBrowserTask(taskId: string): Promise<BrowserTaskDetailResponse> {
    const response = await fetch(
      `${this.endpoint}/browser/tasks/${encodeURIComponent(taskId)}`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey, false),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<BrowserTaskDetailResponse>;
  }

  /** POST /v1/browser/search */
  async browserSearch(request: BrowserSearchRequest): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.endpoint}/browser/search`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<Record<string, unknown>>;
  }

  /** POST /v1/browser/retrieve */
  async browserRetrieve(request: BrowserRetrieveRequest): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.endpoint}/browser/retrieve`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<Record<string, unknown>>;
  }

  // ===========================================================================
  // Vision Endpoints
  // ===========================================================================

  /** POST /v1/vision/propose */
  async visionPropose(request: VisionProposeRequest): Promise<VisionProposeResponse> {
    const response = await fetch(`${this.endpoint}/vision/propose`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<VisionProposeResponse>;
  }

  /** GET /v1/vision/screenshot */
  async visionScreenshot(): Promise<VisionScreenshotResponse> {
    const response = await fetch(`${this.endpoint}/vision/screenshot`, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<VisionScreenshotResponse>;
  }

  // ===========================================================================
  // Desktop Control Endpoints
  // ===========================================================================

  /** POST /v1/sessions/{session_id}/desktop/execute */
  async desktopExecute(request: DesktopExecuteRequest): Promise<DesktopExecuteResponse> {
    const response = await fetch(
      `${this.endpoint}/sessions/${encodeURIComponent(request.session_id)}/desktop/execute`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: JSON.stringify(request),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<DesktopExecuteResponse>;
  }

  /** POST /v1/sessions/{session_id}/computer/execute */
  async computerExecute(request: DesktopExecuteRequest): Promise<DesktopExecuteResponse> {
    const response = await fetch(
      `${this.endpoint}/sessions/${encodeURIComponent(request.session_id)}/computer/execute`,
      {
        method: 'POST',
        headers: buildRequestHeaders(this.headers, this.apiKey),
        body: JSON.stringify(request),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<DesktopExecuteResponse>;
  }

  // ===========================================================================
  // Parallel Runs Endpoints
  // ===========================================================================

  /** POST /v1/parallel/runs */
  async createParallelRun(request: ParallelRunRequest): Promise<{ run_id: string }> {
    const response = await fetch(`${this.endpoint}/parallel/runs`, {
      method: 'POST',
      headers: buildRequestHeaders(this.headers, this.apiKey),
      body: JSON.stringify(request),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<{ run_id: string }>;
  }

  /** GET /v1/parallel/runs/{run_id}/status */
  async getParallelRunStatus(runId: string): Promise<ParallelRunStatus> {
    const response = await fetch(
      `${this.endpoint}/parallel/runs/${encodeURIComponent(runId)}/status`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey, false),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ParallelRunStatus>;
  }

  /** GET /v1/parallel/runs/{run_id}/results */
  async getParallelRunResults(runId: string): Promise<ParallelRunResults> {
    const response = await fetch(
      `${this.endpoint}/parallel/runs/${encodeURIComponent(runId)}/results`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey, false),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<ParallelRunResults>;
  }

  /** GET /v1/parallel/runs/{run_id}/events (SSE) — returns raw response for caller to stream */
  async getParallelRunEvents(runId: string): Promise<Response> {
    const response = await fetch(
      `${this.endpoint}/parallel/runs/${encodeURIComponent(runId)}/events`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey, false),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response;
  }

  // ===========================================================================
  // Telemetry Endpoints
  // ===========================================================================

  /** GET /v1/telemetry/providers */
  async getTelemetryProviders(): Promise<TelemetryProviderInfo[]> {
    const response = await fetch(`${this.endpoint}/telemetry/providers`, {
      method: 'GET',
      headers: buildRequestHeaders(this.headers, this.apiKey, false),
    });
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<TelemetryProviderInfo[]>;
  }

  /** GET /v1/telemetry/sessions/{session_id} */
  async getTelemetrySession(sessionId: string): Promise<TelemetrySnapshot> {
    const response = await fetch(
      `${this.endpoint}/telemetry/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
        headers: buildRequestHeaders(this.headers, this.apiKey, false),
      }
    );
    if (!response.ok) await handleApiError(response);
    return response.json() as Promise<TelemetrySnapshot>;
  }
}
