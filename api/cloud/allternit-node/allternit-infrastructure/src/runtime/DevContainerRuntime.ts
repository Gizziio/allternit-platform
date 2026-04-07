import { exec } from 'child_process';
import { promisify } from 'util';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CommandResult, Target, Connection } from './EnvironmentEngine';

const execAsync = promisify(exec);

export interface DevContainerConfig {
  name?: string;
  image?: string;
  dockerfile?: string;
  build?: {
    dockerfile?: string;
    context?: string;
    args?: Record<string, string>;
    target?: string;
  };
  features?: Record<string, string | boolean | Record<string, unknown>>;
  forwardPorts?: number[];
  portsAttributes?: Record<string, PortAttributes>;
  postCreateCommand?: string;
  postStartCommand?: string;
  postAttachCommand?: string;
  initializeCommand?: string;
  onCreateCommand?: string;
  updateContentCommand?: string;
  remoteUser?: string;
  containerUser?: string;
  containerEnv?: Record<string, string>;
  remoteEnv?: Record<string, string>;
  mounts?: Mount[];
  runArgs?: string[];
  shutdownAction?: 'none' | 'stopContainer';
  overrideCommand?: boolean;
  customizations?: {
    vscode?: {
      extensions?: string[];
      settings?: Record<string, unknown>;
    };
  };
  workspaceFolder?: string;
  workspaceMount?: string;
  appPort?: number | number[];
  containerName?: string;
  privileged?: boolean;
  capAdd?: string[];
  capDrop?: string[];
  securityOpt?: string[];
  runtimeArgs?: string[];
  otherPortsAttributes?: PortAttributes;
}

export interface PortAttributes {
  label?: string;
  onAutoForward?: 'notify' | 'openBrowser' | 'openPreview' | 'silent' | 'ignore';
  requireLocalPort?: boolean;
  protocol?: 'http' | 'https';
}

export interface Mount {
  type: 'bind' | 'volume' | 'tmpfs';
  source: string;
  target: string;
  readonly?: boolean;
  bindOptions?: {
    propagation?: 'private' | 'rprivate' | 'shared' | 'rshared' | 'slave' | 'rslave';
  };
  volumeOptions?: {
    noCopy?: boolean;
    labels?: Record<string, string>;
    driverConfig?: {
      name?: string;
      options?: Record<string, string>;
    };
  };
  tmpfsOptions?: {
    sizeBytes?: number;
    mode?: number;
  };
}

export interface DevContainerTemplate {
  id: string;
  name: string;
  description: string;
  image?: string;
  dockerfile?: string;
  buildContext?: string;
  features?: string[];
  ports?: number[];
  postCreateCommand?: string;
  customizations?: Record<string, unknown>;
  variables?: Record<string, { default: string; description: string }>;
}

export interface ContainerConfig {
  name?: string;
  image: string;
  ports?: number[];
  environment?: Record<string, string>;
  volumes?: string[];
  workingDir?: string;
  user?: string;
  command?: string[];
  entrypoint?: string[];
  privileged?: boolean;
  capAdd?: string[];
  capDrop?: string[];
  securityOpt?: string[];
  network?: string;
  networkMode?: string;
  restart?: string;
  memory?: string;
  cpus?: number;
  shmSize?: string;
  labels?: Record<string, string>;
}

export interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: number[];
  ipAddress?: string;
  createdAt: Date;
  startedAt?: Date;
  health?: 'healthy' | 'unhealthy' | 'starting' | 'none';
}

export class DevContainerRuntime {
  private containers: Map<string, Container> = new Map();

  /**
   * Provision a dev container from a template
   */
  async provision(
    template: DevContainerTemplate,
    _target: Target,
    conn?: Connection
  ): Promise<Container> {
    const containerName = `devcontainer-${template.id}-${Date.now()}`;
    
    // Build or pull the image
    let imageId: string;
    if (template.dockerfile) {
      imageId = await this.buildImage(template.dockerfile, template.buildContext || '.', conn);
    } else if (template.image) {
      imageId = await this.pullImage(template.image, conn);
    } else {
      throw new Error('Template must specify either image or dockerfile');
    }

    // Configure container
    const containerConfig: ContainerConfig = {
      name: containerName,
      image: imageId,
      ports: template.ports || [],
      workingDir: '/workspace',
      user: 'vscode',
      environment: {
        DEVCONTAINER: 'true',
        ...this.getEnvironmentVariables(template.variables),
      },
      volumes: ['/workspace'],
      labels: {
        'devcontainer.id': template.id,
        'devcontainer.name': template.name,
        'managed-by': 'a2r-environment-engine',
      },
    };

    // Run the container
    const container = await this.runContainer(containerConfig, conn);

    // Execute post-create command if specified
    if (template.postCreateCommand) {
      await this.executeCommand(container.id, template.postCreateCommand, conn);
    }

    this.containers.set(container.id, container);
    return container;
  }

