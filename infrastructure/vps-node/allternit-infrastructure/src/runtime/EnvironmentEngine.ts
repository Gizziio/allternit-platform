import { EventEmitter } from 'events';
import { DevContainerRuntime } from './DevContainerRuntime';
import { NixRuntime } from './NixRuntime';
import { SandboxRuntime } from './SandboxRuntime';
import { TargetAdapter } from './TargetAdapter';

export interface ProvisionConfig {
  id: string;
  type: 'devcontainer' | 'nix' | 'sandbox';
  template?: string;
  target: Target;
  variables?: Record<string, string>;
  resources?: ResourceRequirements;
  networking?: NetworkConfig;
  volumes?: VolumeConfig[];
  environment?: Record<string, string>;
}

export interface Target {
  type: 'local' | 'ssh' | 'cloud';
  host?: string;
  port?: number;
  username?: string;
  privateKey?: string;
  provider?: 'aws' | 'gcp' | 'azure' | 'digitalocean';
  region?: string;
  instanceType?: string;
  localDocker?: boolean;
}

export interface ResourceRequirements {
  cpu?: number;        // CPU cores
  memory?: string;     // Memory (e.g., "2Gi")
  disk?: string;       // Disk space (e.g., "10Gi")
  gpu?: boolean;       // GPU required
}

export interface NetworkConfig {
  ports?: PortMapping[];
  exposeAll?: boolean;
  networkMode?: 'bridge' | 'host' | 'none' | string;
  dns?: string[];
}

export interface PortMapping {
  host?: number;
  container: number;
  protocol?: 'tcp' | 'udp';
}

export interface VolumeConfig {
  source: string;
  target: string;
  type?: 'bind' | 'volume' | 'tmpfs';
  readOnly?: boolean;
}

export interface Environment {
  id: string;
  type: 'devcontainer' | 'nix' | 'sandbox';
  status: EnvironmentStatus;
  target: Target;
  endpoints: Endpoint[];
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface Endpoint {
  name: string;
  url: string;
  port: number;
  protocol: string;
}

export type EnvironmentStatus = 
  | 'pending'
  | 'provisioning'
  | 'running'
  | 'stopped'
  | 'error'
  | 'destroying'
  | 'destroyed';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

export class EnvironmentEngine extends EventEmitter {
  private environments: Map<string, Environment> = new Map();
  private logs: Map<string, LogEntry[]> = new Map();
  private devContainerRuntime: DevContainerRuntime;
  private nixRuntime: NixRuntime;
  private sandboxRuntime: SandboxRuntime;
  private targetAdapter: TargetAdapter;

  constructor() {
    super();
    this.devContainerRuntime = new DevContainerRuntime();
    this.nixRuntime = new NixRuntime();
    this.sandboxRuntime = new SandboxRuntime();
    this.targetAdapter = new TargetAdapter();
  }

