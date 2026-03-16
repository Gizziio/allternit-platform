/**
 * VPS API - Types and API client for VPS connections
 */

export interface VPSResources {
  cpu?: number;
  memory?: string;
  disk?: string;
}

export interface VPSConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: 'connected' | 'error' | 'pending' | 'disconnected';
  os?: string;
  cpu?: string;
  memory?: string;
  storage?: string;
  resources?: VPSResources;
  last_seen?: string;
  lastConnectedAt?: string;
  created_at: string;
  updated_at: string;
}

export interface VPSCreateRequest {
  name: string;
  host: string;
  port: number;
  username: string;
  privateKeyId?: string;
  password?: string;
}

export interface VPSTestResult {
  success: boolean;
  message: string;
  details?: {
    os?: string;
    cpu?: string;
    memory?: string;
    docker_version?: string;
    latency?: number;
  };
}

export interface VPSExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

// Stub API implementation
export const vpsApi = {
  async list(): Promise<VPSConnection[]> {
    // TODO: Implement actual API call
    return [];
  },

  async get(id: string): Promise<VPSConnection> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async create(data: VPSCreateRequest): Promise<VPSConnection> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async update(id: string, data: Partial<VPSCreateRequest>): Promise<VPSConnection> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async delete(id: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Deleting VPS connection:', id);
  },

  async test(id: string): Promise<VPSTestResult> {
    // TODO: Implement actual API call
    return {
      success: true,
      message: 'Connection test successful (stub)',
      details: {
        latency: 50,
      },
    };
  },

  async execute(id: string, command: string): Promise<VPSExecuteResult> {
    // TODO: Implement actual API call
    console.log('Executing command on VPS:', id, command);
    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
    };
  },

  async installAgent(id: string): Promise<{ success: boolean; message: string }> {
    // TODO: Implement actual API call
    console.log('Installing agent on VPS:', id);
    return {
      success: true,
      message: 'Agent installed successfully (stub)',
    };
  },

  async getMetrics(id: string): Promise<{ cpu: number; memory: number; disk: number }> {
    // TODO: Implement actual API call
    console.log('Getting metrics for VPS:', id);
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
    };
  },
};
