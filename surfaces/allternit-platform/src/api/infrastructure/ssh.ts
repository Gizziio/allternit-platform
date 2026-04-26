/**
 * SSH Connections API Client
 * 
 * API client for managing SSH connections to VPS and remote servers.
 * Provides endpoints for CRUD operations, connection testing, and
 * agent installation.
 */

import { 
  type SSHConnectionFormData, 
  type SSHConnectionTestResult,
  type SSHConnection 
} from '@/components/ssh';

// ============================================================================
// Types
// ============================================================================

export interface CreateSSHConnectionRequest {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'key' | 'password';
  private_key?: string;
  private_key_path?: string;
  password?: string;
}

export interface UpdateSSHConnectionRequest {
  name?: string;
  host?: string;
  port?: number;
  username?: string;
  auth_type?: 'key' | 'password';
  private_key?: string;
  private_key_path?: string;
  password?: string;
}

export interface SSHConnectionResponse {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  last_connected?: string;
  os?: string;
  architecture?: string;
  docker_installed?: boolean;
  allternit_installed?: boolean;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  os?: string;
  architecture?: string;
  docker_installed?: boolean;
  allternit_installed?: boolean;
}

export interface InstallAgentResponse {
  success: boolean;
  message: string;
  installation_log?: string[];
  version?: string;
  api_url?: string | null;
  backend_target_id?: string;
  reachable_from_shell?: boolean;
}

// ============================================================================
// API Client
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';

type SSHRequestLike = Partial<CreateSSHConnectionRequest> &
  Partial<UpdateSSHConnectionRequest> & {
    authType?: 'key' | 'password';
    privateKey?: string;
    privateKeyPath?: string;
  };

function normalizeSSHRequest(data: SSHRequestLike): UpdateSSHConnectionRequest {
  const normalized: UpdateSSHConnectionRequest = {};

  if (data.name !== undefined) normalized.name = data.name;
  if (data.host !== undefined) normalized.host = data.host;
  if (data.port !== undefined) normalized.port = data.port;
  if (data.username !== undefined) normalized.username = data.username;

  const authType = data.auth_type ?? data.authType;
  if (authType !== undefined) normalized.auth_type = authType;

  const privateKey = data.private_key ?? data.privateKey;
  if (privateKey !== undefined) normalized.private_key = privateKey;

  const privateKeyPath = data.private_key_path ?? data.privateKeyPath;
  if (privateKeyPath !== undefined) normalized.private_key_path = privateKeyPath;

  const password = data.password;
  if (password !== undefined) normalized.password = password;

  return normalized;
}

