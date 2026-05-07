/**
 * Environments API - Types and API client for environment templates and provisioning
 */
import { environmentTemplateCatalog } from './catalog';

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

export interface EnvironmentCapabilities {
  templateCatalogAvailable: boolean;
  provisioningEnabled: boolean;
  reason?: string;
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

const PROVISIONING_UNAVAILABLE_MESSAGE =
  'Environment provisioning is not wired to a backend yet. Template browsing is available, but create/update/destroy operations are disabled.';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || '';
const ENVIRONMENTS_BASE = `${API_BASE_URL}/api/v1/environments`;

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
  const response = await fetch(`${ENVIRONMENTS_BASE}${path}`, {
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

export const environmentApi = {
  async getCapabilities(): Promise<EnvironmentCapabilities> {
    return {
      templateCatalogAvailable: true,
      provisioningEnabled: false,
      reason: PROVISIONING_UNAVAILABLE_MESSAGE,
    };
  },

  async listTemplates(): Promise<EnvironmentTemplate[]> {
    return environmentTemplateCatalog;
  },

  async getTemplates(): Promise<EnvironmentTemplate[]> {
    return environmentTemplateCatalog;
  },

  async getTemplate(id: string): Promise<EnvironmentTemplate> {
    const template = environmentTemplateCatalog.find((candidate) => candidate.id === id);
    if (!template) {
      throw new Error(`Environment template not found: ${id}`);
    }
    return template;
  },

  async list(): Promise<Environment[]> {
    return request<Environment[]>('', { method: 'GET' }, 'Failed to load environments');
  },

  async get(id: string): Promise<Environment> {
    return request<Environment>(`/${id}`, { method: 'GET' }, 'Failed to load environment');
  },

  async provision(templateId: string, name: string, config?: Partial<EnvironmentConfig>): Promise<Environment> {
    return request<Environment>(
      '',
      {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, name, config }),
      },
      PROVISIONING_UNAVAILABLE_MESSAGE,
    );
  },

  async provisionFromTemplate(templateId: string, name: string, targetVpsId?: string): Promise<Environment> {
    return request<Environment>(
      '',
      {
        method: 'POST',
        body: JSON.stringify({ template_id: templateId, name, targetVpsId }),
      },
      PROVISIONING_UNAVAILABLE_MESSAGE,
    );
  },

  async update(id: string, updates: Partial<Environment>): Promise<Environment> {
    return request<Environment>(
      `/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(updates),
      },
      PROVISIONING_UNAVAILABLE_MESSAGE,
    );
  },

  async destroy(id: string): Promise<void> {
    await request<{ success: boolean }>(`/${id}`, { method: 'DELETE' }, PROVISIONING_UNAVAILABLE_MESSAGE);
  },

  async start(id: string): Promise<void> {
    throw new Error(PROVISIONING_UNAVAILABLE_MESSAGE);
  },

  async stop(id: string): Promise<void> {
    throw new Error(PROVISIONING_UNAVAILABLE_MESSAGE);
  },

  async getLogs(id: string): Promise<EnvironmentLogEntry[]> {
    throw new Error(PROVISIONING_UNAVAILABLE_MESSAGE);
  },

  subscribeToLogs(id: string, callback: LogCallback): () => void {
    console.warn('[environmentApi] Live log streaming is unavailable:', { id, callback });
    return () => {
      // No-op until a real environment log transport exists.
    };
  },
};