  /**
   * Parse a devcontainer.json configuration file
   */
  async parseDevcontainerJson(config: string): Promise<DevContainerConfig> {
    const parsed = JSON.parse(config);
    
    // Validate required fields and normalize
    const normalized: DevContainerConfig = {
      ...parsed,
      forwardPorts: parsed.forwardPorts || parsed.appPort || [],
      containerEnv: parsed.containerEnv || {},
      remoteEnv: parsed.remoteEnv || {},
      mounts: parsed.mounts || [],
      runArgs: parsed.runArgs || [],
    };

    // Normalize ports
    if (typeof normalized.appPort === 'number') {
      normalized.forwardPorts = [normalized.appPort];
    } else if (Array.isArray(normalized.appPort)) {
      normalized.forwardPorts = normalized.appPort;
    }

    return normalized;
  }

  /**
   * Build a Docker image from a Dockerfile
   */
  async buildImage(dockerfile: string, context: string, conn?: Connection): Promise<string> {
    const tag = `devcontainer-build-${createHash('md5').update(dockerfile).digest('hex').substring(0, 12)}`;
    
    // Create temporary Dockerfile
    const dockerfilePath = path.join(context, '.Dockerfile.devcontainer');
    await fs.writeFile(dockerfilePath, dockerfile);

    try {
      const buildCmd = `docker build -f ${dockerfilePath} -t ${tag} ${context}`;
      
      if (conn) {
        await conn.transferFile(dockerfilePath, `/tmp/${path.basename(dockerfilePath)}`);
        const result = await conn.execute(buildCmd.replace(dockerfilePath, `/tmp/${path.basename(dockerfilePath)}`));
        if (result.exitCode !== 0) {
          throw new Error(`Docker build failed: ${result.stderr}`);
        }
      } else {
        const { stderr } = await execAsync(buildCmd);
        if (stderr && !stderr.includes('Successfully tagged')) {
          console.warn('Docker build warnings:', stderr);
        }
      }

      return tag;
    } finally {
      // Cleanup temporary Dockerfile
      try {
        await fs.unlink(dockerfilePath);
      } catch { /* ignore */ }
    }
  }

  /**
   * Run a container from an image
   */
  async runContainer(config: ContainerConfig, conn?: Connection): Promise<Container> {
    const args: string[] = ['run', '-d', '--detach'];

    // Name
    if (config.name) {
      args.push('--name', config.name);
    }

    // Ports
    if (config.ports) {
      for (const port of config.ports) {
        args.push('-p', `${port}:${port}`);
      }
    }

    // Environment variables
    if (config.environment) {
      for (const [key, value] of Object.entries(config.environment)) {
        args.push('-e', `${key}=${value}`);
      }
    }

    // Volumes
    if (config.volumes) {
      for (const volume of config.volumes) {
        args.push('-v', volume);
      }
    }

    // Working directory
    if (config.workingDir) {
      args.push('-w', config.workingDir);
    }

    // User
    if (config.user) {
      args.push('-u', config.user);
    }

    // Privileged
    if (config.privileged) {
      args.push('--privileged');
    }

    // Capabilities
    if (config.capAdd) {
      for (const cap of config.capAdd) {
        args.push('--cap-add', cap);
      }
    }

    if (config.capDrop) {
      for (const cap of config.capDrop) {
        args.push('--cap-drop', cap);
      }
    }

    // Security options
    if (config.securityOpt) {
      for (const opt of config.securityOpt) {
        args.push('--security-opt', opt);
      }
    }

    // Network
    if (config.network) {
      args.push('--network', config.network);
    }

    // Memory limit
    if (config.memory) {
      args.push('--memory', config.memory);
    }

    // CPU limit
    if (config.cpus) {
      args.push('--cpus', config.cpus.toString());
    }

    // Shared memory
    if (config.shmSize) {
      args.push('--shm-size', config.shmSize);
    }

    // Restart policy
    if (config.restart) {
      args.push('--restart', config.restart);
    }

    // Labels
    if (config.labels) {
      for (const [key, value] of Object.entries(config.labels)) {
        args.push('-l', `${key}=${value}`);
      }
    }

    // Command override
    if (config.command) {
      args.push(...config.command);
    } else if (config.entrypoint) {
      args.push('--entrypoint', config.entrypoint[0]);
      if (config.entrypoint.length > 1) {
        args.push(...config.entrypoint.slice(1));
      }
    }

    // Image
    args.push(config.image);

    // Additional command after image
    if (config.command && !config.entrypoint) {
      args.push(...config.command);
    }

    const cmd = `docker ${args.join(' ')}`;
    
    let containerId: string;
    if (conn) {
      const result = await conn.execute(cmd);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to run container: ${result.stderr}`);
      }
      containerId = result.stdout.trim();
    } else {
      const { stdout } = await execAsync(cmd);
      containerId = stdout.trim();
    }

    // Get container details
    const container = await this.getContainerInfo(containerId, conn);
    
    // Wait for container to be healthy
    await this.waitForHealthy(containerId, conn);

    return container;
  }

  /**
   * Execute a command in a running container
   */
  async executeCommand(containerId: string, command: string, conn?: Connection): Promise<CommandResult> {
    const cmd = `docker exec ${containerId} sh -c '${command.replace(/'/g, "'\"'\"'")}'`;
    