  /**
   * Provision a new environment based on the provided configuration
   */
  async provision(config: ProvisionConfig): Promise<Environment> {
    const startTime = Date.now();
    
    this.emit('provision:start', { id: config.id, type: config.type });
    this.log(config.id, 'info', 'Starting environment provisioning', 'engine');

    // Validate configuration
    this.validateConfig(config);

    // Create initial environment state
    const environment: Environment = {
      id: config.id,
      type: config.type,
      status: 'provisioning',
      target: config.target,
      endpoints: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    this.environments.set(config.id, environment);
    this.logs.set(config.id, []);

    try {
      // Connect to target
      this.log(config.id, 'info', `Connecting to target: ${config.target.type}`, 'engine');
      const conn = await this.targetAdapter.connect(config.target);

      // Ensure required runtime is available
      await this.setupRuntime(config, conn);

      // Provision based on type
      let result: Partial<Environment>;
      switch (config.type) {
        case 'devcontainer':
          result = await this.provisionDevContainer(config, conn);
          break;
        case 'nix':
          result = await this.provisionNix(config, conn);
          break;
        case 'sandbox':
          result = await this.provisionSandbox(config, conn);
          break;
        default:
          throw new Error(`Unknown environment type: ${config.type}`);
      }

      // Update environment with provisioned details
      Object.assign(environment, result);
      environment.status = 'running';
      environment.updatedAt = new Date();

      const duration = Date.now() - startTime;
      this.log(config.id, 'info', `Environment provisioned successfully in ${duration}ms`, 'engine');
      this.emit('provision:complete', { id: config.id, duration });

      return environment;
    } catch (error) {
      environment.status = 'error';
      environment.updatedAt = new Date();
      environment.metadata.error = error instanceof Error ? error.message : String(error);
      
      this.log(config.id, 'error', `Provisioning failed: ${environment.metadata.error}`, 'engine');
      this.emit('provision:error', { id: config.id, error: environment.metadata.error });
      
      throw error;
    }
  }

  /**
   * Destroy an environment by ID
   */
  async destroy(envId: string): Promise<void> {
    const environment = this.environments.get(envId);
    if (!environment) {
      throw new Error(`Environment not found: ${envId}`);
    }

    this.emit('destroy:start', { id: envId });
    this.log(envId, 'info', 'Starting environment destruction', 'engine');

    environment.status = 'destroying';
    environment.updatedAt = new Date();

    try {
      const conn = await this.targetAdapter.connect(environment.target);

      switch (environment.type) {
        case 'devcontainer':
          await this.devContainerRuntime.destroy(environment.metadata.containerId as string, conn);
          break;
        case 'nix':
          await this.nixRuntime.destroy(environment.metadata.shellId as string, conn);
          break;
        case 'sandbox':
          await this.sandboxRuntime.destroy(environment.metadata.sandboxId as string, conn);
          break;
      }

      environment.status = 'destroyed';
      environment.updatedAt = new Date();

      this.log(envId, 'info', 'Environment destroyed successfully', 'engine');
      this.emit('destroy:complete', { id: envId });
    } catch (error) {
      environment.status = 'error';
      environment.metadata.error = error instanceof Error ? error.message : String(error);
      
      this.log(envId, 'error', `Destruction failed: ${environment.metadata.error}`, 'engine');
      this.emit('destroy:error', { id: envId, error: environment.metadata.error });
      
      throw error;
    }
  }

  /**
   * Get the current status of an environment
   */
  async getStatus(envId: string): Promise<EnvironmentStatus> {
    const environment = this.environments.get(envId);
    if (!environment) {
      throw new Error(`Environment not found: ${envId}`);
    }

    // For running environments, check actual runtime status
    if (environment.status === 'running') {
      try {
        const conn = await this.targetAdapter.connect(environment.target);
        let isHealthy = false;

        switch (environment.type) {
          case 'devcontainer':
            isHealthy = await this.devContainerRuntime.isHealthy(
              environment.metadata.containerId as string, 
              conn
            );
            break;
          case 'nix':
            isHealthy = await this.nixRuntime.isHealthy(
              environment.metadata.shellId as string, 
              conn
            );
            break;
          case 'sandbox':
            isHealthy = await this.sandboxRuntime.isHealthy(
              environment.metadata.sandboxId as string, 
              conn
            );
            break;
        }

        if (!isHealthy) {
          environment.status = 'error';
          environment.updatedAt = new Date();
        }
      } catch {
        environment.status = 'error';
        environment.updatedAt = new Date();
      }
    }

    return environment.status;
  }

  /**
   * Get logs for an environment
   */
  async getLogs(envId: string): Promise<string[]> {
    const logs = this.logs.get(envId);
    if (!logs) {
      return [];
    }

    return logs.map(entry => 
      `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}`
    );
  }

  /**
   * Execute a command in an environment
   */
  async executeCommand(envId: string, command: string): Promise<CommandResult> {
    const environment = this.environments.get(envId);
    if (!environment) {
      throw new Error(`Environment not found: ${envId}`);
    }

    if (environment.status !== 'running') {
      throw new Error(`Environment is not running: ${envId}`);
    }

    this.log(envId, 'debug', `Executing command: ${command}`, 'engine');

    const conn = await this.targetAdapter.connect(environment.target);

    let result: CommandResult;
    switch (environment.type) {
      case 'devcontainer':
        result = await this.devContainerRuntime.executeCommand(
          environment.metadata.containerId as string,
          command,
          conn
        );
        break;
      case 'nix':
        result = await this.nixRuntime.executeCommand(
          environment.metadata.shellId as string,
          command,
          conn
        );
        break;
      case 'sandbox':
        result = await this.sandboxRuntime.executeCommand(
          environment.metadata.sandboxId as string,
          command,
          conn
        );
        break;
      default:
        throw new Error(`Unknown environment type: ${environment.type}`);
    }

    this.log(envId, 'debug', `Command completed with exit code ${result.exitCode}`, 'engine');
    return result;
  }

  /**
   * List all environments
   */
  listEnvironments(): Environment[] {
    return Array.from(this.environments.values());
  }

  /**
   * Get a specific environment
   */
  getEnvironment(envId: string): Environment | undefined {
    return this.environments.get(envId);
  }

  private validateConfig(config: ProvisionConfig): void {
    if (!config.id) {
      throw new Error('Environment ID is required');
    }
    if (!config.type) {
      throw new Error('Environment type is required');
    }
    if (!config.target) {
      throw new Error('Target is required');
    }
  }

  private async setupRuntime(config: ProvisionConfig, conn: Connection): Promise<void> {
    switch (config.type) {
      case 'devcontainer':
      case 'sandbox':
        await this.targetAdapter.setupDocker(conn);
        break;
      case 'nix':
        await this.targetAdapter.setupNix(conn);
        break;
    }
  }

  private async provisionDevContainer(
    config: ProvisionConfig, 
    conn: Connection
  ): Promise<Partial<Environment>> {
    const template = await this.loadTemplate(config.template || 'node-typescript');
    const container = await this.devContainerRuntime.provision(template, config.target, conn);
    
    return {
      metadata: {
        containerId: container.id,
        image: container.image,
        ports: container.ports,
      },
      endpoints: container.ports.map(p => ({
        name: `port-${p}`,
        url: `http://${config.target.host || 'localhost'}:${p}`,
        port: p,
        protocol: 'http',
      })),
    };
  }

  private async provisionNix(
    config: ProvisionConfig, 
    conn: Connection
  ): Promise<Partial<Environment>> {
    const flakeUri = config.template || 'github:allternit/templates#node-typescript';
    const env = await this.nixRuntime.provision(flakeUri, config.target, conn);
    
    return {
      metadata: {
        shellId: env.id,
        flakeUri,
        storePath: env.storePath,
      },
      endpoints: [],
    };
  }

  private async provisionSandbox(
    config: ProvisionConfig, 
    conn: Connection
  ): Promise<Partial<Environment>> {
    const sandboxConfig: SandboxConfig = {
      id: config.id,
      resources: config.resources,
      networking: config.networking,
      volumes: config.volumes,
      environment: config.environment,
    };

    // Default to Docker sandbox for local, Kata for remote
    let sandbox;
    if (config.target.type === 'local') {
      sandbox = await this.sandboxRuntime.createDockerSandbox(sandboxConfig, conn);
    } else {
      sandbox = await this.sandboxRuntime.createKataSandbox(sandboxConfig, conn);
    }

    return {
      metadata: {
        sandboxId: sandbox.id,
        runtime: sandbox.runtime,
        ipAddress: sandbox.ipAddress,
      },
      endpoints: sandbox.ports.map(p => ({
        name: `port-${p}`,
        url: `http://${sandbox.ipAddress}:${p}`,
        port: p,
        protocol: 'http',
      })),
    };
  }

  private async loadTemplate(name: string): Promise<DevContainerTemplate> {
    // Load from templates directory or remote registry
    const templatePath = `./templates/${name}.json`;
    try {
      const fs = await import('fs/promises');
      const content = await fs.readFile(templatePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      throw new Error(`Template not found: ${name}`);
    }
  }

  private log(envId: string, level: LogEntry['level'], message: string, source: string): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      source,
    };

    const logs = this.logs.get(envId) || [];
    logs.push(entry);
    this.logs.set(envId, logs);

    // Also emit for real-time streaming
    this.emit('log', { envId, ...entry });
  }
}

// Types needed from other modules
interface Connection {
  id: string;
  type: 'local' | 'ssh';
  execute: (command: string) => Promise<CommandResult>;
  transferFile: (localPath: string, remotePath: string) => Promise<void>;
  close: () => Promise<void>;
}

interface DevContainerTemplate {
  name: string;
  image?: string;
  dockerfile?: string;
  features?: string[];
  ports?: number[];
  postCreateCommand?: string;
  customizations?: Record<string, unknown>;
}

interface Container {
  id: string;
  image: string;
  ports: number[];
  status: string;
}

interface SandboxConfig {
  id: string;
  resources?: ResourceRequirements;
  networking?: NetworkConfig;
  volumes?: VolumeConfig[];
  environment?: Record<string, string>;
}

interface Sandbox {
  id: string;
  runtime: string;
  ipAddress: string;
  ports: number[];
  status: string;
}

export { Connection, DevContainerTemplate, Container, SandboxConfig, Sandbox };
