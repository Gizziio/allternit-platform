"use client";

import { getDefaultAgentModel } from "@/lib/agents/agent-models";

/**
 * Allternit API Client - Canonical Enterprise Implementation
 * 
 * This is the ONLY authorized way for the UI to communicate with the backend.
 * All requests MUST go through the Gateway (port 8013).
 * 
 * Architecture:
 *   UI → Gateway (8013) → API (3000) → [Kernel|Registry|Memory|Policy]
 * 
 * NEVER call the kernel directly. The kernel is an internal service only.
 * 
 * @module api-client
 * @version 2.0.0
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Allternit Gateway Base URL - Single Source of Truth
 * 
 * Set via environment variable: VITE_ALLTERNIT_GATEWAY_URL
 * Default: http://127.0.0.1:3210 (TypeScript gateway)
 * 
 * DO NOT use fallback logic. DO NOT use multiple ports.
 * All UI traffic goes through ONE gateway.
 */
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:8013';

const SELF_HOSTED_TOKEN = (import.meta as any).env?.VITE_ALLTERNIT_SELF_HOSTED_TOKEN;

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, '');
}

function stripApiV1Suffix(value: string): string {
  return value.replace(/\/api\/v1\/?$/i, '');
}

function normalizeGatewayCandidate(value: string): string {
  return stripTrailingSlash(stripApiV1Suffix(value));
}

function configuredGatewayUrl(): string {
  // SSR-safe: check for window existence before accessing
  const windowUrl = typeof window !== 'undefined' ? (window as any).__ALLTERNIT_GATEWAY_URL__ : undefined;
  const configured = windowUrl
    || (import.meta as any).env?.VITE_ALLTERNIT_GATEWAY_URL
    || DEFAULT_GATEWAY_URL;

  const normalized = normalizeGatewayCandidate(String(configured).trim());

  return normalized || DEFAULT_GATEWAY_URL;
}

function gatewayUrl(): string {
  const normalized = configuredGatewayUrl();

  // Use the configured gateway URL directly
  // Do NOT redirect to window.location.origin in dev - Vite doesn't proxy to backend
  return normalized || DEFAULT_GATEWAY_URL;
}

// Export for debugging
export const GATEWAY_BASE_URL = gatewayUrl();
export const GATEWAY_URL = GATEWAY_BASE_URL; // Consistent export
console.debug('[Allternit API Client] Using gateway URL:', GATEWAY_BASE_URL);

// Legacy alias for backward compatibility
export const ALLTERNIT_BASE_URL = GATEWAY_BASE_URL;

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Session {
  id: string;
  profile_id: string;
  status: 'active' | 'paused' | 'completed' | 'error';
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  definition: unknown;
  version: string;
  created_at: string;
}

export interface Capsule {
  id: string;
  name: string;
  version: string;
  description?: string;
  runtime: 'wasm' | 'python' | 'docker';
  status: 'active' | 'inactive';
}

export interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: unknown;
  error?: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  type?: 'orchestrator' | 'sub-agent' | 'worker' | 'specialist' | 'reviewer' | 'assistant';
  parentAgentId?: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'google' | 'local' | 'custom';
  capabilities: string[];
  systemPrompt?: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
  config: Record<string, unknown>;
  status: 'idle' | 'running' | 'paused' | 'error';
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  workspaceId?: string;
  avatar?: unknown;
  characterLayer?: unknown;
  trustTier?: 'safe' | 'low' | 'standard' | 'elevated' | 'admin' | 'critical';
  harness?: unknown;
  allowedSurfaces?: Array<'chat' | 'cowork' | 'code' | 'design' | 'browser'>;
  allowedSkills?: string[];
  allowedTools?: string[];
  category?: 'engineering' | 'design' | 'marketing' | 'product' | 'research' | 'operations' | 'creative' | 'general';
  tags?: string[];
  dataClassification?: string;
  writeScope?: string;
}

export interface InferenceRouterProviderModel {
  id: string;
  name: string;
  default?: boolean;
}

export interface InferenceRouterProvider {
  id: string;
  name: string;
  installed: boolean;
  available: boolean;
  reason?: string;
  models?: InferenceRouterProviderModel[];
}

