import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Target, Connection, CommandResult, ResourceRequirements, NetworkConfig, VolumeConfig } from './EnvironmentEngine';

const execAsync = promisify(exec);

export interface SandboxConfig {
  id: string;
  runtime?: 'docker' | 'kata' | 'firecracker' | 'gvisor';
  image?: string;
  command?: string[];
  resources?: ResourceRequirements;
  networking?: NetworkConfig;
  volumes?: VolumeConfig[];
  environment?: Record<string, string>;
  privileged?: boolean;
  readonlyRootfs?: boolean;
  seccompProfile?: string;
  apparmorProfile?: string;
  capabilities?: {
    add?: string[];
    drop?: string[];
  };
  namespace?: {
    pid?: boolean;
    network?: boolean;
    mount?: boolean;
    ipc?: boolean;
    uts?: boolean;
    user?: boolean;
    cgroup?: boolean;
  };
  cgroups?: {
    cpuQuota?: number;
    cpuPeriod?: number;
    cpuShares?: number;
    memoryLimit?: string;
    memorySwap?: string;
    pidsLimit?: number;
    blkioWeight?: number;
  };
}

export interface Sandbox {
  id: string;
  runtime: 'docker' | 'kata' | 'firecracker' | 'gvisor';
  status: 'creating' | 'running' | 'stopped' | 'paused' | 'error';
  pid?: number;
  ipAddress?: string;
  ports: number[];
  volumes: string[];
  createdAt: Date;
  startedAt?: Date;
  resources: {
    cpu: number;
    memory: string;
    disk: string;
  };
  metadata: Record<string, unknown>;
}

export interface ResourceConstraints {
  cpu?: {
    quota?: number;
    period?: number;
    shares?: number;
    cpus?: string;
  };
  memory?: {
    limit?: string;
    swap?: string;
    swappiness?: number;
  };
  pids?: {
    limit?: number;
  };
  blkio?: {
    weight?: number;
    weightDevice?: Array<{ major: number; minor: number; weight: number }>;
    throttleReadBpsDevice?: Array<{ major: number; minor: number; rate: number }>;
    throttleWriteBpsDevice?: Array<{ major: number; minor: number; rate: number }>;
  };
  network?: {
    classId?: number;
    priorities?: Array<{ name: string; priority: number }>;
  };
}

export interface IsolationConfig {
  chroot?: string;
  mountProc?: boolean;
  mountSys?: boolean;
  mountDev?: boolean;
  dropCapabilities?: boolean;
  noNewPrivileges?: boolean;
}

export class SandboxRuntime {
  private sandboxes: Map<string, Sandbox> = new Map();

