import { z } from 'zod';

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean';
    required: boolean;
    default?: any;
    secret?: boolean;
  };
}

export interface ConnectorConfig {
  [key: string]: any;
}

export interface ConnectorCapabilities {
  readonly operations: string[];
  readonly resources: string[];
  readonly events: string[];
}

export interface Connector {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly configSchema: ConfigSchema;
  
  configure(config: ConnectorConfig): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getCapabilities(): ConnectorCapabilities;
  execute(operation: string, params: Record<string, any>): Promise<any>;
}

export abstract class BaseConnector implements Connector {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly configSchema: ConfigSchema;
  
  protected config: ConnectorConfig | null = null;
  protected connected: boolean = false;
  
  async configure(config: ConnectorConfig): Promise<void> {
    this.validateConfig(config);
    this.config = config;
  }
  
  protected validateConfig(config: ConnectorConfig): void {
    for (const [key, schema] of Object.entries(this.configSchema)) {
      if (schema.required && !(key in config)) {
        throw new Error(`Missing required config: ${key}`);
      }
    }
  }
  
  abstract connect(): Promise<void>;
  
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  abstract getCapabilities(): ConnectorCapabilities;
  
  abstract execute(operation: string, params: Record<string, any>): Promise<any>;
}

export default { BaseConnector };