export interface InferenceRouterCliStatusResponse {
  providers: InferenceRouterProvider[];
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface UsageSummaryTokens {
  input: number;
  output: number;
  total: number;
}

export interface UsageSummary {
  /** Billable requests served in the reporting period. */
  requests: number;
  /** Aggregate token consumption for the period. */
  tokens: UsageSummaryTokens;
  /** Total spend for the period, in `currency`. */
  cost: number;
  /** ISO 4217 currency code for `cost`. */
  currency: string;
  /** Optional reporting window bounds (ISO timestamps). */
  periodStart?: string;
  periodEnd?: string;
}

/**
 * Normalize the gateway's usage summary payload into a stable shape.
 * The backend has shipped a few field spellings over time; accept the common
 * ones so the UI never renders NaN.
 */
function normalizeUsageSummary(raw: unknown): UsageSummary {
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const tokensRecord = (record.tokens && typeof record.tokens === 'object'
    ? record.tokens
    : {}) as Record<string, unknown>;

  const toNumber = (value: unknown): number => {
    const n = typeof value === 'string' ? Number(value) : value;
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  };

  const input = toNumber(tokensRecord.input ?? record.input_tokens ?? record.tokens_input);
  const output = toNumber(tokensRecord.output ?? record.output_tokens ?? record.tokens_output);
  const total = toNumber(tokensRecord.total ?? record.total_tokens) || input + output;
  const cents = toNumber(record.total_cents);
  const cost = toNumber(record.cost ?? record.cost_usd ?? record.total_cost) || cents / 100;

  return {
    requests: toNumber(record.requests ?? record.total_requests ?? record.request_count),
    tokens: { input, output, total },
    cost,
    currency: typeof record.currency === 'string' && record.currency ? record.currency : 'USD',
    periodStart: typeof record.period_start === 'string' ? record.period_start : undefined,
    periodEnd: typeof record.period_end === 'string' ? record.period_end : undefined,
  };
}

// ============================================================================
// Error Handling
// ============================================================================

export class AllternitApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AllternitApiError';
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  isNotFound(): boolean {
    return this.statusCode === 404;
  }

  isRateLimit(): boolean {
    return this.statusCode === 429;
  }
}

// ============================================================================
// Event Streaming
// ============================================================================

export type EventType = 
  | 'session.created'
  | 'session.updated'
  | 'message.delta'
  | 'message.completed'
  | 'tool.call'
  | 'tool.result'
  | 'artifact.created'
  | 'error'
  | 'done';

export interface StreamEvent {
  type: EventType;
  data: unknown;
  timestamp: string;
}

export type EventHandler = (event: StreamEvent) => void;
export type ErrorHandler = (error: Error) => void;

// ============================================================================
// Main API Client
// ============================================================================

class AllternitApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private requestInterceptors: Array<(config: RequestInit) => RequestInit> = [];
  private responseInterceptors: Array<(response: Response) => Response> = [];

  constructor() {
    this.baseUrl = gatewayUrl();
    // SSR-safe: only access localStorage in browser
    this.token = typeof window !== 'undefined' ? localStorage.getItem('allternit_token') : null;
    
    console.debug('[AllternitApiClient] Initialized with gateway:', this.baseUrl);
  }

  private candidateBaseUrls(): string[] {
    const normalizedPrimary = String(this.baseUrl || '').trim().replace(/\/+$/, '');
    const normalizedConfigured = configuredGatewayUrl();
    const candidates = [normalizedPrimary];
    const isShellDevBrowser =
      typeof window !== 'undefined' && window.location.port === '5177';

    if (normalizedConfigured && normalizedConfigured !== normalizedPrimary) {
      candidates.push(normalizedConfigured);
    }

    // If shell-ui proxy is unavailable, fall back to direct API host.
    if (/^https?:\/\/(127\.0\.0\.1|localhost):5177$/i.test(normalizedPrimary)) {
      if (/^https?:\/\/(127\.0\.0\.1|localhost):3210$/i.test(normalizedConfigured)) {
        candidates.push(normalizedConfigured.replace(/:3210$/i, ':8013'));
        candidates.push(normalizedConfigured.replace(/127\.0\.0\.1/i, 'localhost'));
      }

      if (/^https?:\/\/(127\.0\.0\.1|localhost):8013$/i.test(normalizedConfigured)) {
        candidates.push(normalizedConfigured.replace(/127\.0\.0\.1/i, 'localhost'));
      }

      if (!isShellDevBrowser) {
        candidates.push('http://127.0.0.1:3000');
        candidates.push('http://localhost:3000');
      }
    }

    return Array.from(new Set(candidates.filter(Boolean)));
  }

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  setToken(token: string): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('allternit_token', token);
    }
  }

  clearToken(): void {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('allternit_token');
    }
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // --------------------------------------------------------------------------
  // Request Interceptors
  // --------------------------------------------------------------------------

  addRequestInterceptor(interceptor: (config: RequestInit) => RequestInit): void {
    this.requestInterceptors.push(interceptor);
  }

  addResponseInterceptor(interceptor: (response: Response) => Response): void {
    this.responseInterceptors.push(interceptor);
  }

  private async fetchWithRetry(url: string, config: RequestInit): Promise<Response> {
    const maxRetries = 1;
    const retryDelay = 500;
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, config);

        // Return response for all status codes - let caller handle 404s gracefully
        // This is expected when backend services are not running
        return response;
      } catch (error) {
        lastError = error;
        
        if (i === maxRetries - 1) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:offline', {
              detail: { url, error: String(error) }
            }));
          }
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, i)));
      }
    }

    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }

  // --------------------------------------------------------------------------
  // Core HTTP Method
  // --------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const pathNormalized = path.startsWith('/') ? path : `/${path}`;
    const candidateBases = this.candidateBaseUrls();
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Client-Version': '2.0.0',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(SELF_HOSTED_TOKEN ? { 'X-Allternit-Self-Hosted-Token': String(SELF_HOSTED_TOKEN) } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    // Build config
    let config: RequestInit = {
      method,
      headers,
      ...options,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      config = interceptor(config);
    }

    // Make request
    let response: Response | null = null;
    let lastNetworkError: unknown = null;
    let lastAttemptedUrl = '';

    for (let index = 0; index < candidateBases.length; index += 1) {
      const base = candidateBases[index];
      const url = `${base}${pathNormalized}`;
      lastAttemptedUrl = url;
      
      try {
        // Use retry-enabled fetch for the primary URL,
        // but perhaps skip retries for fallback loopback URLs if needed.
        const candidateResponse = await this.fetchWithRetry(url, config);

        if (candidateResponse.ok) {
          response = candidateResponse;
          if (base !== this.baseUrl) {
            if (process.env.NODE_ENV === 'development') {
              logger.debug(`Falling back to API base: ${base}`);
            }
            this.baseUrl = base;
          }
          break;
        }

        // If not ok but handled by fetchWithRetry (e.g. 4xx), it will return
        response = candidateResponse;
        break;
      } catch (networkError) {
        lastNetworkError = networkError;
        // Continue to next candidate base if this one fails entirely (offline or network error)
        // Silent fail - expected when backend isn't running
        if (process.env.NODE_ENV === 'development') {
          logger.debug(`Base ${base} unreachable, trying next candidate...`);
        }
      }
    }

    if (!response) {
      // Only log error if not in development (in dev, this is expected)
      if (process.env.NODE_ENV === 'production') {
        logger.error({ err: lastNetworkError }, 'All API bases failed');
      }
      throw new AllternitApiError(
        `Network error - unable to reach API after multiple attempts (${lastAttemptedUrl || this.baseUrl})`,
        0,
        'NETWORK_ERROR'
      );
    }

    // Apply response interceptors
    for (const interceptor of this.responseInterceptors) {
      response = interceptor(response);
    }

    // Handle errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new AllternitApiError(
        errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData.code,
        errorData.details
      );
    }

    // Handle empty responses
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // --------------------------------------------------------------------------
  // Convenience Methods
  // --------------------------------------------------------------------------

  get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', path, body, options);
  }

  delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Make a request and return the raw Response so the caller can handle
   * binary payloads (screenshots, file downloads) manually.
   */
  async raw(path: string, options: RequestInit = {}): Promise<Response> {
    const pathNormalized = path.startsWith('/') ? path : `/${path}`;
    const candidateBases = this.candidateBaseUrls();

    const headers: Record<string, string> = {
      'X-Client-Version': '2.0.0',
      ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      ...(SELF_HOSTED_TOKEN ? { 'X-Allternit-Self-Hosted-Token': String(SELF_HOSTED_TOKEN) } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    let config: RequestInit = {
      ...options,
      headers,
    };

    for (const interceptor of this.requestInterceptors) {
      config = interceptor(config);
    }

    let lastNetworkError: unknown = null;
    for (const base of candidateBases) {
      const url = `${base}${pathNormalized}`;
      try {
        const response = await this.fetchWithRetry(url, config);
        if (response.ok) {
          if (base !== this.baseUrl) {
            this.baseUrl = base;
          }
          return response;
        }
        return response;
      } catch (err) {
        lastNetworkError = err;
      }
    }

    throw new AllternitApiError(
      `Network error - unable to reach API after multiple attempts`,
      0,
      'NETWORK_ERROR'
    );
  }

  // ==========================================================================
  // INFERENCE ROUTER API
  // ==========================================================================

  async getInferenceRouterCliStatus(
    options?: RequestInit
  ): Promise<InferenceRouterCliStatusResponse> {
    return this.get<InferenceRouterCliStatusResponse>(
      '/api/v1/inference-router/cli-status',
      options
    );
  }

  // ==========================================================================
  // SESSIONS API
  // ==========================================================================

  async createSession(profileId: string, metadata?: Record<string, unknown>): Promise<Session> {
    return this.post<Session>('/api/v1/sessions', { 
      profile_id: profileId,
      metadata 
    });
  }

  /**
   * Create a brain session for AI chat (kernel-managed)
   *
   * @param brainProfileId - The brain profile ID (e.g., "allternit-acp", "claude-code")
   * @param source - "chat" or "terminal"
   * @param runtimeOverrides - Optional model selection and config overrides
   * @param workspaceDir - Optional workspace directory
   * @param mode - Execution mode: "plan" (read-only) or "build" (full access)
   */
  async createBrainSession(
    brainProfileId: string,
    source: 'chat' | 'terminal' = 'chat',
    runtimeOverrides?: { model_id?: string; [key: string]: unknown },
    workspaceDir?: string,
    mode?: 'plan' | 'build'
  ): Promise<Session> {
    return this.post<Session>('/api/v1/sessions', {
      brain_profile_id: brainProfileId,
      source,
      runtime_overrides: runtimeOverrides,
      workspace_dir: workspaceDir,
      mode  // Pass execution mode for system prompt injection
    });
  }

  async listSessions(status?: string): Promise<{ sessions: Session[]; total: number }> {
    const query = status ? `?status=${status}` : '';
    return this.get(`/api/v1/sessions${query}`);
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.get<Session>(`/api/v1/sessions/${sessionId}`);
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<Session> {
    return this.patch<Session>(`/api/v1/sessions/${sessionId}`, updates);
  }

  async deleteSession(sessionId: string): Promise<void> {
    return this.delete(`/api/v1/sessions/${sessionId}`);
  }

  async sendMessage(sessionId: string, message: string, attachments?: unknown[]): Promise<void> {
    return this.post(`/api/v1/sessions/${sessionId}/chat`, { 
      message,
      attachments 
    });
  }

  async getMessages(sessionId: string, limit = 50, offset = 0): Promise<{ messages: ChatMessage[] }> {
    return this.get(`/api/v1/sessions/${sessionId}/messages?limit=${limit}&offset=${offset}`);
  }

  // ==========================================================================
  // CHAT API (AI-powered chat with model selection)
  // ==========================================================================

  async chat(options: {
    message: string;
    chatId: string;
    modelId?: string;
    runtimeModelId?: string;  // Runtime-owned model ID (e.g., "anthropic:claude-3-7")
    onEvent?: (event: { type: string; [key: string]: unknown }) => void;
    onError?: (error: { code: string; message: string }) => void;
  }): Promise<void> {
    const { message, chatId, modelId = getDefaultAgentModel().id, runtimeModelId, onEvent, onError } = options;
    
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify({
        message,
        chatId,
        modelId,
        runtimeModelId,
      }),
    });

    if (!response.ok) {
      throw new AllternitApiError(`Chat request failed: ${response.statusText}`, response.status);
    }

    if (!response.body) {
      throw new AllternitApiError('No response body', 500);
    }

    // Handle SSE stream with contract validation
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sessionStartedReceived = false;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data && data !== '[DONE]') {
              try {
                const event = JSON.parse(data);
                
                // Contract validation: session.started must be first event
                if (!sessionStartedReceived) {
                  if (event.type !== 'session.started') {
                    onError?.({
                      code: 'PROTOCOL_ERROR',
                      message: 'Kernel protocol error: session.started not received as first event'
                    });
                    return;
                  }
                  sessionStartedReceived = true;
                  
                  // Validate event_mode is not terminal for chat
                  const payload = event.payload || {};
                  if (payload.event_mode === 'terminal') {
                    onError?.({
                      code: 'MODE_MISMATCH',
                      message: 'Kernel mode mismatch: terminal driver used for chat session. Use an ACP or JSONL brain profile.'
                    });
                    return;
                  }
                }
                
                // Handle terminal.delta as contract violation
                if (event.type === 'terminal.delta') {
                  onError?.({
                    code: 'CONTRACT_VIOLATION',
                    message: 'Kernel contract violation: terminal output received in chat session'
                  });
                  return;
                }
                
                onEvent?.(event);
              } catch (e) {
                // Ignore parse errors for non-JSON data
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ==========================================================================
  // SKILLS API
  // ==========================================================================

  async listSkills(tags?: string[]): Promise<{ skills: Skill[]; total: number }> {
    const query = tags?.length ? `?tags=${tags.join(',')}` : '';
    return this.get(`/api/v1/skills${query}`);
  }

  async getSkill(skillId: string): Promise<Skill> {
    return this.get<Skill>(`/api/v1/skills/${skillId}`);
  }

  async createSkill(skill: Omit<Skill, 'id'>): Promise<Skill> {
    return this.post<Skill>('/api/v1/skills', skill);
  }

  async updateSkill(skillId: string, updates: Partial<Skill>): Promise<Skill> {
    return this.patch<Skill>(`/api/v1/skills/${skillId}`, updates);
  }

  async deleteSkill(skillId: string): Promise<void> {
    return this.delete(`/api/v1/skills/${skillId}`);
  }

  async executeSkill<T = unknown>(skillId: string, input: unknown, options?: {
    timeout?: number;
    async?: boolean;
  }): Promise<T> {
    return this.post<T>(`/api/v1/skills/${skillId}/exec`, { 
      input,
      ...options 
    });
  }

  // ==========================================================================
  // WORKFLOWS API
  // ==========================================================================

  async listWorkflows(): Promise<{ workflows: Workflow[]; total: number }> {
    return this.get('/api/v1/workflows');
  }

  async getWorkflow(workflowId: string): Promise<Workflow> {
    return this.get<Workflow>(`/api/v1/workflows/${workflowId}`);
  }

  async createWorkflow(workflow: Omit<Workflow, 'id' | 'created_at'>): Promise<Workflow> {
    return this.post<Workflow>('/api/v1/workflows', workflow);
  }

  async updateWorkflow(workflowId: string, updates: Partial<Workflow>): Promise<Workflow> {
    return this.patch<Workflow>(`/api/v1/workflows/${workflowId}`, updates);
  }

  async deleteWorkflow(workflowId: string): Promise<void> {
    return this.delete(`/api/v1/workflows/${workflowId}`);
  }

  async validateWorkflow(definition: unknown): Promise<{ valid: boolean; errors?: string[] }> {
    return this.post('/api/v1/workflows/validate', { definition });
  }

  async runWorkflow(workflowId: string, input?: unknown, metadata?: Record<string, unknown>): Promise<{
    run_id: string;
    status: string;
  }> {
    return this.post(`/api/v1/workflows/${workflowId}/run`, { input, metadata });
  }

  async getWorkflowRuns(workflowId: string): Promise<{ runs: unknown[] }> {
    return this.get(`/api/v1/workflows/${workflowId}/runs`);
  }

  // ==========================================================================
  // CAPSULES API
  // ==========================================================================

  async listCapsules(runtime?: string): Promise<{ capsules: Capsule[]; total: number }> {
    const query = runtime ? `?runtime=${runtime}` : '';
    return this.get(`/api/v1/capsules${query}`);
  }

  async getCapsule(capsuleId: string): Promise<Capsule> {
    return this.get<Capsule>(`/api/v1/capsules/${capsuleId}`);
  }

  async createCapsule(capsule: Omit<Capsule, 'id'>): Promise<Capsule> {
    return this.post<Capsule>('/api/v1/capsules', capsule);
  }

  async updateCapsule(capsuleId: string, updates: Partial<Capsule>): Promise<Capsule> {
    return this.patch<Capsule>(`/api/v1/capsules/${capsuleId}`, updates);
  }

  async deleteCapsule(capsuleId: string): Promise<void> {
    return this.delete(`/api/v1/capsules/${capsuleId}`);
  }

  async executeCapsule<T = unknown>(capsuleId: string, input?: unknown): Promise<T> {
    return this.post<T>(`/api/v1/capsules/${capsuleId}/execute`, { input });
  }

  async verifyCapsule(capsuleId: string): Promise<{ valid: boolean; issues?: string[] }> {
    return this.get(`/api/v1/capsules/${capsuleId}/verify`);
  }

  // ==========================================================================
  // AGENTS API
  // ==========================================================================

  async listAgents(): Promise<{ agents: Agent[]; total: number }> {
    return this.get('/api/v1/agents');
  }

  async discoverOpenClawAgents(): Promise<{
    agents: Array<Record<string, unknown>>;
    total: number;
    unregistered: number;
    state_dir?: string;
    workspace_path?: string | null;
    gateway_port?: number | null;
  }> {
    return this.get('/api/v1/openclaw/agents/discovery');
  }

  async getAgent(agentId: string): Promise<Agent> {
    return this.get<Agent>(`/api/v1/agents/${agentId}`);
  }

  async createAgent(agent: Omit<Agent, 'id'>): Promise<Agent> {
    return this.post<Agent>('/api/v1/agents', agent);
  }

  async updateAgent(agentId: string, updates: Partial<Agent>): Promise<Agent> {
    return this.put<Agent>(`/api/v1/agents/${agentId}`, updates);
  }

  async deleteAgent(agentId: string): Promise<void> {
    return this.delete(`/api/v1/agents/${agentId}`);
  }

  async startAgentRun(
    agentId: string,
    payload: {
      input: string;
      plan?: unknown;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Record<string, unknown>> {
    return this.post(`/api/v1/agents/${agentId}/runs`, payload);
  }

  connectAgentEventStream(agentId: string): EventSource {
    const url = `${this.baseUrl}/api/v1/agents/${agentId}/events`;
    const eventSource = new EventSource(url);

    eventSource.onerror = (error) => {
      logger.error({ err: error }, 'Agent EventSource error');
    };

    return eventSource;
  }

  // ==========================================================================
  // TOOLS API
  // ==========================================================================

  async listTools(): Promise<{ tools: unknown[]; total: number }> {
    return this.get('/api/v1/tools');
  }

  async getTool(toolId: string): Promise<unknown> {
    return this.get(`/api/v1/tools/${toolId}`);
  }

  async executeTool<T = unknown>(toolId: string, arguments_: Record<string, unknown>): Promise<T> {
    return this.post<T>(`/api/v1/tools/${toolId}/execute`, { arguments: arguments_ });
  }

  // ==========================================================================
  // MODEL DISCOVERY API (Kernel Provider Endpoints)
  // ==========================================================================

  /**
   * List all providers with their authentication status
   */
  async listProviderAuthStatus(options?: RequestInit): Promise<{
    providers: Array<{
      provider_id: string;
      status: 'ok' | 'missing' | 'expired' | 'unknown' | 'not_required';
      authenticated: boolean;
      auth_profile_id: string | null;
      chat_profile_ids: string[];
    }>;
  }> {
    return this.get('/api/v1/providers/auth/status', options);
  }

  /**
   * List all providers and their models from the real models.json registry
   */
  async listProviders(options?: RequestInit): Promise<ProviderListResponse> {
    return this.get('/api/v1/providers', options);
  }

  /**
   * Get authentication status for a specific provider
   */
  async getProviderAuthStatus(providerId: string): Promise<{
    provider_id: string;
    status: 'ok' | 'missing' | 'expired' | 'unknown' | 'not_required';
    authenticated: boolean;
    auth_profile_id: string | null;
    chat_profile_ids: string[];
  }> {
    return this.get(`/api/v1/providers/${providerId}/auth/status`);
  }

  /**
   * Discover available models for a provider
   * Returns model list if provider supports discovery, otherwise freeform mode
   */
  async discoverProviderModels(providerId: string): Promise<{
    supported: boolean;
    models?: Array<{
      id: string;
      name: string;
      description?: string;
      capabilities?: string[];
      context_window?: number;
    }>;
    default_model_id?: string;
    allow_freeform: boolean;
    freeform_hint?: string;
    error?: string;
  }> {
    return this.get(`/api/v1/providers/${providerId}/models`);
  }

  /**
   * Probe Ollama live on the server and return running state + installed models.
   */
  async getOllamaLiveStatus(): Promise<{
    running: boolean;
    models: string[];
  }> {
    return this.get('/api/v1/provider/ollama/status');
  }

  /**
   * Validate a model ID for a provider
   */
  async validateProviderModel(providerId: string, modelId: string): Promise<{
    valid: boolean;
    model?: {
      id: string;
      name: string;
      description?: string;
      capabilities?: string[];
      context_window?: number;
    };
    suggested?: string[];
    message?: string;
  }> {
    return this.post(`/api/v1/providers/${providerId}/models/validate`, {
      model_id: modelId
    });
  }

  /**
   * Validate a model ID for a brain profile
   */
  async validateBrainProfileModel(profileId: string, modelId: string): Promise<{
    valid: boolean;
    model?: {
      id: string;
      name: string;
      description?: string;
      capabilities?: string[];
      context_window?: number;
    };
    suggested?: string[];
    message?: string;
  }> {
    return this.post(`/api/v1/brains/${profileId}/models/validate`, {
      model_id: modelId
    });
  }

  // ==========================================================================
  // OPERATOR API (Thin Client Direct Execution)
  // ==========================================================================

  /**
   * Submit operator task for direct execution
   */
  async operatorExecute(options: {
    requestId: string;
    intent: string;
    mode: 'plan_only' | 'plan_then_execute' | 'execute_direct';
    context: Record<string, unknown>;
    preferences: {
      prefer_connector: boolean;
      allow_browser_automation: boolean;
      allow_desktop_fallback: boolean;
    };
    policy: {
      require_private_model: boolean;
      allowed_tools?: string[];
      forbidden_tools?: string[];
    };
  }): Promise<{ success: boolean; requestId: string; status: string }> {
    return this.post('/api/v1/operator/execute', options);
  }

  /**
   * Connect to operator event stream (SSE)
   */
  connectOperatorEventStream(requestId: string): EventSource {
    const url = `${this.baseUrl}/api/v1/operator/events/${requestId}`;
    const eventSource = new EventSource(url);

    eventSource.onerror = (error) => {
      logger.error({ err: error }, 'Operator EventSource error');
    };

    return eventSource;
  }

  // ==========================================================================
  // USAGE API
  // ==========================================================================

  /**
   * Get real usage stats (requests, tokens, cost) for the current user.
   */
  async getUsageSummary(): Promise<UsageSummary> {
    const raw = await this.get<unknown>('/api/v1/usage/summary');
    return normalizeUsageSummary(raw);
  }

  // ==========================================================================
  // HEALTH API
  // ==========================================================================

  async health(): Promise<{
    status: string;
    version: string;
    services: Record<string, string>;
  }> {
    return this.get('/health');
  }

  async gatewayHealth(): Promise<{ status: string; gateway: string }> {
    return this.get('/health');
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const api = new AllternitApiClient();

// =============================================================================
// React Hooks
// =============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ApiClient');

export function useApi() {
  return api;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AllternitApiError | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { sessions } = await api.listSessions();
      setSessions(sessions);
    } catch (err) {
      setError(err as AllternitApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSession = useCallback(async (profileId: string) => {
    const session = await api.createSession(profileId);
    setSessions(prev => [...prev, session]);
    return session;
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    await api.deleteSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { 
    sessions, 
    loading, 
    error, 
    createSession, 
    deleteSession,
    refetch: fetchSessions 
  };
}

export function useSession(sessionId: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AllternitApiError | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        setLoading(true);
        const data = await api.getSession(sessionId);
        setSession(data);
      } catch (err) {
        setError(err as AllternitApiError);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  const sendMessage = useCallback(async (message: string) => {
    if (!sessionId) return;
    
    // Optimistically add user message
    setMessages(prev => [...prev, {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    }]);

    await api.sendMessage(sessionId, message);
  }, [sessionId]);

  return {
    session,
    messages,
    loading,
    error,
    sendMessage
  };
}

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AllternitApiError | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const { skills } = await api.listSkills();
      setSkills(skills);
    } catch (err) {
      setError(err as AllternitApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return { skills, loading, error, refetch: fetchSkills };
}

// =============================================================================
// USAGE SUMMARY HOOK
// =============================================================================

export function useUsageSummary() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AllternitApiError | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUsageSummary();
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setError(err as AllternitApiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

// =============================================================================
// MODEL DISCOVERY HOOK
// =============================================================================

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_window?: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  provider_type?: 'api' | 'local' | 'subprocess';
  base_url?: string | null;
  api_key_set?: boolean;
  models: ModelInfo[];
  status?: 'active' | 'missing_key' | 'offline' | 'ready_no_models' | 'unconfigured' | 'unknown';
}

interface ProviderListResponse {
  all: ProviderInfo[];
  providers?: ProviderInfo[];
  default?: Record<string, string>;
  connected?: string[];
}

export interface ProviderAuthStatus {
  provider_id: string;
  status: 'ok' | 'missing' | 'expired' | 'unknown' | 'not_required';
  authenticated: boolean;
  auth_required?: boolean;
  auth_profile_id: string | null;
  chat_profile_ids: string[];
  details?: {
    provider_type?: string;
    base_url?: string | null;
    api_key_set?: boolean;
    model_count?: number;
  };
}

export interface DiscoveredModel {
  id: string;
  name: string;
  description?: string;
  capabilities?: string[];
  context_window?: number;
}

export interface ModelDiscoveryResult {
  supported: boolean;
  models?: DiscoveredModel[];
  default_model_id?: string;
  allow_freeform: boolean;
  freeform_hint?: string;
  error?: string;
}

export interface ModelValidationResult {
  valid: boolean;
  model?: DiscoveredModel;
  suggested?: string[];
  message?: string;
}

export function useModelDiscovery() {
  const [providers, setProviders] = useState<ProviderAuthStatus[]>([]);
  const [realModels, setRealModels] = useState<ProviderInfo[]>([]);
  const authenticatedProviders = useMemo(() => 
    (providers || []).filter(p => p.authenticated),
    [providers]
  );
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState<AllternitApiError | null>(null);

  const [discoveryResult, setDiscoveryResult] = useState<ModelDiscoveryResult | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<AllternitApiError | null>(null);

  const [validationResult, setValidationResult] = useState<ModelValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Fetch all providers with auth status
  const fetchProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      setProvidersError(null);
      
      // Fetch both auth status and real models registry. Cap the wait so a
      // missing backend never leaves the UI stuck on a spinner.
      const signal = AbortSignal.timeout(3000);
      const [authResponse, registryResponse] = await Promise.all([
        api.listProviderAuthStatus({ signal }),
        api.listProviders({ signal }).catch(() => ({ all: [], default: {}, connected: [] }))
      ]);

      setProviders(authResponse.providers);
      setRealModels(registryResponse.all);
      
      return authResponse.providers;
    } catch (err) {
      setProvidersError(err as AllternitApiError);
      return [];
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  // Fetch discovery for a specific provider
  const discoverModels = useCallback(async (providerId: string) => {
    try {
      setDiscoveryLoading(true);
      setDiscoveryError(null);
      const result = await api.discoverProviderModels(providerId);
      setDiscoveryResult(result);
      return result;
    } catch (err) {
      setDiscoveryError(err as AllternitApiError);
      return null;
    } finally {
      setDiscoveryLoading(false);
    }
  }, []);

  // Validate a model ID
  const validateModel = useCallback(async (providerId: string, modelId: string) => {
    try {
      setValidationLoading(true);
      const result = await api.validateProviderModel(providerId, modelId);
      setValidationResult(result);
      return result;
    } catch (err) {
      const errorResult: ModelValidationResult = {
        valid: false,
        message: (err as AllternitApiError).message || 'Validation failed'
      };
      setValidationResult(errorResult);
      return errorResult;
    } finally {
      setValidationLoading(false);
    }
  }, []);

  // Get provider by profile ID (e.g., "claude-acp" -> "claude")
  const getProviderByProfileId = useCallback((profileId: string): ProviderAuthStatus | undefined => {
    // Map profile IDs to provider IDs
    const profileToProvider: Record<string, string> = {
      'gemini-acp': 'gemini',
      'gemini-cli': 'gemini',
      'gemini-auth': 'gemini',
      'claude-acp': 'claude',
      'claude-code': 'claude',
      'claude-auth': 'claude',
      'kimi-acp': 'kimi',
      'kimi-cli': 'kimi',
      'kimi-auth': 'kimi',
      'codex-acp': 'codex',
      'codex-auth': 'codex',
      'qwen-acp': 'qwen',
    };

    const providerId = profileToProvider[profileId];
    if (!providerId) {
      // Try to extract from pattern: provider-suffix
      const match = profileId.match(/^([a-z]+)(?:-acp|-cli|-auth)$/);
      if (match) {
        return providers.find(p => p.provider_id === match[1]);
      }
      return undefined;
    }

    return providers.find(p => p.provider_id === providerId);
  }, [providers]);

  return {
    // Providers
    providers,
    authenticatedProviders,
    providersLoading,
    providersError,
    fetchProviders,
    getProviderByProfileId,
    
    // Discovery
    discoveryResult,
    discoveryLoading,
    discoveryError,
    discoverModels,
    
    // Validation
    validationResult,
    validationLoading,
    validateModel,
    
    // Registry models
    realModels,
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default api;
