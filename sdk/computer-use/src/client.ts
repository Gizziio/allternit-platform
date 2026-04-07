/**
 * A2R Computer Use Engine - TypeScript SDK Client
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
} from './types';
import { EventStream } from './events';
import { normalizeEndpoint, buildRequestHeaders, handleApiError } from './utils';

/**
 * Main client for the A2R Computer Use Engine HTTP API.
 */
export class A2RComputerUseClient {
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
    const response = await fetch(`${this.endpoint}/execute`, {
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
    const response = await fetch(`${this.endpoint}/runs/${encodeURIComponent(runId)}`, {
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

    const url = `${this.endpoint}/runs${params.toString() ? `?${params.toString()}` : ''}`;

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
      `${this.endpoint}/approve/${encodeURIComponent(runId)}`,
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
    const response = await fetch(`${this.endpoint}/sessions`, {
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
      `${this.endpoint}/sessions/${encodeURIComponent(sessionId)}`,
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
    const url = `${this.endpoint}/sessions/${encodeURIComponent(sessionId)}?cleanup=${cleanup}`;

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
    const response = await fetch(`${this.endpoint}/sessions`, {
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
}
