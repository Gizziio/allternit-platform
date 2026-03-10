// Infrastructure API exports
import { environmentApi } from './environments';
export { environmentApi };
export type { 
  Environment, 
  EnvironmentTemplate, 
  EnvironmentLogEntry,
  EnvironmentType,
  EnvironmentStatus,
  EnvironmentInput,
} from './environments';

// VPS connection types
export interface VPSConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  os?: string;
  resources?: {
    cpu?: number;
    memory?: number;
    disk?: number;
  };
  createdAt: string;
  updatedAt?: string;
  lastConnectedAt?: string;
  errorMessage?: string;
}

// VPS API stub
export const vpsApi = {
  async list(): Promise<VPSConnection[]> {
    return [];
  },
  
  async get(id: string): Promise<VPSConnection> {
    return {
      id,
      name: 'VPS',
      host: 'localhost',
      port: 22,
      username: 'root',
      authType: 'key',
      status: 'disconnected',
      createdAt: new Date().toISOString(),
    };
  },
  
  async create(vps: Partial<VPSConnection>): Promise<VPSConnection> {
    return { 
      id: '1', 
      name: vps.name || 'New VPS',
      host: vps.host || 'localhost',
      port: vps.port || 22,
      username: vps.username || 'root',
      authType: vps.authType || 'key',
      status: 'disconnected',
      createdAt: new Date().toISOString(),
      ...vps 
    } as VPSConnection;
  },
  
  async update(id: string, updates: Partial<VPSConnection>): Promise<VPSConnection> {
    return {
      id,
      name: updates.name || 'Updated',
      host: updates.host || 'localhost',
      port: updates.port || 22,
      username: updates.username || 'root',
      authType: updates.authType || 'key',
      status: updates.status || 'disconnected',
      createdAt: new Date().toISOString(),
      ...updates,
    } as VPSConnection;
  },
  
  async delete(id: string): Promise<void> {
    console.log('Deleting VPS:', id);
  },
  
  async test(id: string): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Not implemented' };
  },
  
  async installAgent(id: string): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'Not implemented' };
  },
  
  async execute(id: string, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return { stdout: '', stderr: '', exitCode: 0 };
  },
  
  async batchExecute(id: string, commands: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }[]> {
    return commands.map(() => ({ stdout: '', stderr: '', exitCode: 0 }));
  },
  
  async getMetrics(id: string): Promise<{ cpu: number; memory: number; disk: number }> {
    return { cpu: 0, memory: 0, disk: 0 };
  },
};

// Infrastructure WebSocket stub
export const InfrastructureWebSocket = {
  connect: () => {
    console.log('Infrastructure WebSocket connected (stub)');
    return {
      disconnect: () => console.log('Infrastructure WebSocket disconnected'),
      onMessage: (callback: (msg: unknown) => void) => {
        console.log('Message handler registered');
      },
      send: (data: unknown) => {
        console.log('Sending:', data);
      }
    };
  }
};

export default { environmentApi, vpsApi, InfrastructureWebSocket };
