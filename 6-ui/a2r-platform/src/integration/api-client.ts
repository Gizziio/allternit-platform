/**
 * A2R API Client - Canonical Enterprise Implementation
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
 * A2R Gateway Base URL - Single Source of Truth
 * 
 * Set via environment variable: VITE_A2R_GATEWAY_URL
 * Default: http://127.0.0.1:3210 (TypeScript gateway)
 * 
 * DO NOT use fallback logic. DO NOT use multiple ports.
 * All UI traffic goes through ONE gateway.
 */
const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:3210';

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
  const configured = (window as any).__A2R_GATEWAY_URL__
    || (import.meta as any).env?.VITE_A2R_GATEWAY_URL
    || DEFAULT_GATEWAY_URL;

  const normalized = normalizeGatewayCandidate(String(configured).trim());

  return normalized || DEFAULT_GATEWAY_URL;
}

function gatewayUrl(): string {
  const normalized = configuredGatewayUrl();

  // In shell-ui dev (5177), force local loopback gateway targets to same-origin so Vite
  // proxy can route /api and /health without hard-binding UI to backend ports.
  // Keep the configured loopback gateway as a fallback candidate elsewhere.
  if (typeof window !== 'undefined') {
    try {
      const runtime = new URL(normalized, window.location.origin);
      const isShellDevPort = window.location.port === '5177';
      const isLoopback = runtime.hostname === '127.0.0.1' || runtime.hostname === 'localhost';
      const isGatewayPort = runtime.port === '3210' || runtime.port === '8013';

      if (isShellDevPort && isLoopback && isGatewayPort) {
        return window.location.origin;
      }
    } catch {
      // fall through to configured/default URL
    }
  }

  return normalized || DEFAULT_GATEWAY_URL;
}

const API_BASE = `${gatewayUrl()}/api`;

// Export for debugging
export const GATEWAY_BASE_URL = gatewayUrl();
console.log('[A2R API Client] Using gateway URL:', GATEWAY_BASE_URL);

// Legacy alias for backward compatibility
export const A2R_BASE_URL = GATEWAY_BASE_URL;

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
  model: string;
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
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
}

export interface ApiErrorDetails {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Error Handling
// ============================================================================

export class A2RApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'A2RApiError';
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

class A2RApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private requestInterceptors: Array<(config: RequestInit) => RequestInit> = [];
  private responseInterceptors: Array<(response: Response) => Response> = [];

  constructor() {
    this.baseUrl = gatewayUrl();
    this.token = localStorage.getItem('a2r_token');
    
    console.log('[A2RApiClient] Initialized with gateway:', this.baseUrl);
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
    localStorage.setItem('a2r_token', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('a2r_token');
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
    const maxRetries = 3;
    const retryDelay = 1000;
    let lastError: any;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, config);
        
        // Only retry on 5xx errors or specific status codes if needed
        // Network errors (thrown by fetch) are caught by the catch block
        if (response.ok || (response.status < 500 && response.status !== 404)) {
          return response;
        }
        
        console.warn(`[A2RApiClient] Attempt ${i + 1} failed with status ${response.status}. Retrying...`);
      } catch (error) {
        lastError = error;
        console.warn(`[A2RApiClient] Attempt ${i + 1} failed with network error:`, error);
        
        if (i === maxRetries - 1) {
          // Final attempt failed, dispatch offline event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:offline', { 
              detail: { url, error: String(error) } 
            }));
          }
          throw error;
        }
        
        // Exponential backoff
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
            console.warn(`[A2RApiClient] Falling back to API base: ${base}`);
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
        console.warn(`[A2RApiClient] Base ${base} unreachable, trying next candidate...`);
      }
    }

    if (!response) {
      console.error('[A2RApiClient] All API bases failed:', lastNetworkError);
      throw new A2RApiError(
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
      throw new A2RApiError(
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
   * @param brainProfileId - The brain profile ID (e.g., "opencode-acp", "claude-code")
   * @param source - "chat" or "terminal" 
   * @param runtimeOverrides - Optional model selection and config overrides
   * @param workspaceDir - Optional workspace directory
   */
  async createBrainSession(
    brainProfileId: string,
    source: 'chat' | 'terminal' = 'chat',
    runtimeOverrides?: { model_id?: string; [key: string]: unknown },
    workspaceDir?: string
  ): Promise<Session> {
    return this.post<Session>('/api/v1/sessions', {
      brain_profile_id: brainProfileId,
      source,
      runtime_overrides: runtimeOverrides,
      workspace_dir: workspaceDir
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
    const { message, chatId, modelId = 'gpt-4o', runtimeModelId, onEvent, onError } = options;
    
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        chatId,
        modelId,
        runtimeModelId,
      }),
    });

    if (!response.ok) {
      throw new A2RApiError(`Chat request failed: ${response.statusText}`, response.status);
    }

    if (!response.body) {
      throw new A2RApiError('No response body', 500);
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

  connectEventStream(sessionId: string): EventSource {
    const url = `${this.baseUrl}/api/v1/sessions/${sessionId}/events`;
    const eventSource = new EventSource(url);
    
    eventSource.onerror = (error) => {
      console.error('[A2RApiClient] EventSource error:', error);
    };

    return eventSource;
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
    return this.patch<Agent>(`/api/v1/agents/${agentId}`, updates);
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
      console.error('[A2RApiClient] Agent EventSource error:', error);
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
  async listProviderAuthStatus(): Promise<{
    providers: Array<{
      provider_id: string;
      status: 'ok' | 'missing' | 'expired' | 'unknown' | 'not_required';
      authenticated: boolean;
      auth_profile_id: string | null;
      chat_profile_ids: string[];
    }>;
  }> {
    return this.get('/api/v1/providers/auth/status');
  }

  /**
   * List all providers and their models from the real models.json registry
   */
  async listProviders(): Promise<ProviderListResponse> {
    return this.get('/api/v1/providers');
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

export const api = new A2RApiClient();

// =============================================================================
// React Hooks
// =============================================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

export function useApi() {
  return api;
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<A2RApiError | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { sessions } = await api.listSessions();
      setSessions(sessions);
    } catch (err) {
      setError(err as A2RApiError);
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
  const [error, setError] = useState<A2RApiError | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        setLoading(true);
        const data = await api.getSession(sessionId);
        setSession(data);
      } catch (err) {
        setError(err as A2RApiError);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    // Connect to event stream
    const eventSource = api.connectEventStream(sessionId);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'message.delta':
            // Handle streaming message
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'assistant') {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + data.data.content }
                ];
              }
              return [...prev, {
                id: data.data.id,
                role: 'assistant',
                content: data.data.content,
                timestamp: new Date().toISOString()
              }];
            });
            break;
          
          case 'message.completed':
            // Message complete
            break;
          
          case 'tool.call':
            // Tool was called
            console.log('[useSession] Tool call:', data.data);
            break;
          
          case 'error':
            setError(new A2RApiError(data.data.message, 500));
            break;
        }
      } catch (err) {
        console.error('[useSession] Failed to parse event:', err);
      }
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
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
  const [error, setError] = useState<A2RApiError | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const { skills } = await api.listSkills();
      setSkills(skills);
    } catch (err) {
      setError(err as A2RApiError);
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
// MODEL DISCOVERY HOOK
// =============================================================================

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  context_window?: number;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: ModelInfo[];
}