async function parseErrorResponse(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const error = await response.json();
      const message =
        error?.message ||
        error?.error ||
        fallbackMessage;
      return new Error(message);
    }

    const text = await response.text();
    return new Error(text || fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

export class SSHConnectionsAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/api/v1/ssh-connections`;
  }

  // ==========================================================================
  // CRUD Operations
  // ==========================================================================

  /**
   * List all SSH connections for the current user
   */
  async listConnections(): Promise<SSHConnectionResponse[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw await parseErrorResponse(response, 'Failed to list SSH connections');
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to list SSH connections');
    }
  }

  /**
   * Get a single SSH connection by ID
   */
  async getConnection(id: string): Promise<SSHConnectionResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to get SSH connection');
    }

    return response.json();
  }

  /**
   * Create a new SSH connection
   */
  async createConnection(data: CreateSSHConnectionRequest): Promise<SSHConnectionResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to create SSH connection');
    }

    return response.json();
  }

  /**
   * Update an existing SSH connection
   */
  async updateConnection(
    id: string, 
    data: UpdateSSHConnectionRequest
  ): Promise<SSHConnectionResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to update SSH connection');
    }

    return response.json();
  }

  /**
   * Delete an SSH connection
   */
  async deleteConnection(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to delete SSH connection');
    }
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Test SSH connection without saving
   */
  async testConnection(data: CreateSSHConnectionRequest): Promise<TestConnectionResponse> {
    const response = await fetch(`${this.baseUrl}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Connection test failed');
    }

    return response.json();
  }

  /**
   * Connect to an SSH server
   */
  async connect(id: string): Promise<SSHConnectionResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to connect');
    }

    return response.json();
  }

  /**
   * Disconnect from an SSH server
   */
  async disconnect(id: string): Promise<SSHConnectionResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/disconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to disconnect');
    }

    return response.json();
  }

  // ==========================================================================
  // Agent Management
  // ==========================================================================

  /**
   * Install Allternit agent on the remote server
   */
  async installAgent(id: string): Promise<InstallAgentResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/install-agent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to install agent');
    }

    return response.json();
  }

  /**
   * Get agent installation status
   */
  async getAgentStatus(id: string): Promise<{
    installed: boolean;
    version?: string;
    last_seen?: string;
    status: 'running' | 'stopped' | 'error';
  }> {
    const response = await fetch(`${this.baseUrl}/${id}/agent-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw await parseErrorResponse(response, 'Failed to get agent status');
    }

    return response.json();
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Convert form data to API request format
   */
  static formDataToRequest(data: SSHConnectionFormData): CreateSSHConnectionRequest {
    const host = data.host.includes('@') ? data.host.split('@')[1] : data.host;
    const username = data.host.includes('@') ? data.host.split('@')[0] : data.username;

    return {
      name: data.name,
      host,
      port: data.port,
      username,
      auth_type: data.authType,
      private_key: data.privateKey || undefined,
      private_key_path: data.privateKeyPath || undefined,
      password: data.password || undefined,
    };
  }

  /**
   * Convert API response to component format
   */
  static responseToConnection(response: SSHConnectionResponse): SSHConnection {
    return {
      id: response.id,
      name: response.name,
      host: response.host,
      port: response.port,
      username: response.username,
      status: response.status,
      lastConnected: response.last_connected,
      os: response.os,
      architecture: response.architecture,
      dockerInstalled: response.docker_installed,
      allternitInstalled: response.allternit_installed,
      errorMessage: response.error_message,
    };
  }

  /**
   * Convert API test response to component format
   */
  static responseToTestResult(response: TestConnectionResponse): SSHConnectionTestResult {
    return {
      success: response.success,
      message: response.message,
      details: {
        os: response.os,
        architecture: response.architecture,
        dockerInstalled: response.docker_installed,
        allternitInstalled: response.allternit_installed,
      },
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const sshConnectionsApi = new SSHConnectionsAPI();

// ============================================================================
// React Hook
// ============================================================================

import { useState, useCallback, useEffect } from 'react';

export function useSSHConnections() {
  const [connections, setConnections] = useState<SSHConnection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const responses = await sshConnectionsApi.listConnections();
      setConnections(responses.map(SSHConnectionsAPI.responseToConnection));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createConnection = useCallback(async (data: SSHConnectionFormData) => {
    const request = SSHConnectionsAPI.formDataToRequest(data);
    const response = await sshConnectionsApi.createConnection(request);
    const connection = SSHConnectionsAPI.responseToConnection(response);
    setConnections(prev => [...prev, connection]);
    return connection;
  }, []);

  const updateConnection = useCallback(async (id: string, data: Partial<SSHConnectionFormData>) => {
    const response = await sshConnectionsApi.updateConnection(id, normalizeSSHRequest(data));
    const connection = SSHConnectionsAPI.responseToConnection(response);
    setConnections(prev => prev.map(c => c.id === id ? connection : c));
    return connection;
  }, []);

  const deleteConnection = useCallback(async (id: string) => {
    await sshConnectionsApi.deleteConnection(id);
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  const testConnection = useCallback(async (data: SSHConnectionFormData): Promise<SSHConnectionTestResult> => {
    const request = SSHConnectionsAPI.formDataToRequest(data);
    const response = await sshConnectionsApi.testConnection(request);
    return SSHConnectionsAPI.responseToTestResult(response);
  }, []);

  const connect = useCallback(async (id: string) => {
    const response = await sshConnectionsApi.connect(id);
    const connection = SSHConnectionsAPI.responseToConnection(response);
    setConnections(prev => prev.map(c => c.id === id ? connection : c));
    return connection;
  }, []);

  const disconnect = useCallback(async (id: string) => {
    const response = await sshConnectionsApi.disconnect(id);
    const connection = SSHConnectionsAPI.responseToConnection(response);
    setConnections(prev => prev.map(c => c.id === id ? connection : c));
    return connection;
  }, []);

  const installAgent = useCallback(async (id: string) => {
    return await sshConnectionsApi.installAgent(id);
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  return {
    connections,
    isLoading,
    error,
    refresh: loadConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    connect,
    disconnect,
    installAgent,
  };
}

// ============================================================================
// Simple API Object (for direct use)
// ============================================================================

export const sshApi = {
  getConnections: async (): Promise<SSHConnection[]> => {
    const responses = await sshConnectionsApi.listConnections();
    return responses.map(SSHConnectionsAPI.responseToConnection);
  },

  createConnection: async (data: SSHRequestLike & { name: string; host: string; username: string }): Promise<SSHConnection> => {
    const response = await sshConnectionsApi.createConnection(
      normalizeSSHRequest(data) as CreateSSHConnectionRequest,
    );
    return SSHConnectionsAPI.responseToConnection(response);
  },

  updateConnection: async (
    id: string,
    data: SSHRequestLike,
  ): Promise<SSHConnection> => {
    const response = await sshConnectionsApi.updateConnection(id, normalizeSSHRequest(data));
    return SSHConnectionsAPI.responseToConnection(response);
  },

  deleteConnection: async (id: string): Promise<void> => {
    await sshConnectionsApi.deleteConnection(id);
  },

  testConnection: async (data: SSHRequestLike): Promise<SSHConnectionTestResult> => {
    const response = await sshConnectionsApi.testConnection(
      normalizeSSHRequest(data) as CreateSSHConnectionRequest,
    );
    return SSHConnectionsAPI.responseToTestResult(response);
  },

  connect: async (id: string): Promise<{ 
    success: boolean; 
    error?: string;
    os?: string;
    architecture?: string;
    dockerInstalled?: boolean;
    allternitInstalled?: boolean;
  }> => {
    try {
      const response = await sshConnectionsApi.connect(id);
      return {
        success: response.status === 'connected',
        os: response.os,
        architecture: response.architecture,
        dockerInstalled: response.docker_installed,
        allternitInstalled: response.allternit_installed,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Connection failed',
      };
    }
  },

  disconnect: async (id: string): Promise<void> => {
    await sshConnectionsApi.disconnect(id);
  },

  installAgent: async (id: string): Promise<InstallAgentResponse> => {
    return await sshConnectionsApi.installAgent(id);
  },
};

export default sshConnectionsApi;
