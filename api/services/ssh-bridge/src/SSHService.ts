/**
 * SSH Service - Backend SSH Connection Management
 * 
 * Handles SSH connections, command execution, and agent installation
 * using node-ssh library.
 */

import { NodeSSH } from 'node-ssh';
import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface SSHConnectionConfig {
  id: string;
  host: string;
  port: number;
  username: string;
  authType: 'key' | 'password';
  privateKey?: string;
  password?: string;
}

export interface SSHConnectionStatus {
  id: string;
  connected: boolean;
  os?: string;
  architecture?: string;
  dockerInstalled?: boolean;
  a2rInstalled?: boolean;
  error?: string;
}

export interface SSHCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface SystemInfo {
  os: string;
  architecture: string;
  dockerInstalled: boolean;
  a2rInstalled: boolean;
  a2rVersion?: string;
}

// ============================================================================
// SSH Service
// ============================================================================

export class SSHService extends EventEmitter {
  private connections: Map<string, NodeSSH> = new Map();
  private connectionConfigs: Map<string, SSHConnectionConfig> = new Map();

  // ========================================================================
  // Connection Management
  // ========================================================================

  async connect(config: SSHConnectionConfig): Promise<SSHConnectionStatus> {
    try {
      const ssh = new NodeSSH();

      const connectConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 20000,
      };

      if (config.authType === 'key' && config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      } else if (config.authType === 'password' && config.password) {
        connectConfig.password = config.password;
      } else {
        throw new Error('Invalid authentication configuration');
      }

      await ssh.connect(connectConfig);

      // Store connection
      this.connections.set(config.id, ssh);
      this.connectionConfigs.set(config.id, config);

      // Gather system info
      const systemInfo = await this.gatherSystemInfo(config.id);

      this.emit('connected', { id: config.id, ...systemInfo });

      return {
        id: config.id,
        connected: true,
        ...systemInfo,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.emit('error', { id: config.id, error: errorMessage });
      
      return {
        id: config.id,
        connected: false,
        error: errorMessage,
      };
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const ssh = this.connections.get(connectionId);
    if (ssh) {
      ssh.dispose();
      this.connections.delete(connectionId);
      this.connectionConfigs.delete(connectionId);
      this.emit('disconnected', { id: connectionId });
    }
  }

  async testConnection(config: Omit<SSHConnectionConfig, 'id'>): Promise<SSHConnectionStatus> {
    const testId = `test_${Date.now()}`;
    
    try {
      const ssh = new NodeSSH();

      const connectConfig: any = {
        host: config.host,
        port: config.port,
        username: config.username,
        readyTimeout: 15000,
      };

      if (config.authType === 'key' && config.privateKey) {
        connectConfig.privateKey = config.privateKey;
      } else if (config.authType === 'password' && config.password) {
        connectConfig.password = config.password;
      }

      await ssh.connect(connectConfig);

      // Gather system info
      const systemInfo = await this.gatherSystemInfoWithSSH(ssh);

      ssh.dispose();

      return {
        id: testId,
        connected: true,
        ...systemInfo,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      
      return {
        id: testId,
        connected: false,
        error: errorMessage,
      };
    }
  }

  // ========================================================================
  // Command Execution
  // ========================================================================

  async executeCommand(
    connectionId: string, 
    command: string,
    options?: {
      cwd?: string;
      env?: Record<string, string>;
      onStdout?: (data: string) => void;
      onStderr?: (data: string) => void;
    }
  ): Promise<SSHCommandResult> {
    const ssh = this.connections.get(connectionId);
    if (!ssh) {
      throw new Error('SSH connection not found');
    }

    const result = await ssh.execCommand(command, {
      cwd: options?.cwd,
      env: options?.env,
      onStdout: options?.onStdout,
      onStderr: options?.onStderr,
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    };
  }

  async executeCommandStream(
    connectionId: string,
    command: string,
    callbacks: {
      onData: (data: string) => void;
      onError: (error: string) => void;
      onClose: (exitCode: number) => void;
    }
  ): Promise<void> {
    const ssh = this.connections.get(connectionId);
    if (!ssh) {
      throw new Error('SSH connection not found');
    }

    const channel = await ssh.requestShell();

    channel.on('data', (data: Buffer) => {
      callbacks.onData(data.toString());
    });

    channel.stderr.on('data', (data: Buffer) => {
      callbacks.onError(data.toString());
    });

    channel.on('close', (exitCode: number) => {
      callbacks.onClose(exitCode);
    });

    channel.write(`${command}\n`);
  }

  // ========================================================================
  // System Information
  // ========================================================================

  private async gatherSystemInfo(connectionId: string): Promise<SystemInfo> {
    const ssh = this.connections.get(connectionId);
    if (!ssh) {
      throw new Error('SSH connection not found');
    }

    return this.gatherSystemInfoWithSSH(ssh);
  }

  private async gatherSystemInfoWithSSH(ssh: NodeSSH): Promise<SystemInfo> {
    // Get OS info
    const osResult = await ssh.execCommand('cat /etc/os-release | grep PRETTY_NAME');
    const os = osResult.stdout.replace(/PRETTY_NAME="([^"]+)"/, '$1').trim() || 'Unknown';

    // Get architecture
    const archResult = await ssh.execCommand('uname -m');
    const architecture = archResult.stdout.trim() || 'unknown';

    // Check Docker
    const dockerResult = await ssh.execCommand('which docker');
    const dockerInstalled = dockerResult.exitCode === 0;

    // Check A2R Agent
    const a2rResult = await ssh.execCommand('which a2r-node');
    const a2rInstalled = a2rResult.exitCode === 0;

    let a2rVersion: string | undefined;
    if (a2rInstalled) {
      const versionResult = await ssh.execCommand('a2r-node --version');
      a2rVersion = versionResult.stdout.trim();
    }

    return {
      os,
      architecture,
      dockerInstalled,
      a2rInstalled,
      a2rVersion,
    };
  }

  // ========================================================================
  // Agent Installation
  // ========================================================================

  async installA2RAgent(
    connectionId: string,
    options?: {
      version?: string;
      onProgress?: (message: string) => void;
    }
  ): Promise<{ success: boolean; message: string; log: string[] }> {
    const ssh = this.connections.get(connectionId);
    if (!ssh) {
      throw new Error('SSH connection not found');
    }

    const log: string[] = [];
    const version = options?.version || 'latest';

    const logAndEmit = (message: string) => {
      log.push(message);
      options?.onProgress?.(message);
    };

    try {
      logAndEmit('Starting A2R Agent installation...');

      // Check if Docker is installed
      logAndEmit('Checking Docker installation...');
      const dockerCheck = await ssh.execCommand('which docker');
      if (dockerCheck.exitCode !== 0) {
        logAndEmit('Docker not found. Installing Docker...');
        await this.installDocker(ssh, logAndEmit);
      } else {
        logAndEmit('Docker is already installed');
      }

      // Download and install A2R
      logAndEmit(`Downloading A2R Agent (${version})...`);
      const installUrl = `https://install.allternit.com/${version}/install.sh`;
      
      const installResult = await ssh.execCommand(
        `curl -fsSL ${installUrl} | bash`,
        {
          onStdout: (data) => logAndEmit(data.toString()),
          onStderr: (data) => logAndEmit(`ERROR: ${data.toString()}`),
        }
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`Installation failed with exit code ${installResult.exitCode}`);
      }

      // Verify installation
      logAndEmit('Verifying installation...');
      const verifyResult = await ssh.execCommand('a2r-node --version');
      if (verifyResult.exitCode === 0) {
        logAndEmit(`A2R Agent installed successfully: ${verifyResult.stdout.trim()}`);
      }

      // Start A2R service
      logAndEmit('Starting A2R service...');
      await ssh.execCommand('systemctl enable a2r-node && systemctl start a2r-node');

      return {
        success: true,
        message: 'A2R Agent installed and started successfully',
        log,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Installation failed';
      logAndEmit(`Installation failed: ${errorMessage}`);
      
      return {
        success: false,
        message: errorMessage,
        log,
      };
    }
  }

  private async installDocker(
    ssh: NodeSSH,
    log: (message: string) => void
  ): Promise<void> {
    log('Installing Docker...');
    
    const installScript = `
      curl -fsSL https://get.docker.com -o get-docker.sh &&
      sh get-docker.sh &&
      systemctl enable docker &&
      systemctl start docker &&
      usermod -aG docker $USER
    `;

    const result = await ssh.execCommand(installScript);
    
    if (result.exitCode !== 0) {
      throw new Error(`Docker installation failed: ${result.stderr}`);
    }
    
    log('Docker installed successfully');
  }

  // ========================================================================
  // File Operations
  // ========================================================================

  async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const ssh = this.connections.get(connectionId);
    if (!ssh) {
      throw new Error('SSH connection not found');
    }

    await ssh.putFile(localPath, remotePath);
  }

  async downloadFile(
    connectionId: string,
    remotePath: string,
    localPath: string
  ): Promise<void> {
    const ssh = this.connections.get(connectionId);
    if (!ssh) {
      throw new Error('SSH connection not found');
    }

    await ssh.getFile(localPath, remotePath);
  }

  // ========================================================================
  // Cleanup
  // ========================================================================

  async dispose(): Promise<void> {
    for (const [id, ssh] of this.connections) {
      ssh.dispose();
      this.emit('disconnected', { id });
    }
    this.connections.clear();
    this.connectionConfigs.clear();
  }

  isConnected(connectionId: string): boolean {
    return this.connections.has(connectionId);
  }

  getConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const sshService = new SSHService();

export default SSHService;
