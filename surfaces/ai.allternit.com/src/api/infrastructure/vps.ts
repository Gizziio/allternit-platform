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
  privateKey?: string;
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

type VpsApiRecord = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  status: 'connected' | 'error' | 'pending' | 'disconnected';
  os?: string | null;
  architecture?: string | null;
  created_at: string;
  updated_at: string;
  last_connected?: string | null;
  cpu_cores?: number | null;
  memory_gb?: number | null;
  disk_gb?: number | null;
};

type VpsTestApiRecord = {
  success: boolean;
  message: string;
  os?: string;
  architecture?: string;
  docker_installed?: boolean;
  allternit_installed?: boolean;
  latency?: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const VPS_BASE = `${API_BASE_URL}/api/v1/ssh-connections`;

function mapConnection(record: VpsApiRecord): VPSConnection {
  return {
    id: record.id,
    name: record.name,
    host: record.host,
    port: record.port,
    username: record.username,
    status: record.status,
    os: record.os ?? undefined,
    lastConnectedAt: record.last_connected ?? undefined,
    created_at: record.created_at,
    updated_at: record.updated_at,
    resources:
      record.cpu_cores || record.memory_gb || record.disk_gb
        ? {
            cpu: record.cpu_cores ?? undefined,
            memory: record.memory_gb !== undefined && record.memory_gb !== null ? `${record.memory_gb}` : undefined,
            disk: record.disk_gb !== undefined && record.disk_gb !== null ? `${record.disk_gb}` : undefined,
          }
        : undefined,
  };
}

async function parseErrorResponse(response: Response, fallbackMessage: string): Promise<Error> {
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const error = await response.json();
      return new Error(error?.error || error?.message || fallbackMessage);
    }

    const text = await response.text();
    return new Error(text || fallbackMessage);
  } catch {
    return new Error(fallbackMessage);
  }
}

async function request<T>(path: string, init: RequestInit, fallbackMessage: string): Promise<T> {
  const response = await fetch(`${VPS_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw await parseErrorResponse(response, fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export const vpsApi = {
  async list(): Promise<VPSConnection[]> {
    const records = await request<VpsApiRecord[]>('', { method: 'GET' }, 'Failed to list VPS connections');
    return records.map(mapConnection);
  },

  async get(id: string): Promise<VPSConnection> {
    const record = await request<VpsApiRecord>(`/${id}`, { method: 'GET' }, 'Failed to load VPS connection');
    return mapConnection(record);
  },

  async create(data: VPSCreateRequest): Promise<VPSConnection> {
    const record = await request<VpsApiRecord>(
      '',
      {
        method: 'POST',
        body: JSON.stringify({
          name: data.name,
          host: data.host,
          port: data.port,
          username: data.username,
          auth_type: data.privateKey ? 'key' : 'password',
          private_key: data.privateKey,
          password: data.password,
        }),
      },
      'Failed to create VPS connection',
    );
    return mapConnection(record);
  },

  async update(id: string, data: Partial<VPSCreateRequest>): Promise<VPSConnection> {
    const record = await request<VpsApiRecord>(
      `/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          name: data.name,
          host: data.host,
          port: data.port,
          username: data.username,
          auth_type: data.privateKey ? 'key' : data.password ? 'password' : undefined,
          private_key: data.privateKey,
          password: data.password,
        }),
      },
      'Failed to update VPS connection',
    );
    return mapConnection(record);
  },

  async delete(id: string): Promise<void> {
    await request<{ success: true }>(`/${id}`, { method: 'DELETE' }, 'Failed to delete VPS connection');
  },

  async test(id: string): Promise<VPSTestResult> {
    const connected = await request<VpsApiRecord>(
      `/${id}/connect`,
      { method: 'POST' },
      'Failed to connect to VPS',
    );

    return {
      success: connected.status === 'connected',
      message: connected.status === 'connected' ? 'Successfully connected to the server' : 'Connection failed',
      details: {
        os: connected.os ?? undefined,
      },
    };
  },

  async execute(id: string, command: string): Promise<VPSExecuteResult> {
    return request<VPSExecuteResult>(
      `/${id}/execute`,
      {
        method: 'POST',
        body: JSON.stringify({ command }),
      },
      'Failed to execute command on VPS',
    );
  },

  async installAgent(id: string): Promise<{ success: boolean; message: string }> {
    const result = await request<{ success: boolean; message: string }>(
      `/${id}/install-agent`,
      { method: 'POST' },
      'Failed to install agent on VPS',
    );
    return result;
  },

  async getMetrics(id: string): Promise<{ cpu: number; memory: number; disk: number }> {
    return request<{ cpu: number; memory: number; disk: number }>(
      `/${id}/metrics`,
      { method: 'GET' },
      'Failed to fetch VPS metrics',
    );
  },
};