export interface ProviderListResponse {
  all: ProviderInfo[];
  default: Record<string, string>;
  connected: string[];
}

export interface ProviderAuthStatus {
  provider_id: string;
  status: 'ok' | 'missing' | 'expired' | 'unknown' | 'not_required';
  authenticated: boolean;
  auth_profile_id: string | null;
  chat_profile_ids: string[];
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
  const [providersError, setProvidersError] = useState<A2RApiError | null>(null);

  const [discoveryResult, setDiscoveryResult] = useState<ModelDiscoveryResult | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<A2RApiError | null>(null);

  const [validationResult, setValidationResult] = useState<ModelValidationResult | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);

  // Fetch all providers with auth status
  const fetchProviders = useCallback(async () => {
    try {
      setProvidersLoading(true);
      setProvidersError(null);
      
      // Fetch both auth status and real models registry
      const [authResponse, registryResponse] = await Promise.all([
        api.listProviderAuthStatus(),
        api.listProviders().catch(() => ({ all: [], default: {}, connected: [] }))
      ]);
      
      setProviders(authResponse.providers);
      setRealModels(registryResponse.all);
      
      return authResponse.providers;
    } catch (err) {
      setProvidersError(err as A2RApiError);
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
      setDiscoveryError(err as A2RApiError);
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
        message: (err as A2RApiError).message || 'Validation failed'
      };
      setValidationResult(errorResult);
      return errorResult;
    } finally {
      setValidationLoading(false);
    }
  }, []);

  // Get provider by profile ID (e.g., "opencode-acp" -> "opencode")
  const getProviderByProfileId = useCallback((profileId: string): ProviderAuthStatus | undefined => {
    // Map profile IDs to provider IDs
    const profileToProvider: Record<string, string> = {
      'opencode-acp': 'opencode',
      'opencode-auth': 'opencode',
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
// Node Jobs API
// =============================================================================

export interface CreateJobRequest {
  name: string;
  wih: {
    handler: string;
    version?: string;
    task: {
      type: string;
      command?: string;
      working_dir?: string | null;
      [key: string]: any;
    };
    tools?: Array<{ name: string; enabled: boolean; config?: any }>;
  };
  resources?: {
    cpu_cores?: number;
    memory_gb?: number;
    disk_gb?: number;
    gpu?: boolean;
  };
  env?: Record<string, string>;
  priority?: number;
  timeout_secs?: number;
  node_id?: string | null;
}

export interface JobRecord {
  id: number;
  job_id: string;
  node_id: string | null;
  status: string;
  priority: number;
  job_spec: string;
  result: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface JobQueueStats {
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export const jobsApi = {
  /**
   * Create a new job
   */
  async createJob(job: CreateJobRequest): Promise<{ job_id: string; status: string }> {
    const response = await fetch(`${API_BASE}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(job),
    });

    if (!response.ok) {
      throw new Error(`Failed to create job: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<{ job: JobRecord }> {
    const response = await fetch(`${API_BASE}/jobs/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to get job: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * List jobs (with stats)
   */
  async listJobs(): Promise<{ stats: JobQueueStats }> {
    const response = await fetch(`${API_BASE}/jobs`);

    if (!response.ok) {
      throw new Error(`Failed to list jobs: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel job: ${response.statusText}`);
    }
  },

  /**
   * Get job queue statistics
   */
  async getStats(): Promise<JobQueueStats> {
    const response = await fetch(`${API_BASE}/jobs/stats`);

    if (!response.ok) {
      throw new Error(`Failed to get job stats: ${response.statusText}`);
    }

    return response.json();
  },
};

// =============================================================================
// Default Export
// =============================================================================

export default api;
