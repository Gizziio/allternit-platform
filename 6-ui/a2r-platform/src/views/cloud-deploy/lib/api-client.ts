/**
 * Cloud Deploy API Client
 * 
 * TypeScript client for the A2R Cloud API backend.
 */

export interface DeploymentConfig {
  provider_id: string;
  region_id: string;
  instance_type_id: string;
  storage_gb: number;
  instance_name: string;
  mode: 'automated' | 'manual';
  // For automated mode
  api_token?: string;
  // For manual mode (user already has VPS)
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_private_key?: string;
}

// Wizard-specific types for agent-assisted flow
export interface WizardState {
  deployment_id: string;
  current_step: string;
  context: WizardContext;
  timestamps: WizardTimestamps;
  retry_count: number;
  progress: number;
}

export interface WizardContext {
  provider?: string;
  api_token?: string;
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_private_key?: string;
  instance_id?: string;
  instance_ip?: string;
  provider_signup_url?: string;
  agent_guidance: string[];
}

export interface WizardTimestamps {
  created_at: string;
  last_step_started_at?: string;
  last_step_completed_at?: string;
  completed_at?: string;
}

export interface StartWizardRequest {
  provider: string;
  api_token?: string;
  ssh_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_private_key?: string;
}

export interface ResumeWizardRequest {
  checkpoint_type: string;
}

export interface Deployment {
  deployment_id: string;
  provider_id: string;
  region_id: string;
  instance_type_id: string;
  storage_gb: number;
  instance_name: string;
  status: string;
  progress: number;
  message: string;
  error_message?: string;
  instance_id?: string;
  instance_ip?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface DeploymentEvent {
  deployment_id: string;
  event_type: string;
  progress: number;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export class CloudDeployApi {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8013') {
    this.baseUrl = baseUrl;
  }

  /**
   * Create a new deployment
   */
  async createDeployment(config: DeploymentConfig): Promise<Deployment> {
    const response = await fetch(`${this.baseUrl}/api/v1/deployments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create deployment' }));
      throw new Error(error.message || 'Failed to create deployment');
    }

    return response.json();
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(id: string): Promise<Deployment> {
    const response = await fetch(`${this.baseUrl}/api/v1/deployments/${id}`);

    if (!response.ok) {
      throw new Error('Deployment not found');
    }

    return response.json();
  }

  /**
   * Cancel deployment
   */
  async cancelDeployment(id: string): Promise<Deployment> {
    const response = await fetch(`${this.baseUrl}/api/v1/deployments/${id}/cancel`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to cancel deployment');
    }

    return response.json();
  }

  /**
   * Subscribe to deployment events via WebSocket
   */
  subscribeToEvents(
    id: string,
    callback: (event: DeploymentEvent) => void
  ): () => void {
    const wsUrl = this.baseUrl.replace('http', 'ws');
    const ws = new WebSocket(`${wsUrl}/api/v1/deployments/${id}/events`);

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as DeploymentEvent;
        callback(event);
      } catch (e) {
        console.error('Failed to parse deployment event:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Return unsubscribe function
    return () => {
      ws.close();
    };
  }

  /**
   * List all deployments
   */
  async listDeployments(): Promise<Deployment[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/deployments`);
    if (!response.ok) {
      throw new Error('Failed to list deployments');
    }
    return response.json();
  }

  /**
   * Validate provider credentials
   */
  async validateCredentials(
    providerId: string,
    apiKey: string,
    apiSecret: string
  ): Promise<{ valid: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/providers/${providerId}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
    });

    if (!response.ok) {
      throw new Error('Failed to validate credentials');
    }

    return response.json();
  }

  /**
   * List instances
   */
  async listInstances(): Promise<Instance[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/instances`);
    if (!response.ok) {
      throw new Error('Failed to list instances');
    }
    return response.json();
  }

  // ============================================================================
  // Wizard API (Agent-Assisted Flow)
  // ============================================================================

  /**
   * Start new wizard deployment
   */
  async startWizard(request: StartWizardRequest): Promise<WizardState> {
    const response = await fetch(`${this.baseUrl}/api/v1/wizard/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to start wizard: ${error}`);
    }

    return response.json();
  }

  /**
   * Get wizard state
   */
  async getWizardState(deploymentId: string): Promise<WizardState> {
    const response = await fetch(`${this.baseUrl}/api/v1/wizard/${deploymentId}`);

    if (!response.ok) {
      throw new Error('Failed to get wizard state');
    }

    return response.json();
  }

  /**
   * Advance wizard to next step
   */
  async advanceWizard(deploymentId: string): Promise<WizardState> {
    const response = await fetch(`${this.baseUrl}/api/v1/wizard/${deploymentId}/advance`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to advance wizard: ${error}`);
    }

    return response.json();
  }

  /**
   * Resume wizard after human checkpoint
   */
  async resumeWizard(
    deploymentId: string,
    checkpointType: string
  ): Promise<WizardState> {
    const response = await fetch(`${this.baseUrl}/api/v1/wizard/${deploymentId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint_type: checkpointType }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to resume wizard: ${error}`);
    }

    return response.json();
  }

  /**
   * Cancel wizard deployment
   */
  async cancelWizard(deploymentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/v1/wizard/${deploymentId}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to cancel wizard');
    }
  }
}

export interface Instance {
  id: string;
  name: string;
  provider: string;
  region: string;
  status: string;
  public_ip?: string;
  private_ip?: string;
  cpu: number;
  ram: number;
  agents: number;
  cost_hr: number;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

// Export singleton instance for convenience
export const cloudDeployApi = new CloudDeployApi();
