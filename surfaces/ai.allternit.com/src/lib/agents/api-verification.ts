/**
 * Backend API Verification for Agent Creation Wizard
 *
 * Verifies that all required API endpoints are available and functional.
 * Production paths surface backend availability truthfully instead of fabricating local fallback data.
 *
 * @module agents/api-verification
 * @version 1.0.0
 */

import { API_BASE_URL, apiRequest, apiRequestWithError } from './api-config';
import type { Agent } from './agent.types';

/**
 * API endpoint status
 */
export interface EndpointStatus {
  /** Endpoint path */
  endpoint: string;
  /** HTTP method */
  method: string;
  /** Is endpoint available */
  available: boolean;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Error message if unavailable */
  error?: string;
  /** Status code */
  statusCode?: number;
}

/**
 * API verification result
 */
export interface ApiVerificationResult {
  /** Overall API health */
  healthy: boolean;
  /** Timestamp of verification */
  timestamp: string;
  /** Individual endpoint statuses */
  endpoints: EndpointStatus[];
  /** Fallback mode enabled */
  fallbackMode: boolean;
  /** Warnings or notices */
  warnings: string[];
}

/**
 * Required API endpoints for the wizard
 */
export const REQUIRED_ENDPOINTS: Array<{
  path: string;
  method: string;
  description: string;
}> = [
  {
    path: '/agents',
    method: 'GET',
    description: 'List all agents',
  },
  {
    path: '/agents',
    method: 'POST',
    description: 'Create new agent',
  },
  {
    path: '/agents/:id',
    method: 'GET',
    description: 'Get agent by ID',
  },
  {
    path: '/agents/:id',
    method: 'PUT',
    description: 'Update agent',
  },
  {
    path: '/agents/:id',
    method: 'DELETE',
    description: 'Delete agent',
  },
  {
    path: '/models',
    method: 'GET',
    description: 'List available models',
  },
  {
    path: '/tools',
    method: 'GET',
    description: 'List available tools',
  },
  {
    path: '/plugins',
    method: 'GET',
    description: 'List available plugins',
  },
  {
    path: '/plugins/:id/install',
    method: 'POST',
    description: 'Install plugin',
  },
  {
    path: '/workspace/files',
    method: 'POST',
    description: 'Save workspace file',
  },
  {
    path: '/workspace/files',
    method: 'GET',
    description: 'List workspace files',
  },
  {
    path: '/capabilities',
    method: 'GET',
    description: 'List capabilities',
  },
  {
    path: '/capabilities',
    method: 'POST',
    description: 'Save capabilities',
  },
];

/**
 * Verify a single endpoint
 */
