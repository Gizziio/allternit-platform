/**
 * Environments API - Types and API client for environment templates and provisioning
 */

export type EnvironmentType = 'devcontainer' | 'nix' | 'sandbox' | 'platform';

export type EnvironmentStatus = 'pending' | 'provisioning' | 'running' | 'stopped' | 'error' | 'destroying';

export interface EnvironmentConfig {
  devcontainer?: {
    image?: string;
    features?: string[];
    postCreateCommand?: string;
    extensions?: string[];
    settings?: Record<string, unknown>;
  };
  nix?: {
    packages?: string[];
    flake?: string;
    shell?: string;
  };
  sandbox?: {
    runtime: 'docker' | 'containerd' | 'firecracker';
    isolation: 'container' | 'microvm' | 'namespace';
    resources?: {
      cpu?: number;
      memory?: string;
      disk?: string;
    };
  };
}

export interface ResourceRequirements {
  minCpu: number;
  minMemory: string;
  recommendedDisk: string;
}

export interface EnvironmentTemplate {
  id: string;
  name: string;
  type: EnvironmentType;
  description: string;
  features: string[];
  setupTime: string;
  tags: string[];
  config: EnvironmentConfig;
  icon?: string;
  // Extended properties for UI
  resourceRequirements?: ResourceRequirements;
  defaultPorts?: number[];
  preinstalledTools?: string[];
}

export interface EnvironmentLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string;
}

export interface EnvironmentResources {
  cpu?: string | number;
  cpus?: string | number;
  memory?: string;
  disk?: string;
}

export interface Environment {
  id: string;
  name: string;
  template_id: string;
  template_name: string;
  type: EnvironmentType;
  status: EnvironmentStatus;
  status_message?: string;
  url?: string;
  logs?: EnvironmentLogEntry[];
  resources?: EnvironmentResources;
  created_at: string;
  updated_at: string;
  // Extended properties for UI (camelCase aliases)
  templateId?: string;
  createdAt?: string;
  errorMessage?: string;
  targetVpsId?: string;
  ports?: Record<string, number>;
  env_vars?: Record<string, string>;
  envVars?: Record<string, string>;
}

// Helper type for creating environments with flexible property names
export type EnvironmentCreateInput = Omit<Environment, 'id' | 'created_at' | 'updated_at' | 'templateId' | 'createdAt'>;

export interface ProvisionRequest {
  template_id: string;
  name: string;
  config?: Partial<EnvironmentConfig>;
  variables?: Record<string, string>;
}

export interface VPSTestResult {
  success: boolean;
  message: string;
  details?: {
    latency?: number;
  };
}

export interface VPSExecuteResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface VPSResources {
  cpu?: number;
  memory?: string;
  disk?: string;
}

export interface VPSConnection {
  id: string;
  name: string;
  host: string;
  status: 'connected' | 'disconnected' | 'error';
  resources?: VPSResources;
}

// Log callback type
export type LogCallback = (log: EnvironmentLogEntry) => void;

// Stub API implementation
export const environmentApi = {
  async listTemplates(): Promise<EnvironmentTemplate[]> {
    // TODO: Implement actual API call
    return [];
  },

  async getTemplates(): Promise<EnvironmentTemplate[]> {
    // TODO: Implement actual API call
    return [];
  },

  async getTemplate(id: string): Promise<EnvironmentTemplate> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async list(): Promise<Environment[]> {
    // TODO: Implement actual API call
    return [];
  },

  async get(id: string): Promise<Environment> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async provision(templateId: string, name: string, config?: Partial<EnvironmentConfig>): Promise<Environment> {
    // TODO: Implement actual API call
    return {
      id: `env-${Date.now()}`,
      name,
      template_id: templateId,
      template_name: 'Unknown',
      type: 'devcontainer',
      status: 'provisioning',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async provisionFromTemplate(templateId: string, name: string, targetVpsId?: string): Promise<Environment> {
    // TODO: Implement actual API call
    return {
      id: `env-${Date.now()}`,
      name,
      template_id: templateId,
      templateId,
      template_name: 'Unknown',
      type: 'devcontainer',
      status: 'provisioning',
      targetVpsId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  },

  async update(id: string, updates: Partial<Environment>): Promise<Environment> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async destroy(id: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Destroying environment:', id);
  },

  async start(id: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Starting environment:', id);
  },

  async stop(id: string): Promise<void> {
    // TODO: Implement actual API call
    console.log('Stopping environment:', id);
  },

  async getLogs(id: string): Promise<EnvironmentLogEntry[]> {
    // TODO: Implement actual API call
    return [];
  },

  subscribeToLogs(id: string, callback: LogCallback): () => void {
    // TODO: Implement actual WebSocket subscription
    console.log('Subscribing to logs for:', id);
    
    // Return unsubscribe function
    return () => {
      console.log('Unsubscribing from logs for:', id);
    };
  },
};

// VPS API stub
export const vpsApi = {
  async list(): Promise<VPSConnection[]> {
    // TODO: Implement actual API call
    return [];
  },

  async get(id: string): Promise<VPSConnection> {
    // TODO: Implement actual API call
    throw new Error('Not implemented');
  },

  async test(id: string): Promise<VPSTestResult> {
    // TODO: Implement actual API call
    return {
      success: true,
      message: 'VPS is reachable',
      details: { latency: 50 },
    };
  },

  async execute(id: string, command: string): Promise<VPSExecuteResult> {
    // TODO: Implement actual API call
    return {
      exitCode: 0,
      stdout: '',
      stderr: '',
    };
  },
};
