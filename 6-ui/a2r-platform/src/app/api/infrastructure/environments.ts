// Infrastructure environments API - Stub
// Re-exports from the actual API for compatibility

export type EnvironmentType = 'devcontainer' | 'nix' | 'sandbox';

export interface EnvironmentTemplate {
  id: string;
  name: string;
  type: EnvironmentType;
  description: string;
  icon: string;
  features: string[];
  setupTime: string;
  defaultPorts?: number[];
  preinstalledTools?: string[];
  resourceRequirements?: {
    minMemory?: string;
    minCpu?: number;
    recommendedDisk?: string;
  };
}

export type EnvironmentStatus = 
  | 'creating' 
  | 'building' 
  | 'running' 
  | 'error' 
  | 'destroyed'
  | 'stopping'
  | 'stopped'
  | 'restarting';

export interface Environment {
  id: string;
  name: string;
  templateId: string;
  targetVpsId?: string;
  status: EnvironmentStatus;
  ports: Record<string, number>;
  url?: string;
  createdAt: string;
  updatedAt?: string;
  type: EnvironmentType;
  errorMessage?: string;
  resources?: {
    memory?: string;
    cpus?: number;
    disk?: string;
  };
  envVars?: Record<string, string>;
}

export interface EnvironmentInput {
  templateId: string;
  name: string;
  targetVpsId?: string;
  ports?: Record<string, number>;
  envVars?: Record<string, string>;
  resources?: {
    memory?: string;
    cpus?: number;
    disk?: string;
  };
  config?: Record<string, unknown>;
}

export interface EnvironmentLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

export const environmentApi = {
  async getTemplates(): Promise<EnvironmentTemplate[]> {
    return [];
  },
  
  async getTemplate(id: string): Promise<EnvironmentTemplate> {
    return {
      id,
      name: 'Template',
      type: 'devcontainer',
      description: 'Template description',
      icon: 'box',
      features: [],
      setupTime: '2 minutes',
    };
  },
  
  async provision(input: EnvironmentInput): Promise<Environment> {
    return {
      id: '1',
      name: input.name,
      templateId: input.templateId,
      status: 'creating',
      ports: {},
      createdAt: new Date().toISOString(),
      type: 'devcontainer',
    };
  },
  
  async provisionFromTemplate(
    templateId: string,
    name: string,
    targetVpsId?: string
  ): Promise<Environment> {
    return {
      id: '1',
      name,
      templateId,
      targetVpsId,
      status: 'creating',
      ports: {},
      createdAt: new Date().toISOString(),
      type: 'devcontainer',
    };
  },
  
  async list(): Promise<Environment[]> {
    return [];
  },
  
  async get(id: string): Promise<Environment> {
    return {
      id,
      name: 'Environment',
      templateId: 'default',
      status: 'running',
      ports: {},
      createdAt: new Date().toISOString(),
      type: 'devcontainer',
    };
  },
  
  async getLogs(id: string): Promise<EnvironmentLogEntry[]> {
    return [];
  },
  
  async getLogStrings(id: string): Promise<string[]> {
    return [];
  },
  
  async delete(id: string): Promise<void> {
    console.log('Deleting environment:', id);
  },
  
  async destroy(id: string): Promise<void> {
    console.log('Destroying environment:', id);
  },
  
  async stop(id: string): Promise<void> {
    console.log('Stopping environment:', id);
  },
  
  async start(id: string): Promise<void> {
    console.log('Starting environment:', id);
  },
  
  async restart(id: string): Promise<void> {
    console.log('Restarting environment:', id);
  },
  
  async update(id: string, updates: Partial<EnvironmentInput>): Promise<Environment> {
    return {
      id,
      name: updates.name || 'Updated',
      templateId: 'default',
      status: 'running',
      ports: {},
      createdAt: new Date().toISOString(),
      type: 'devcontainer',
    };
  },
  
  async execute(id: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return { stdout: '', stderr: '', exitCode: 0 };
  },
  
  subscribeToLogs(envId: string, onLog: (log: EnvironmentLogEntry) => void): () => void {
    return () => {};
  },
  
  async syncFiles(
    id: string,
    direction: 'to-environment' | 'from-environment',
    paths: string[]
  ): Promise<{ success: boolean; syncedFiles: number; errors?: string[] }> {
    return { success: true, syncedFiles: 0 };
  },
};

export default environmentApi;
