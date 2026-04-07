import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Client } from 'ssh2';
import { Target, CommandResult } from './EnvironmentEngine';

const execAsync = promisify(exec);

export interface Connection {
  id: string;
  type: 'local' | 'ssh' | 'cloud';
  target: Target;
  execute: (command: string, options?: ExecuteOptions) => Promise<CommandResult>;
  transferFile: (localPath: string, remotePath: string) => Promise<void>;
  transferDirectory: (localPath: string, remotePath: string) => Promise<void>;
  close: () => Promise<void>;
  isConnected: () => boolean;
}

export interface ExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  stdin?: string;
}

export interface CloudInstance {
  id: string;
  provider: string;
  region: string;
  instanceType: string;
  publicIp?: string;
  privateIp?: string;
  status: 'pending' | 'running' | 'stopped' | 'terminated';
  sshKey?: string;
  username: string;
}

export class TargetAdapter {
  private connections: Map<string, Connection> = new Map();
  private cloudInstances: Map<string, CloudInstance> = new Map();

  /**
   * Connect to a target and return a connection handle
   */
  async connect(target: Target): Promise<Connection> {
    const connId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    switch (target.type) {
      case 'local':
        return this.createLocalConnection(connId, target);
      
      case 'ssh':
        return this.createSSHConnection(connId, target);
      
      case 'cloud':
        return this.createCloudConnection(connId, target);
      
      default:
        throw new Error(`Unknown target type: ${target.type}`);
    }
  }

  /**
   * Execute a command on a connection
   */
  async execute(conn: Connection, command: string, options?: ExecuteOptions): Promise<CommandResult> {
    return conn.execute(command, options);
  }

  /**
   * Transfer a file to the target
   */
  async transferFile(conn: Connection, localPath: string, remotePath: string): Promise<void> {
    return conn.transferFile(localPath, remotePath);
  }

  /**
   * Transfer a directory to the target
   */
  async transferDirectory(conn: Connection, localPath: string, remotePath: string): Promise<void> {
    return conn.transferDirectory(localPath, remotePath);
  }

  /**
   * Setup Docker on the target
   */
  async setupDocker(conn: Connection): Promise<void> {
    // Check if Docker is installed
    const checkResult = await conn.execute('which docker');
    
    if (checkResult.exitCode === 0) {
      // Docker is installed, check if daemon is running
      const daemonCheck = await conn.execute('docker info');
      if (daemonCheck.exitCode === 0) {
        return; // Docker is ready
      }
      
      // Try to start Docker
      await this.startDockerDaemon(conn);
      return;
    }

    // Install Docker based on OS
    const osCheck = await conn.execute('cat /etc/os-release');
    const osInfo = osCheck.stdout.toLowerCase();

    if (osInfo.includes('ubuntu') || osInfo.includes('debian')) {
      await this.installDockerDebian(conn);
    } else if (osInfo.includes('centos') || osInfo.includes('rhel') || osInfo.includes('fedora')) {
      await this.installDockerRHEL(conn);
    } else if (osInfo.includes('alpine')) {
      await this.installDockerAlpine(conn);
    } else if (osInfo.includes('arch')) {
      await this.installDockerArch(conn);
    } else {
      throw new Error('Unsupported OS for Docker installation');
    }

    // Start Docker daemon
    await this.startDockerDaemon(conn);

    // Add user to docker group if needed
    await conn.execute('usermod -aG docker $USER || true');
  }

  /**
   * Setup Nix on the target
   */
  async setupNix(conn: Connection): Promise<void> {
    // Check if Nix is installed
    const checkResult = await conn.execute('which nix');
    
    if (checkResult.exitCode === 0) {
      return; // Nix is ready
    }

    // Install Nix
    const installScript = `
      curl -L https://nixos.org/nix/install | sh -s -- --daemon --yes
    `;

    const result = await conn.execute(installScript, { timeout: 300000 });
    
    if (result.exitCode !== 0) {
      throw new Error(`Nix installation failed: ${result.stderr}`);
    }

    // Enable flakes
    const nixConf = `
      experimental-features = nix-command flakes
      max-jobs = auto
      cores = 0
    `;

    await conn.execute(`echo '${nixConf}' | sudo tee /etc/nix/nix.conf`);

    // Restart Nix daemon
    await conn.execute('sudo systemctl restart nix-daemon || sudo pkill -HUP nix-daemon || true');
  }