    if (conn) {
      return await conn.execute(cmd);
    } else {
      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execAsync(cmd);
        return {
          stdout,
          stderr,
          exitCode: 0,
          duration: Date.now() - startTime,
        };
      } catch (error) {
        const execError = error as { stdout?: string; stderr?: string; code?: number };
        return {
          stdout: execError.stdout || '',
          stderr: execError.stderr || '',
          exitCode: execError.code || 1,
          duration: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Stop and remove a container
   */
  async destroy(containerId: string, conn?: Connection): Promise<void> {
    const stopCmd = `docker stop ${containerId}`;
    const rmCmd = `docker rm ${containerId}`;

    if (conn) {
      await conn.execute(stopCmd);
      await conn.execute(rmCmd);
    } else {
      try {
        await execAsync(stopCmd);
      } catch { /* container may already be stopped */ }
      await execAsync(rmCmd);
    }

    this.containers.delete(containerId);
  }

  /**
   * Check if a container is healthy
   */
  async isHealthy(containerId: string, conn?: Connection): Promise<boolean> {
    try {
      const container = await this.getContainerInfo(containerId, conn);
      return container.status === 'running' && 
        (container.health === 'healthy' || container.health === 'none');
    } catch {
      return false;
    }
  }

  /**
   * List all dev containers
   */
  async listContainers(conn?: Connection): Promise<Container[]> {
    const cmd = `docker ps -a --filter "label=managed-by=a2r-environment-engine" --format "{{json .}}"`;
    
    let output: string;
    if (conn) {
      const result = await conn.execute(cmd);
      output = result.stdout;
    } else {
      const { stdout } = await execAsync(cmd);
      output = stdout;
    }

    const lines = output.trim().split('\n').filter(Boolean);
    const containers: Container[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const container = await this.getContainerInfo(data.ID, conn);
        containers.push(container);
      } catch {
        // Skip invalid entries
      }
    }

    return containers;
  }

  /**
   * Pull an image from a registry
   */
  async pullImage(image: string, conn?: Connection): Promise<string> {
    const cmd = `docker pull ${image}`;
    
    if (conn) {
      const result = await conn.execute(cmd);
      if (result.exitCode !== 0) {
        throw new Error(`Failed to pull image: ${result.stderr}`);
      }
    } else {
      await execAsync(cmd);
    }

    return image;
  }

  /**
   * Get container information
   */
  private async getContainerInfo(containerId: string, conn?: Connection): Promise<Container> {
    const cmd = `docker inspect ${containerId}`;
    
    let output: string;
    if (conn) {
      const result = await conn.execute(cmd);
      output = result.stdout;
    } else {
      const { stdout } = await execAsync(cmd);
      output = stdout;
    }

    const info = JSON.parse(output)[0];
    
    const ports: number[] = [];
    if (info.NetworkSettings?.Ports) {
      for (const [portKey, bindings] of Object.entries(info.NetworkSettings.Ports)) {
        if (bindings && Array.isArray(bindings) && bindings.length > 0) {
          const port = parseInt(portKey.split('/')[0], 10);
          if (!isNaN(port)) {
            ports.push(port);
          }
        }
      }
    }

    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ''),
      image: info.Config.Image,
      status: info.State.Status,
      ports,
      ipAddress: info.NetworkSettings.IPAddress,
      createdAt: new Date(info.Created),
      startedAt: info.State.StartedAt ? new Date(info.State.StartedAt) : undefined,
      health: info.State.Health?.Status,
    };
  }

  /**
   * Wait for container to be healthy
   */
  private async waitForHealthy(containerId: string, conn?: Connection, timeout = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const container = await this.getContainerInfo(containerId, conn);
      
      if (container.status !== 'running') {
        throw new Error(`Container failed to start: ${container.status}`);
      }

      if (container.health === 'healthy' || container.health === 'none') {
        return;
      }

      if (container.health === 'unhealthy') {
        throw new Error('Container is unhealthy');
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    throw new Error('Timeout waiting for container to be healthy');
  }

  /**
   * Generate environment variables from template variables
   */
  private getEnvironmentVariables(
    variables?: Record<string, { default: string; description: string }>
  ): Record<string, string> {
    const env: Record<string, string> = {};
    
    if (variables) {
      for (const [key, config] of Object.entries(variables)) {
        env[key] = process.env[key] || config.default;
      }
    }

    return env;
  }
}
