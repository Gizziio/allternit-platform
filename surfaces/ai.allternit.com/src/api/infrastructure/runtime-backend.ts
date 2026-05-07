import { applyRuntimeBackendSnapshot } from '@/lib/runtime-backend-client';

export type RuntimeBackendMode = 'local' | 'byoc-vps' | 'cloud' | 'hybrid';

export interface RuntimeBackendTargetResponse {
  id: string;
  ssh_connection_id: string;
  name: string;
  status: string;
  install_state: string;
  backend_url: string | null;
  gateway_url: string | null;
  gateway_ws_url: string | null;
  installed_version: string | null;
  supported_client_range: string | null;
  last_verified_at: string | null;
  last_heartbeat_at: string | null;
  last_error: string | null;
}

export interface RuntimeBackendResponse {
  mode: RuntimeBackendMode;
  fallback_mode: RuntimeBackendMode;
  source: 'default' | 'user-preference';
  gateway_url: string | null;
  gateway_ws_url: string | null;
  active_backend: RuntimeBackendTargetResponse | null;
  available_backends?: RuntimeBackendTargetResponse[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';

class RuntimeBackendAPI {
  private baseUrl = `${API_BASE_URL}/api/v1/runtime/backend`;

  async get(): Promise<RuntimeBackendResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to load runtime backend');
    }

    const payload = await response.json();
    applyRuntimeBackendSnapshot(payload);
    return payload;
  }

  async setBackend(input: {
    mode: RuntimeBackendMode;
    fallbackMode?: RuntimeBackendMode;
    sshConnectionId?: string;
    backendTargetId?: string;
  }): Promise<RuntimeBackendResponse> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update runtime backend' }));
      throw new Error(error?.error || 'Failed to update runtime backend');
    }

    const payload = await response.json();
    applyRuntimeBackendSnapshot(payload);
    return payload;
  }

  async activateSSHConnection(sshConnectionId: string): Promise<RuntimeBackendResponse> {
    return this.setBackend({
      mode: 'byoc-vps',
      fallbackMode: 'local',
      sshConnectionId,
    });
  }

  async activateLocal(): Promise<RuntimeBackendResponse> {
    return this.setBackend({
      mode: 'local',
      fallbackMode: 'local',
    });
  }

  async registerManualBackend(input: {
    name: string;
    gatewayUrl: string;
    gatewayWsUrl?: string;
    gatewayToken?: string;
  }): Promise<{ success: boolean; message: string; backend_target?: RuntimeBackendTargetResponse }> {
    const response = await fetch(`${this.baseUrl}/manual`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        name: input.name,
        gatewayUrl: input.gatewayUrl,
        gatewayWsUrl: input.gatewayWsUrl,
        gatewayToken: input.gatewayToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to register backend' }));
      throw new Error(error?.error || 'Failed to register backend');
    }

    return response.json();
  }
}

export const runtimeBackendApi = new RuntimeBackendAPI();
