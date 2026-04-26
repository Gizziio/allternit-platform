/**
 * Allternit API Client
 * 
 * Official JavaScript/TypeScript client for the Allternit platform API.
 * 
 * @example
 * ```typescript
 * import { AllternitClient } from '@allternit/api-client';
 * 
 * const client = new AllternitClient({
 *   apiKey: 'your-api-key',
 *   baseUrl: 'https://api.allternit.com'
 * });
 * 
 * const workspaces = await client.workspaces.list();
 * ```
 */

export interface AllternitClientConfig {
  /** Your Allternit API key */
  apiKey: string;
  /** API base URL (default: https://api.allternit.com) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description?: string;
  status: 'active' | 'inactive';
  installedAt: string;
}

export interface Task {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

/**
 * Allternit API Client
 */
export class AllternitClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: AllternitClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.allternit.com';
    this.timeout = config.timeout || 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, any>;
        throw new AllternitApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorData.code || 'UNKNOWN_ERROR',
          errorData.details
        );
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof AllternitApiError) {
        throw error;
      }
      throw new AllternitApiError(
        error instanceof Error ? error.message : 'Unknown error',
        'REQUEST_FAILED'
      );
    }
  }

  /**
   * Workspace management
   */
  workspaces = {
    /**
     * List all workspaces
     */
    list: (): Promise<Workspace[]> => {
      return this.request<Workspace[]>('GET', '/v1/workspaces');
    },

    /**
     * Get a specific workspace
     */
    get: (id: string): Promise<Workspace> => {
      return this.request<Workspace>('GET', `/v1/workspaces/${id}`);
    },

    /**
     * Create a new workspace
     */
    create: (data: { name: string; description?: string }): Promise<Workspace> => {
      return this.request<Workspace>('POST', '/v1/workspaces', data);
    },

    /**
     * Delete a workspace
     */
    delete: (id: string): Promise<void> => {
      return this.request<void>('DELETE', `/v1/workspaces/${id}`);
    },
  };

  /**
   * Plugin management
   */
  plugins = {
    /**
     * List all plugins
     */
    list: (): Promise<Plugin[]> => {
      return this.request<Plugin[]>('GET', '/v1/plugins');
    },

    /**
     * Get a specific plugin
     */
    get: (id: string): Promise<Plugin> => {
      return this.request<Plugin>('GET', `/v1/plugins/${id}`);
    },

    /**
     * Install a plugin
     */
    install: (pluginId: string): Promise<Plugin> => {
      return this.request<Plugin>('POST', `/v1/plugins/${pluginId}/install`);
    },

    /**
     * Uninstall a plugin
     */
    uninstall: (pluginId: string): Promise<void> => {
      return this.request<void>('DELETE', `/v1/plugins/${pluginId}`);
    },
  };

  /**
   * Task management
   */
  tasks = {
    /**
     * List all tasks
     */
    list: (): Promise<Task[]> => {
      return this.request<Task[]>('GET', '/v1/tasks');
    },

    /**
     * Get a specific task
     */
    get: (id: string): Promise<Task> => {
      return this.request<Task>('GET', `/v1/tasks/${id}`);
    },

    /**
     * Create a new task
     */
    create: (data: { name: string; config?: Record<string, any> }): Promise<Task> => {
      return this.request<Task>('POST', '/v1/tasks', data);
    },

    /**
     * Cancel a running task
     */
    cancel: (id: string): Promise<void> => {
      return this.request<void>('POST', `/v1/tasks/${id}/cancel`);
    },
  };

  /**
   * Execute a plugin
   */
  async execute(
    pluginId: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; result?: any; error?: ApiError }> {
    return this.request('POST', `/v1/plugins/${pluginId}/execute`, { params });
  }

  /**
   * Health check
   */
  async health(): Promise<{ status: string; version: string }> {
    return this.request('GET', '/health');
  }
}

/**
 * Allternit API Error
 */
export class AllternitApiError extends Error {
  code: string;
  details?: Record<string, any>;

  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = 'AllternitApiError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Create a new Allternit client
 */
export function createClient(config: AllternitClientConfig): AllternitClient {
  return new AllternitClient(config);
}

export default AllternitClient;