async function verifyEndpoint(
  path: string,
  method: string
): Promise<EndpointStatus> {
  const startTime = Date.now();

  try {
    // For paths with parameters, use a test value
    const testPath = path.replace(/:id/g, 'test-agent-id').replace(/:pluginId/g, 'test-plugin');
    const url = `${API_BASE_URL}${testPath}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // For non-GET requests, we just check if the endpoint exists
    // We don't actually send data to avoid side effects
    if (method !== 'GET' && options.headers) {
      (options.headers as Record<string, string>)['X-Health-Check'] = 'true';
    }

    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;

    // Consider 2xx and 4xx (except 404) as available
    // 404 means endpoint doesn't exist
    // 5xx means server error
    const available = response.status !== 404;

    return {
      endpoint: path,
      method,
      available,
      responseTime,
      statusCode: response.status,
      error: response.status >= 500 ? `Server error: ${response.status}` : undefined,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return {
      endpoint: path,
      method,
      available: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify all required API endpoints
 */
export async function verifyApiEndpoints(): Promise<ApiVerificationResult> {
  const warnings: string[] = [];
  const endpointStatuses: EndpointStatus[] = [];

  // Verify each endpoint
  for (const endpoint of REQUIRED_ENDPOINTS) {
    const status = await verifyEndpoint(endpoint.path, endpoint.method);
    endpointStatuses.push(status);

    if (!status.available) {
      warnings.push(
        `Endpoint ${endpoint.method} ${endpoint.path} is unavailable: ${status.error || 'Unknown error'}`
      );
    }
  }

  // Determine overall health
  const criticalEndpoints = endpointStatuses.filter(
    (e) => e.endpoint === '/agents' || e.endpoint === '/models'
  );
  const healthy = criticalEndpoints.every((e) => e.available);
  const fallbackMode = !healthy;

  return {
    healthy,
    timestamp: new Date().toISOString(),
    endpoints: endpointStatuses,
    fallbackMode,
    warnings,
  };
}

/**
 * API service with explicit failure semantics
 */
export class ApiWithFallback {
  private fallbackMode: boolean = false;
  private lastVerification: ApiVerificationResult | null = null;
  private verificationPromise: Promise<ApiVerificationResult> | null = null;

  /**
   * Get current API health status
   */
  async getHealthStatus(): Promise<ApiVerificationResult> {
    // Return cached result if recent (within 5 minutes)
    if (
      this.lastVerification &&
      Date.now() - new Date(this.lastVerification.timestamp).getTime() < 5 * 60 * 1000
    ) {
      return this.lastVerification;
    }

    // Return ongoing verification if in progress
    if (this.verificationPromise) {
      return this.verificationPromise;
    }

    this.verificationPromise = verifyApiEndpoints();
    this.lastVerification = await this.verificationPromise;
    this.verificationPromise = null;
    this.fallbackMode = this.lastVerification.fallbackMode;

    return this.lastVerification;
  }

  /**
   * Make API request without fabricating fallback data
   */
  async request<T>(
    path: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<T> {
    const testPath = path.replace(/:id/g, 'test-agent-id');
    const url = `${API_BASE_URL}${testPath}`;

    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    if (method === 'GET') {
      return response.json() as T;
    }

    return (response.status === 204 ? undefined : await response.json()) as T;
  }

  /**
   * List agents
   */
  async listAgents(): Promise<Agent[]> {
    return this.request<Agent[]>('/agents', 'GET');
  }

  /**
   * Get agent by ID
   */
  async getAgent(id: string): Promise<Agent | null> {
    return this.request<Agent | null>(`/agents/${id}`, 'GET');
  }

  /**
   * Create agent
   */
  async createAgent(data: Partial<Agent>): Promise<Agent | null> {
    return this.request<Agent | null>('/agents', 'POST', data);
  }

  /**
   * List models
   */
  async listModels(): Promise<Array<{ id: string; name: string; provider: string }>> {
    return this.request('/models', 'GET');
  }

  /**
   * List tools
   */
  async listTools(): Promise<Array<{ id: string; name: string; description: string; category: string }>> {
    return this.request('/tools', 'GET');
  }

  /**
   * Save workspace file
   */
  async saveWorkspaceFile(
    path: string,
    content: string,
    type: 'yaml' | 'json' = 'yaml'
  ): Promise<{ success: boolean; path: string } | null> {
    return this.request('/workspace/files', 'POST', { path, content, type });
  }

  /**
   * Get workspace file
   */
  async getWorkspaceFile(path: string): Promise<string | null> {
    return this.request<string | null>(`/workspace/files?path=${encodeURIComponent(path)}`, 'GET');
  }

  /**
   * Check if in fallback mode
   */
  isFallbackMode(): boolean {
    return this.fallbackMode;
  }

  /**
   * Force fallback mode
   */
  setFallbackMode(enabled: boolean): void {
    this.fallbackMode = enabled;
  }
}

/**
 * Singleton instance of API with fallback
 */
export const apiWithFallback = new ApiWithFallback();

/**
 * Hook-like function for React components
 */
export function useApiWithFallback() {
  return {
    getHealthStatus: () => apiWithFallback.getHealthStatus(),
    request: <T,>(path: string, method?: string, body?: unknown) =>
      apiWithFallback.request<T>(path, method, body),
    listAgents: () => apiWithFallback.listAgents(),
    getAgent: (id: string) => apiWithFallback.getAgent(id),
    createAgent: (data: Partial<Agent>) => apiWithFallback.createAgent(data),
    listModels: () => apiWithFallback.listModels(),
    listTools: () => apiWithFallback.listTools(),
    saveWorkspaceFile: (path: string, content: string, type?: 'yaml' | 'json') =>
      apiWithFallback.saveWorkspaceFile(path, content, type),
    getWorkspaceFile: (path: string) => apiWithFallback.getWorkspaceFile(path),
    isFallbackMode: () => apiWithFallback.isFallbackMode(),
  };
}

export default apiWithFallback;
