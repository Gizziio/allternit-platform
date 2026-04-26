/**
 * Swarm API Client
 *
 * Production-ready API client for swarm-advanced backend endpoints.
 * Handles circuit breakers, quarantine, message stats, and swarm execution.
 */

// ============================================================================
// Types
// ============================================================================

export interface CircuitBreakerStatus {
  agent_id: string;
  state: 'closed' | 'open' | 'half-open';
  failure_count: number;
  success_count: number;
  last_failure_at?: string;
  last_state_change?: string;
}

export interface QuarantinedAgentStatus {
  agent_id: string;
  quarantined_at: string;
  expires_at: string;
  reason: string;
  remaining_minutes: number;
}

export interface MessageStats {
  total_messages: number;
  messages_24h: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  failed_messages: number;
  retried_messages: number;
}

export interface SwarmHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  active_agents: number;
  total_agents: number;
  circuit_breakers_open: number;
  quarantined_agents: number;
  message_queue_size: number;
  avg_response_time_ms: number;
}

export interface CreateSwarmInput {
  name: string;
  description: string;
  agents: Array<{
    agent_id: string;
    role: string;
    weight?: number;
    priority?: number;
    /** Provider config — required for real execution */
    provider_id?: string;
    model_id?: string;
    exec_mode?: 'api' | 'cli' | 'local' | 'oauth';
    role_label?: string;
    role_description?: string;
  }>;
  strategy: 'round-robin' | 'hierarchical' | 'democratic' | 'competitive' | 'collaborative' | 'specialist' | 'adaptive';
  communication: {
    pattern: 'broadcast' | 'direct' | 'mailbox' | 'shared-memory';
    retention_period_ms?: number;
    include_reasoning?: boolean;
    synchronous?: boolean;
  };
  shared_context?: boolean;
  consensus_threshold?: number;
  max_rounds?: number;
  escalate_on_failure?: boolean;
}

export interface SwarmExecutionRequest {
  input: string;
  context?: Record<string, unknown>;
  timeout_ms?: number;
  stream?: boolean;
}

export interface SwarmExecutionState {
  id: string;
  swarm_id: string;
  status: 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  progress: number;
  active_agents: string[];
  messages_exchanged: number;
  start_time?: string;
  end_time?: string;
  current_stage?: string;
  error?: {
    code: string;
    message: string;
    agent_id?: string;
  };
}

// ============================================================================
// API Client
// ============================================================================

const BASE_URL = '/api/v1/swarm';

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export const swarmApi = {
  // ============================================================================
  // Circuit Breakers
  // ============================================================================

  /** Get all circuit breakers */
  async getCircuitBreakers(): Promise<CircuitBreakerStatus[]> {
    const response = await fetch(`${BASE_URL}/circuit-breakers`);
    return handleResponse<CircuitBreakerStatus[]>(response);
  },

  /** Get circuit breaker for specific agent */
  async getCircuitBreaker(agentId: string): Promise<CircuitBreakerStatus> {
    const response = await fetch(`${BASE_URL}/circuit-breakers/${agentId}`);
    return handleResponse<CircuitBreakerStatus>(response);
  },

  /** Reset circuit breaker for agent */
  async resetCircuitBreaker(agentId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/circuit-breakers/${agentId}/reset`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  // ============================================================================
  // Quarantine
  // ============================================================================

  /** Get all quarantined agents */
  async getQuarantinedAgents(): Promise<QuarantinedAgentStatus[]> {
    const response = await fetch(`${BASE_URL}/quarantine`);
    return handleResponse<QuarantinedAgentStatus[]>(response);
  },

  /** Get quarantine status for specific agent */
  async getQuarantineStatus(agentId: string): Promise<QuarantinedAgentStatus> {
    const response = await fetch(`${BASE_URL}/quarantine/${agentId}`);
    return handleResponse<QuarantinedAgentStatus>(response);
  },

  /** Release agent from quarantine */
  async releaseFromQuarantine(agentId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/quarantine/${agentId}/release`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  // ============================================================================
  // Message Stats
  // ============================================================================

  /** Get message statistics */
  async getMessageStats(): Promise<MessageStats> {
    const response = await fetch(`${BASE_URL}/messages/stats`);
    return handleResponse<MessageStats>(response);
  },

  /** Reset message statistics */
  async resetMessageStats(): Promise<void> {
    const response = await fetch(`${BASE_URL}/messages/stats/reset`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  // ============================================================================
  // Health
  // ============================================================================

  /** Get swarm health status */
  async getHealth(): Promise<SwarmHealth> {
    const response = await fetch(`${BASE_URL}/health`);
    return handleResponse<SwarmHealth>(response);
  },

  // ============================================================================
  // Swarm Management
  // ============================================================================

  /** Create a new swarm */
  async createSwarm(input: CreateSwarmInput): Promise<{ id: string }> {
    const response = await fetch(`${BASE_URL}/swarms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handleResponse(response);
  },

  /** Get swarm execution state */
  async getExecutionState(executionId: string): Promise<SwarmExecutionState> {
    const response = await fetch(`${BASE_URL}/executions/${executionId}`);
    return handleResponse<SwarmExecutionState>(response);
  },

  /** Start swarm execution */
  async startExecution(swarmId: string, request: SwarmExecutionRequest): Promise<{ execution_id: string }> {
    const response = await fetch(`${BASE_URL}/swarms/${swarmId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleResponse(response);
  },

  /** Pause swarm execution */
  async pauseExecution(executionId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/executions/${executionId}/pause`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  /** Resume swarm execution */
  async resumeExecution(executionId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/executions/${executionId}/resume`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  /** Stop swarm execution */
  async stopExecution(executionId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/executions/${executionId}/stop`, {
      method: 'POST',
    });
    return handleResponse(response);
  },
};

// ============================================================================
// Polling Utilities
// ============================================================================

export function createPollingConfig(options?: {
  circuitBreakerInterval?: number;
  quarantineInterval?: number;
  messageStatsInterval?: number;
  healthInterval?: number;
}) {
  return {
    circuitBreakerInterval: options?.circuitBreakerInterval ?? 5000, // 5s
    quarantineInterval: options?.quarantineInterval ?? 10000, // 10s
    messageStatsInterval: options?.messageStatsInterval ?? 30000, // 30s
    healthInterval: options?.healthInterval ?? 5000, // 5s
  };
}

export function startPolling<T>(
  fn: () => Promise<T>,
  interval: number,
  onData: (data: T) => void,
  onError?: (error: Error) => void
): () => void {
  let cancelled = false;
  let timeoutId: NodeJS.Timeout;

  const poll = async () => {
    if (cancelled) return;
    try {
      const data = await fn();
      onData(data);
    } catch (error) {
      onError?.(error as Error);
    }
    if (!cancelled) {
      timeoutId = setTimeout(poll, interval);
    }
  };

  poll();

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}

export default swarmApi;