  /**
   * Setup Kata Containers on the target
   */
  async setupKata(conn: Connection): Promise<void> {
    // Check if Kata is installed
    const checkResult = await conn.execute('which kata-runtime');
    
    if (checkResult.exitCode === 0) {
      return; // Kata is ready
    }

    // Check OS
    const osCheck = await conn.execute('cat /etc/os-release');
    const osInfo = osCheck.stdout.toLowerCase();

    if (osInfo.includes('ubuntu')) {
      // Install Kata on Ubuntu
      const installCmd = `
        ARCH=$(uname -m) && 
        [ "$ARCH" = "x86_64" ] && ARCH="amd64" || true &&
        curl -fsSL https://github.com/kata-containers/kata-containers/releases/download/3.2.0/kata-static-3.2.0-\${ARCH}.tar.xz | \
          sudo tar -xJ -C / &&
        sudo ln -sf /opt/kata/bin/containerd-shim-kata-v2 /usr/local/bin/containerd-shim-kata-v2 &&
        sudo ln -sf /opt/kata/bin/kata-runtime /usr/local/bin/kata-runtime
      `;
      
      const result = await conn.execute(installCmd, { timeout: 120000 });
      if (result.exitCode !== 0) {
        throw new Error(`Kata installation failed: ${result.stderr}`);
      }
    } else {
      throw new Error('Kata installation only supported on Ubuntu');
    }

    // Configure Docker to use Kata
    const daemonConfig = {
      'runtimes': {
        'kata': {
          'path': '/usr/local/bin/kata-runtime'
        },
        'kata-qemu': {
          'path': '/opt/kata/bin/containerd-shim-kata-v2'
        }
      }
    };

    await conn.execute(`echo '${JSON.stringify(daemonConfig)}' | sudo tee /etc/docker/daemon.json`);
    await conn.execute('sudo systemctl restart docker');
  }

  /**
   * Setup Firecracker on the target
   */
  async setupFirecracker(conn: Connection): Promise<void> {
    // Check if Firecracker is installed
    const checkResult = await conn.execute('which firecracker');
    
    if (checkResult.exitCode === 0) {
      return; // Firecracker is ready
    }

    // Install Firecracker
    const installCmd = `
      ARCH=$(uname -m) &&
      [ "$ARCH" = "x86_64" ] && ARCH="x86_64" || ARCH="aarch64" &&
      latest=$(curl -s https://api.github.com/repos/firecracker-microvm/firecracker/releases/latest | grep tag_name | cut -d '"' -f 4) &&
      curl -L https://github.com/firecracker-microvm/firecracker/releases/download/\${latest}/firecracker-\${latest}-\${ARCH}.tgz | \
        tar -xz -C /tmp &&
      sudo mv /tmp/release-v*/firecracker-* /usr/local/bin/firecracker &&
      sudo mv /tmp/release-v*/jailer-* /usr/local/bin/jailer
    `;

    const result = await conn.execute(installCmd, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new Error(`Firecracker installation failed: ${result.stderr}`);
    }

    // Setup device permissions
    await conn.execute('sudo chmod a+rw /dev/kvm');

    // Create necessary directories
    await conn.execute('sudo mkdir -p /var/lib/firecracker/images /opt/firecracker');
  }

