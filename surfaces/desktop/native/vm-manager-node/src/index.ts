/**
 * A2R VM Manager - Node.js Bridge
 * 
 * Provides a TypeScript/JavaScript interface to the Swift VM Manager
 * by spawning the CLI tool and communicating via IPC.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

// VM Status Types
export type VMState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error' | 'paused';

export interface VMStatus {
  state: VMState;
  vmName: string;
  pid?: number;
  socketPath: string;
  vsockPort: number;
  errorMessage?: string;
  uptime?: number;
}

export interface VMConfiguration {
  vmName?: string;
  kernelPath?: string;
  initrdPath?: string;
  rootfsPath?: string;
  cpuCount?: number;
  memorySizeMB?: number;
  vsockPort?: number;
  socketPath?: string;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

export interface ExecuteOptions {
  workingDir?: string;
  env?: Record<string, string>;
  timeout?: number;
}

/**
 * A2R VM Manager - Manages Linux VMs on macOS
 */
export class A2RVMManager extends EventEmitter {
  private vmProcess?: ChildProcess;
  private config: Required<VMConfiguration>;
  private status: VMStatus;
  private statusCheckInterval?: NodeJS.Timeout;

  constructor(config: VMConfiguration = {}) {
    super();
    
    const home = os.homedir();
    
    this.config = {
      vmName: config.vmName ?? 'a2r-vm',
      kernelPath: config.kernelPath ?? path.join(home, '.a2r/vm-images/vmlinux-6.5.0-a2r'),
      initrdPath: config.initrdPath ?? path.join(home, '.a2r/vm-images/initrd.img-6.5.0-a2r'),
      rootfsPath: config.rootfsPath ?? path.join(home, '.a2r/vm-images/ubuntu-22.04-a2r-v1.1.0.ext4'),
      cpuCount: config.cpuCount ?? 4,
      memorySizeMB: config.memorySizeMB ?? 4096,
      vsockPort: config.vsockPort ?? 8080,
      socketPath: config.socketPath ?? path.join(home, '.a2r/desktop-vm.sock'),
    };

    this.status = {
      state: 'stopped',
      vmName: this.config.vmName,
      socketPath: this.config.socketPath,
      vsockPort: this.config.vsockPort,
    };
  }