  /**
   * Create a Docker-based sandbox
   */
  async createDockerSandbox(config: SandboxConfig, conn?: Connection): Promise<Sandbox> {
    const containerName = `sandbox-${config.id}`;
    
    const sandbox: Sandbox = {
      id: config.id,
      runtime: 'docker',
      status: 'creating',
      ports: config.networking?.ports?.map(p => p.container) || [],
      volumes: config.volumes?.map(v => v.target) || [],
      createdAt: new Date(),
      resources: {
        cpu: config.resources?.cpu || 1,
        memory: config.resources?.memory || '512Mi',
        disk: config.resources?.disk || '1Gi',
      },
      metadata: {
        containerName,
        image: config.image || 'alpine:latest',
      },
    };

    this.sandboxes.set(config.id, sandbox);

    try {
      // Build Docker run arguments
      const args: string[] = ['run', '-d', '--detach'];

      // Name
      args.push('--name', containerName);

      // Labels
      args.push('-l', 'managed-by=allternit-sandbox-runtime');
      args.push('-l', `sandbox.id=${config.id}`);
      args.push('-l', `sandbox.runtime=docker`);

      // Resources
      if (config.resources?.cpu) {
        args.push('--cpus', config.resources.cpu.toString());
      }
      if (config.resources?.memory) {
        args.push('--memory', config.resources.memory);
      }

      // Ports
      if (config.networking?.ports) {
        for (const port of config.networking.ports) {
          const hostPort = port.host || port.container;
          args.push('-p', `${hostPort}:${port.container}/${port.protocol || 'tcp'}`);
        }
      }

      // Network mode
      if (config.networking?.networkMode) {
        args.push('--network', config.networking.networkMode);
      }

      // DNS
      if (config.networking?.dns) {
        for (const dns of config.networking.dns) {
          args.push('--dns', dns);
        }
      }

      // Volumes
      if (config.volumes) {
        for (const vol of config.volumes) {
          let mount = '';
          if (vol.type === 'bind') {
            mount = `${vol.source}:${vol.target}`;
          } else if (vol.type === 'volume') {
            mount = `volume-${config.id}-${vol.source}:${vol.target}`;
          } else {
            mount = `tmpfs:${vol.target}`;
          }
          if (vol.readOnly) {
            mount += ':ro';
          }
          args.push('-v', mount);
        }
      }

      // Environment variables
      if (config.environment) {
        for (const [key, value] of Object.entries(config.environment)) {
          args.push('-e', `${key}=${value}`);
        }
      }

      // Privileged
      if (config.privileged) {
        args.push('--privileged');
      }

      // Read-only root filesystem
      if (config.readonlyRootfs) {
        args.push('--read-only');
      }

      // Security options
      if (config.seccompProfile) {
        args.push('--security-opt', `seccomp=${config.seccompProfile}`);
      }

      if (config.apparmorProfile) {
        args.push('--security-opt', `apparmor=${config.apparmorProfile}`);
      }

      // Capabilities
      if (config.capabilities?.add) {
        for (const cap of config.capabilities.add) {
          args.push('--cap-add', cap);
        }
      }

      if (config.capabilities?.drop) {
        for (const cap of config.capabilities.drop) {
          args.push('--cap-drop', cap);
        }
      }

      // Pid namespace
      if (config.namespace?.pid) {
        args.push('--pid', 'host');
      }

      // Network namespace
      if (config.namespace?.network) {
        args.push('--network', 'host');
      }

      // IPC namespace
      if (config.namespace?.ipc) {
        args.push('--ipc', 'host');
      }

      // UTS namespace
      if (config.namespace?.uts) {
        args.push('--uts', 'host');
      }

      // User namespace
      if (config.namespace?.user) {
        args.push('--userns', 'host');
      }

      // Cgroup namespace
      if (config.namespace?.cgroup) {
        args.push('--cgroupns', 'host');
      }

      // CGroups v2 constraints
      if (config.cgroups?.cpuQuota) {
        args.push('--cpu-quota', config.cgroups.cpuQuota.toString());
      }

      if (config.cgroups?.cpuPeriod) {
        args.push('--cpu-period', config.cgroups.cpuPeriod.toString());
      }

      if (config.cgroups?.cpuShares) {
        args.push('--cpu-shares', config.cgroups.cpuShares.toString());
      }

      if (config.cgroups?.memoryLimit) {
        args.push('--memory', config.cgroups.memoryLimit);
      }

      if (config.cgroups?.memorySwap) {
        args.push('--memory-swap', config.cgroups.memorySwap);
      }

      if (config.cgroups?.pidsLimit) {
        args.push('--pids-limit', config.cgroups.pidsLimit.toString());
      }

      if (config.cgroups?.blkioWeight) {
        args.push('--blkio-weight', config.cgroups.blkioWeight.toString());
      }

      // Image and command
      args.push(config.image || 'alpine:latest');
      
      if (config.command) {
        args.push(...config.command);
      }

      // Execute Docker command
      const cmd = `docker ${args.join(' ')}`;
      
      let containerId: string;
      if (conn) {
        const result = await conn.execute(cmd);
        if (result.exitCode !== 0) {
          throw new Error(`Failed to create Docker sandbox: ${result.stderr}`);
        }
        containerId = result.stdout.trim();
      } else {
        const { stdout } = await execAsync(cmd);
        containerId = stdout.trim();
      }

      // Get container info
      const info = await this.getDockerContainerInfo(containerId, conn);
      sandbox.status = 'running';
      sandbox.ipAddress = info.ipAddress;
      sandbox.startedAt = new Date();
      sandbox.metadata.containerId = containerId;

      return sandbox;
    } catch (error) {
      sandbox.status = 'error';
      sandbox.metadata.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Create a Kata Containers sandbox
   */
  async createKataSandbox(config: SandboxConfig, conn?: Connection): Promise<Sandbox> {
    // Kata uses Docker/Podman with kata-runtime
    const kataConfig: SandboxConfig = {
      ...config,
      runtime: 'kata',
    };

    const args: string[] = ['run', '-d', '--detach'];
    args.push('--runtime', 'kata-runtime');

    // Similar to Docker but with VM-level isolation
    const sandbox = await this.createDockerSandbox(kataConfig, conn);
    sandbox.runtime = 'kata';
    sandbox.metadata.runtimeClass = 'kata';

    return sandbox;
  }

  /**
   * Create a Firecracker microVM sandbox
   */
  async createFirecrackerSandbox(config: SandboxConfig, conn?: Connection): Promise<Sandbox> {
    const sandboxId = config.id;
    const vmId = `fc-${sandboxId}`;

    const sandbox: Sandbox = {
      id: sandboxId,
      runtime: 'firecracker',
      status: 'creating',
      ports: config.networking?.ports?.map(p => p.container) || [],
      volumes: [],
      createdAt: new Date(),
      resources: {
        cpu: config.resources?.cpu || 1,
        memory: config.resources?.memory || '128Mi',
        disk: config.resources?.disk || '1Gi',
      },
      metadata: {
        vmId,
        socketPath: `/tmp/firecracker-${vmId}.sock`,
      },
    };

    this.sandboxes.set(sandboxId, sandbox);

    try {
      // Create Firecracker VM config
      const vmConfig = {
        boot_source: {
          kernel_image_path: '/opt/firecracker/vmlinux',
          boot_args: 'console=ttyS0 reboot=k panic=1 pci=off',
        },
        drives: [
          {
            drive_id: 'rootfs',
            path_on_host: `/var/lib/firecracker/images/${config.image || 'alpine-rootfs.ext4'}`,
            is_root_device: true,
            is_read_only: false,
          },
        ],
        machine_config: {
          vcpu_count: config.resources?.cpu || 1,
          mem_size_mib: this.parseMemoryToMiB(config.resources?.memory || '128Mi'),
          smt: false,
        },
        network_interfaces: config.networking?.ports?.map((port, idx) => ({
          iface_id: `eth${idx}`,
          guest_mac: `AA:FC:00:00:00:0${idx + 1}`,
          host_dev_name: `tap${vmId}-${idx}`,
        })),
      };

      // Write config to temp file
      const configPath = `/tmp/firecracker-config-${vmId}.json`;
      await fs.writeFile(configPath, JSON.stringify(vmConfig, null, 2));

      if (conn) {
        await conn.transferFile(configPath, configPath);
      }

      // Start Firecracker VM
      const startCmd = `firecracker --api-sock ${sandbox.metadata.socketPath} --config-file ${configPath} --daemonize`;
      
      if (conn) {
        const result = await conn.execute(startCmd);
        if (result.exitCode !== 0) {
          throw new Error(`Failed to start Firecracker VM: ${result.stderr}`);
        }
      } else {
        await execAsync(startCmd);
      }

      // Wait for VM to be ready
      await this.waitForFirecrackerReady(sandbox.metadata.socketPath, conn);

      sandbox.status = 'running';
      sandbox.startedAt = new Date();
      sandbox.ipAddress = `169.254.0.${Math.floor(Math.random() * 254) + 1}`;

      return sandbox;
    } catch (error) {
      sandbox.status = 'error';
      sandbox.metadata.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Isolate a process with resource constraints
   */
  async isolateProcess(pid: number, constraints: ResourceConstraints): Promise<void> {
    // Create cgroup for the process
    const cgroupPath = `/sys/fs/cgroup/allternit-sandbox/pid-${pid}`;
    
    await fs.mkdir(cgroupPath, { recursive: true });

    // CPU constraints
    if (constraints.cpu) {
      if (constraints.cpu.quota) {
        await fs.writeFile(
          path.join(cgroupPath, 'cpu.max'),
          `${constraints.cpu.quota} ${constraints.cpu.period || 100000}`
        );
      }
      if (constraints.cpu.shares) {
        await fs.writeFile(
          path.join(cgroupPath, 'cpu.weight'),
          Math.max(1, Math.min(10000, constraints.cpu.shares / 10)).toString()
        );
      }
      if (constraints.cpu.cpus) {
        await fs.writeFile(
          path.join(cgroupPath, 'cpuset.cpus'),
          constraints.cpu.cpus
        );
      }
    }

    // Memory constraints
    if (constraints.memory) {
      if (constraints.memory.limit) {
        const limitBytes = this.parseMemoryToBytes(constraints.memory.limit);
        await fs.writeFile(
          path.join(cgroupPath, 'memory.max'),
          limitBytes.toString()
        );
      }
      if (constraints.memory.swap) {
        const swapBytes = this.parseMemoryToBytes(constraints.memory.swap);
        await fs.writeFile(
          path.join(cgroupPath, 'memory.swap.max'),
          swapBytes.toString()
        );
      }
      if (constraints.memory.swappiness !== undefined) {
        await fs.writeFile(
          path.join(cgroupPath, 'memory.swappiness'),
          constraints.memory.swappiness.toString()
        );
      }
    }

    // PID constraints
    if (constraints.pids?.limit) {
      await fs.writeFile(
        path.join(cgroupPath, 'pids.max'),
        constraints.pids.limit.toString()
      );
    }

    // Block I/O constraints
    if (constraints.blkio?.weight) {
      await fs.writeFile(
        path.join(cgroupPath, 'io.weight'),
        constraints.blkio.weight.toString()
      );
    }

    // Network constraints (using tc)
    if (constraints.network?.classId) {
      // This would require network interface setup
    }

    // Move process to cgroup
    await fs.writeFile(path.join(cgroupPath, 'cgroup.procs'), pid.toString());
  }

  /**
   * Execute a command in a sandbox
   */
  async executeCommand(sandboxId: string, command: string, conn?: Connection): Promise<CommandResult> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox not found: ${sandboxId}`);
    }

    switch (sandbox.runtime) {
      case 'docker':
      case 'kata':
        return this.executeDockerCommand(sandbox.metadata.containerId as string, command, conn);
      case 'firecracker':
        return this.executeFirecrackerCommand(sandbox.metadata.vmId as string, command, conn);
      default:
        throw new Error(`Unknown runtime: ${sandbox.runtime}`);
    }
  }

  /**
   * Destroy a sandbox
   */
  async destroy(sandboxId: string, conn?: Connection): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return;
    }

    switch (sandbox.runtime) {
      case 'docker':
      case 'kata':
        await this.destroyDockerSandbox(sandbox, conn);
        break;
      case 'firecracker':
        await this.destroyFirecrackerSandbox(sandbox, conn);
        break;
    }

    this.sandboxes.delete(sandboxId);
  }

  /**
   * Check if a sandbox is healthy
   */
  async isHealthy(sandboxId: string, conn?: Connection): Promise<boolean> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) {
      return false;
    }

    try {
      switch (sandbox.runtime) {
        case 'docker':
        case 'kata':
          const info = await this.getDockerContainerInfo(
            sandbox.metadata.containerId as string, 
            conn
          );
          return info.status === 'running';
        case 'firecracker':
          // Check if VM process is running
          const checkCmd = `pgrep -f "firecracker.*${sandbox.metadata.vmId}"`;
          if (conn) {
            const result = await conn.execute(checkCmd);
            return result.exitCode === 0;
          } else {
            try {
              await execAsync(checkCmd);
              return true;
            } catch {
              return false;
            }
          }
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * List all sandboxes
   */
  listSandboxes(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  private async getDockerContainerInfo(containerId: string, conn?: Connection): Promise<{
    id: string;
    status: string;
    ipAddress?: string;
  }> {
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
    
    return {
      id: info.Id,
      status: info.State.Status,
      ipAddress: info.NetworkSettings.IPAddress,
    };
  }

  private async executeDockerCommand(
    containerId: string, 
    command: string, 
    conn?: Connection
  ): Promise<CommandResult> {
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

  private async executeFirecrackerCommand(
    vmId: string, 
    command: string, 
    conn?: Connection
  ): Promise<CommandResult> {
    // Use socat to communicate with Firecracker VM via vsock
    const cmd = `echo '${command}' | socat - vsock-connect:${vmId}:52`;
    
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

  private async destroyDockerSandbox(sandbox: Sandbox, conn?: Connection): Promise<void> {
    const containerId = sandbox.metadata.containerId as string;
    
    const stopCmd = `docker stop ${containerId}`;
    const rmCmd = `docker rm ${containerId}`;

    if (conn) {
      await conn.execute(stopCmd);
      await conn.execute(rmCmd);
    } else {
      try {
        await execAsync(stopCmd);
      } catch { /* ignore */ }
      await execAsync(rmCmd);
    }
  }

  private async destroyFirecrackerSandbox(sandbox: Sandbox, conn?: Connection): Promise<void> {
    const vmId = sandbox.metadata.vmId as string;
    const socketPath = sandbox.metadata.socketPath as string;

    // Send shutdown request via API
    const shutdownCmd = `curl -X PUT --unix-socket ${socketPath} \
      -H "Content-Type: application/json" \
      -d '{"action_type": "SendCtrlAltDel"}' \
      http://localhost/actions`;

    if (conn) {
      await conn.execute(shutdownCmd);
    } else {
      try {
        await execAsync(shutdownCmd);
      } catch { /* ignore */ }
    }

    // Force kill after timeout
    const killCmd = `pkill -f "firecracker.*${vmId}"`;
    if (conn) {
      await conn.execute(killCmd);
    } else {
      try {
        await execAsync(killCmd);
      } catch { /* ignore */ }
    }

    // Cleanup socket and config
    const cleanupCmd = `rm -f ${socketPath} /tmp/firecracker-config-${vmId}.json`;
    if (conn) {
      await conn.execute(cleanupCmd);
    } else {
      try {
        await execAsync(cleanupCmd);
      } catch { /* ignore */ }
    }
  }

  private async waitForFirecrackerReady(socketPath: string, conn?: Connection, timeout = 30000): Promise<void> {
    const startTime = Date.now();
    const checkCmd = `curl -s --unix-socket ${socketPath} http://localhost/`;

    while (Date.now() - startTime < timeout) {
      try {
        let result: { exitCode: number };
        if (conn) {
          result = await conn.execute(checkCmd);
        } else {
          try {
            await execAsync(checkCmd);
            result = { exitCode: 0 };
          } catch {
            result = { exitCode: 1 };
          }
        }

        if (result.exitCode === 0) {
          return;
        }
      } catch {
        // Not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Timeout waiting for Firecracker VM to be ready');
  }

  private parseMemoryToMiB(memory: string): number {
    const match = memory.match(/^(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|KB|MB|GB|k|m|g)?$/i);
    if (!match) {
      return 128; // Default
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'mib').toLowerCase();

    switch (unit) {
      case 'kib':
      case 'kb':
      case 'k':
        return Math.round(value / 1024);
      case 'mib':
      case 'mb':
      case 'm':
        return Math.round(value);
      case 'gib':
      case 'gb':
      case 'g':
        return Math.round(value * 1024);
      default:
        return Math.round(value);
    }
  }

  private parseMemoryToBytes(memory: string): number {
    const match = memory.match(/^(\d+(?:\.\d+)?)\s*(KiB|MiB|GiB|KB|MB|GB|k|m|g)?$/i);
    if (!match) {
      return 128 * 1024 * 1024; // Default 128MiB
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'mib').toLowerCase();

    switch (unit) {
      case 'kib':
      case 'kb':
      case 'k':
        return Math.round(value * 1024);
      case 'mib':
      case 'mb':
      case 'm':
        return Math.round(value * 1024 * 1024);
      case 'gib':
      case 'gb':
      case 'g':
        return Math.round(value * 1024 * 1024 * 1024);
      default:
        return Math.round(value);
    }
  }
}