  /**
   * Provision a cloud instance
   */
  async provisionCloudInstance(
    provider: 'aws' | 'gcp' | 'azure' | 'digitalocean',
    region: string,
    instanceType: string,
    options?: {
      image?: string;
      keyName?: string;
      securityGroups?: string[];
      userData?: string;
    }
  ): Promise<CloudInstance> {
    const instanceId = `cloud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    switch (provider) {
      case 'aws':
        return this.provisionAWSInstance(instanceId, region, instanceType, options);
      case 'digitalocean':
        return this.provisionDOInstance(instanceId, region, instanceType, options);
      default:
        throw new Error(`Cloud provider ${provider} not yet implemented`);
    }
  }

  /**
   * Destroy a cloud instance
   */
  async destroyCloudInstance(instanceId: string): Promise<void> {
    const instance = this.cloudInstances.get(instanceId);
    if (!instance) {
      throw new Error(`Cloud instance not found: ${instanceId}`);
    }

    switch (instance.provider) {
      case 'aws':
        await this.destroyAWSInstance(instance);
        break;
      case 'digitalocean':
        await this.destroyDOInstance(instance);
        break;
    }

    this.cloudInstances.delete(instanceId);
  }

  private createLocalConnection(connId: string, target: Target): Connection {
    return {
      id: connId,
      type: 'local',
      target,
      
      execute: async (command: string, options?: ExecuteOptions): Promise<CommandResult> => {
        const startTime = Date.now();
        const timeout = options?.timeout || 60000;
        
        return new Promise((resolve, reject) => {
          const child = spawn('sh', ['-c', command], {
            cwd: options?.cwd,
            env: { ...process.env, ...options?.env },
            timeout,
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            stdout += data.toString();
          });

          child.stderr?.on('data', (data) => {
            stderr += data.toString();
          });

          if (options?.stdin) {
            child.stdin?.write(options.stdin);
            child.stdin?.end();
          }

          child.on('close', (code) => {
            resolve({
              stdout,
              stderr,
              exitCode: code || 0,
              duration: Date.now() - startTime,
            });
          });

          child.on('error', (error) => {
            reject(error);
          });
        });
      },

      transferFile: async (localPath: string, remotePath: string): Promise<void> => {
        // For local, just copy
        await fs.copyFile(localPath, remotePath);
      },

      transferDirectory: async (localPath: string, remotePath: string): Promise<void> => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        await execAsync(`cp -r ${localPath} ${remotePath}`);
      },

      close: async (): Promise<void> => {
        // Nothing to close for local
      },

      isConnected: (): boolean => true,
    };
  }

  private async createSSHConnection(connId: string, target: Target): Promise<Connection> {
    const privateKey = target.privateKey ? await fs.readFile(target.privateKey) : undefined;
    return new Promise((resolve, reject) => {
      const ssh = new Client();
      
      ssh.on('ready', () => {
        const connection: Connection = {
          id: connId,
          type: 'ssh',
          target,
          
          execute: async (command: string, options?: ExecuteOptions): Promise<CommandResult> => {
            const startTime = Date.now();
            
            return new Promise((resolveExec, rejectExec) => {
              ssh.exec(command, { env: options?.env } as any, (err, stream) => {
                if (err) {
                  rejectExec(err);
                  return;
                }

                let stdout = '';
                let stderr = '';
                let exitCode = 0;

                stream.on('close', (code: number) => {
                  exitCode = code;
                  resolveExec({
                    stdout,
                    stderr,
                    exitCode,
                    duration: Date.now() - startTime,
                  });
                });

                stream.on('data', (data: Buffer) => {
                  stdout += data.toString();
                });

                stream.stderr.on('data', (data: Buffer) => {
                  stderr += data.toString();
                });

                if (options?.stdin) {
                  stream.write(options.stdin);
                  stream.end();
                }
              });
            });
          },

          transferFile: async (localPath: string, remotePath: string): Promise<void> => {
            return new Promise((resolveTransfer, rejectTransfer) => {
              ssh.sftp((err, sftp) => {
                if (err) {
                  rejectTransfer(err);
                  return;
                }

                sftp.fastPut(localPath, remotePath, (err) => {
                  if (err) {
                    rejectTransfer(err);
                  } else {
                    resolveTransfer();
                  }
                });
              });
            });
          },

          transferDirectory: async (localPath: string, remotePath: string): Promise<void> => {
            // Use tar for directory transfer
            const tarCmd = `tar -czf - -C ${path.dirname(localPath)} ${path.basename(localPath)}`;
            const { stdout } = await execAsync(tarCmd);
            
            const mkdirCmd = `mkdir -p ${remotePath}`;
            await connection.execute(mkdirCmd);
            
            const extractCmd = `tar -xzf - -C ${remotePath}`;
            await connection.execute(extractCmd, { stdin: stdout });
          },

          close: async (): Promise<void> => {
            ssh.end();
          },

          isConnected: (): boolean => (ssh as any).readyState === 'open',
        };

        this.connections.set(connId, connection);
        resolve(connection);
      });

      ssh.on('error', (err) => {
        reject(err);
      });

      ssh.connect({
        host: target.host,
        port: target.port || 22,
        username: target.username,
        privateKey,
        readyTimeout: 20000,
      });
    });
  }

  private async createCloudConnection(connId: string, target: Target): Promise<Connection> {
    if (!target.provider || !target.region || !target.instanceType) {
      throw new Error('Cloud target requires provider, region, and instanceType');
    }

    // Provision the instance
    const instance = await this.provisionCloudInstance(
      target.provider,
      target.region,
      target.instanceType
    );

    // Wait for instance to be ready
    while (instance.status !== 'running') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      // Update status (in real implementation, would poll cloud API)
    }

    // Create SSH connection to the instance
    const sshTarget: Target = {
      type: 'ssh',
      host: instance.publicIp || instance.privateIp,
      port: 22,
      username: instance.username,
      privateKey: instance.sshKey,
    };

    return this.createSSHConnection(connId, sshTarget);
  }

  private async startDockerDaemon(conn: Connection): Promise<void> {
    const startCommands = [
      'sudo systemctl start docker',
      'sudo service docker start',
      'sudo dockerd &',
    ];

    for (const cmd of startCommands) {
      const result = await conn.execute(cmd);
      if (result.exitCode === 0) {
        // Verify Docker is running
        const check = await conn.execute('docker info');
        if (check.exitCode === 0) {
          return;
        }
      }
    }

    throw new Error('Failed to start Docker daemon');
  }

  private async installDockerDebian(conn: Connection): Promise<void> {
    const installCmd = `
      sudo apt-get update &&
      sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release &&
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg &&
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null &&
      sudo apt-get update &&
      sudo apt-get install -y docker-ce docker-ce-cli containerd.io
    `;

    const result = await conn.execute(installCmd, { timeout: 300000 });
    if (result.exitCode !== 0) {
      throw new Error(`Docker installation failed: ${result.stderr}`);
    }
  }

  private async installDockerRHEL(conn: Connection): Promise<void> {
    const installCmd = `
      sudo dnf -y install dnf-plugins-core &&
      sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo &&
      sudo dnf install -y docker-ce docker-ce-cli containerd.io
    `;

    const result = await conn.execute(installCmd, { timeout: 300000 });
    if (result.exitCode !== 0) {
      throw new Error(`Docker installation failed: ${result.stderr}`);
    }
  }

  private async installDockerAlpine(conn: Connection): Promise<void> {
    const installCmd = 'sudo apk add --no-cache docker';
    
    const result = await conn.execute(installCmd, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new Error(`Docker installation failed: ${result.stderr}`);
    }
  }

  private async installDockerArch(conn: Connection): Promise<void> {
    const installCmd = 'sudo pacman -S --noconfirm docker';
    
    const result = await conn.execute(installCmd, { timeout: 120000 });
    if (result.exitCode !== 0) {
      throw new Error(`Docker installation failed: ${result.stderr}`);
    }
  }

  private async provisionAWSInstance(
    instanceId: string,
    region: string,
    instanceType: string,
    _options?: { image?: string; keyName?: string; securityGroups?: string[]; userData?: string }
  ): Promise<CloudInstance> {
    // This is a placeholder - real implementation would use AWS SDK
    const instance: CloudInstance = {
      id: instanceId,
      provider: 'aws',
      region,
      instanceType,
      status: 'pending',
      username: 'ubuntu',
    };

    this.cloudInstances.set(instanceId, instance);
    
    // Simulate provisioning
    setTimeout(() => {
      instance.status = 'running';
      instance.publicIp = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
    }, 30000);

    return instance;
  }

  private async provisionDOInstance(
    instanceId: string,
    region: string,
    instanceType: string,
    _options?: { image?: string; keyName?: string; userData?: string }
  ): Promise<CloudInstance> {
    // This is a placeholder - real implementation would use DO API
    const instance: CloudInstance = {
      id: instanceId,
      provider: 'digitalocean',
      region,
      instanceType,
      status: 'pending',
      username: 'root',
    };

    this.cloudInstances.set(instanceId, instance);
    
    // Simulate provisioning
    setTimeout(() => {
      instance.status = 'running';
      instance.publicIp = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
    }, 30000);

    return instance;
  }

  private async destroyAWSInstance(instance: CloudInstance): Promise<void> {
    // Placeholder - would use AWS SDK
    instance.status = 'terminated';
  }

  private async destroyDOInstance(instance: CloudInstance): Promise<void> {
    // Placeholder - would use DO API
    instance.status = 'terminated';
  }
}