  /**
   * Get the path to the Swift CLI binary
   */
  private getCliPath(): string {
    // Check multiple locations
    const possiblePaths = [
      // Development path
      path.join(__dirname, '../../vm-manager/.build/release/vm-manager-cli'),
      // Installed path
      path.join(__dirname, '../bin/vm-manager-cli'),
      // System path
      '/usr/local/bin/vm-manager-cli',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    throw new Error('vm-manager-cli not found. Please build the Swift package first.');
  }

  /**
   * Get current VM status
   */
  getStatus(): VMStatus {
    return { ...this.status };
  }

  /**
   * Check if VM is running
   */
  isRunning(): boolean {
    return this.status.state === 'running';
  }

  /**
   * Start the VM
   */
  async start(): Promise<void> {
    if (this.isRunning()) {
      throw new Error('VM is already running');
    }

    this.updateStatus({ state: 'starting' });

    return new Promise((resolve, reject) => {
      const cliPath = this.getCliPath();
      
      const args = [
        'start',
        '--kernel', this.config.kernelPath,
        '--initrd', this.config.initrdPath,
        '--rootfs', this.config.rootfsPath,
        '--cpus', String(this.config.cpuCount),
        '--memory', String(this.config.memorySizeMB),
        '--socket', this.config.socketPath,
      ];

      console.log('[VMManager] Starting VM...');
      console.log(`[VMManager] CLI: ${cliPath}`);
      
      this.vmProcess = spawn(cliPath, args, {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      this.vmProcess.stdout?.on('data', (data) => {
        const str = data.toString();
        stdout += str;
        console.log(`[VM] ${str.trim()}`);

        // Parse status updates
        if (str.includes('[Status]')) {
          const match = str.match(/\[Status\]\s+(\w+)/);
          if (match) {
            this.updateStatus({ state: match[1] as VMState });
          }
        }

        // Check for successful start
        if (str.includes('VM started successfully')) {
          this.updateStatus({ state: 'running' });
          this.startStatusMonitoring();
          resolve();
        }
      });

      this.vmProcess.stderr?.on('data', (data) => {
        const str = data.toString();
        stderr += str;
        console.error(`[VM] ${str.trim()}`);
      });

      this.vmProcess.on('error', (error) => {
        this.updateStatus({ state: 'error', errorMessage: error.message });
        reject(error);
      });

      this.vmProcess.on('exit', (code) => {
        if (code !== 0 && this.status.state !== 'running') {
          this.updateStatus({ 
            state: 'error', 
            errorMessage: `VM process exited with code ${code}\n${stderr}` 
          });
          reject(new Error(`VM failed to start: ${stderr}`));
        } else if (this.status.state === 'running') {
          // VM was running but exited
          this.updateStatus({ state: 'stopped' });
          this.emit('stopped');
        }
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (this.status.state === 'starting') {
          this.vmProcess?.kill();
          reject(new Error('VM start timeout'));
        }
      }, 60000);
    });
  }

  /**
   * Stop the VM
   */
  async stop(): Promise<void> {
    if (!this.isRunning()) {
      console.log('[VMManager] VM is not running');
      return;
    }

    this.updateStatus({ state: 'stopping' });

    return new Promise((resolve, reject) => {
      const cliPath = this.getCliPath();
      
      const proc = spawn(cliPath, ['stop'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        this.stopStatusMonitoring();
        
        if (code === 0) {
          this.vmProcess?.kill();
          this.vmProcess = undefined;
          this.updateStatus({ state: 'stopped' });
          resolve();
        } else {
          reject(new Error(`Failed to stop VM: ${stderr}`));
        }
      });
    });
  }

  /**
   * Restart the VM
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Execute a command in the VM
   */
  async execute(
    command: string,
    args: string[] = [],
    options: ExecuteOptions = {}
  ): Promise<CommandResult> {
    if (!this.isRunning()) {
      throw new Error('VM is not running');
    }

    return new Promise((resolve, reject) => {
      const cliPath = this.getCliPath();
      const execArgs = ['exec', command, ...args];
      
      const proc = spawn(cliPath, execArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: options.timeout ?? 60000,
      });

      let stdout = '';
      let stderr = '';
      let startTime = Date.now();

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        const executionTime = Date.now() - startTime;
        
        resolve({
          success: code === 0,
          stdout,
          stderr,
          exitCode: code ?? -1,
          executionTime,
        });
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check if VM images exist
   */
  async checkImages(): Promise<boolean> {
    const requiredFiles = [
      this.config.kernelPath,
      this.config.initrdPath,
      this.config.rootfsPath,
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        console.log(`[VMManager] Missing: ${file}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Setup VM (check/download images)
   */
  async setup(): Promise<void> {
    const cliPath = this.getCliPath();
    
    return new Promise((resolve, reject) => {
      const proc = spawn(cliPath, ['setup'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      proc.stdout?.on('data', (data) => {
        console.log(data.toString().trim());
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Setup failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Update status and emit event
   */
  private updateStatus(updates: Partial<VMStatus>): void {
    this.status = { ...this.status, ...updates };
    this.emit('statusChanged', this.status);
  }

  /**
   * Start periodic status monitoring
   */
  private startStatusMonitoring(): void {
    this.statusCheckInterval = setInterval(async () => {
      try {
        // In a full implementation, this would query the VM for actual status
        // For now, we just track uptime
        if (this.status.state === 'running' && this.status.uptime !== undefined) {
          this.status.uptime += 1;
        }
      } catch (error) {
        console.error('[VMManager] Status check failed:', error);
      }
    }, 1000);
  }

  /**
   * Stop status monitoring
   */
  private stopStatusMonitoring(): void {
    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = undefined;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopStatusMonitoring();
    if (this.vmProcess) {
      this.vmProcess.kill();
    }
  }
}

// Export singleton instance factory
export function createVMManager(config?: VMConfiguration): A2RVMManager {
  return new A2RVMManager(config);
}

// Default export
export default A2RVMManager;
