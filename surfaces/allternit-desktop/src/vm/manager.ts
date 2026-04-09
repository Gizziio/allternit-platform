/**
 * A2R Desktop VM Manager
 * 
 * Manages the persistent VM lifecycle for the desktop app.
 * Handles:
 * - VM boot/shutdown
 * - a2r-vm-executor lifecycle
 * - Unix socket server for CLI connections
 * - Health monitoring
 * 
 * Architecture:
 * ```
 * Desktop App
 *   └── VmManager
 *         ├── AppleVfDriver (macOS) or FirecrackerDriver (Linux)
 *         │       └── VSOCK
 *         │               └── a2r-vm-executor (inside VM)
 *         └── SocketServer
 *                 └── /var/run/a2r/desktop-vm.sock
 *                         └── CLI connections
 * ```
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn, ChildProcess } from 'child_process';

// Platform-specific driver imports
// These would be implemented as native Node addons or use FFI
const isMacOS = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

interface VmConfig {
  kernelPath: string;
  initrdPath: string;
  rootfsPath: string;
  memoryMb: number;
  cpuCount: number;
  vsockPort: number;
  socketPath: string;
  workspacePath: string;
}

interface VmState {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
  pid?: number;
  cid?: number; // VSOCK context ID
  executorConnected: boolean;
  lastError?: string;
  bootTime?: Date;
}

interface SocketClient {
  id: string;
  socket: net.Socket;
  authenticated: boolean;
}

/**
 * VM Manager for desktop app
 */
export class VmManager extends EventEmitter {
  private config: VmConfig;
  private state: VmState = {
    status: 'stopped',
    executorConnected: false,
  };
  private vmProcess?: ChildProcess;
  private socketServer?: net.Server;
  private clients: Map<string, SocketClient> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private socketPath: string;

  constructor(config: Partial<VmConfig> = {}) {
    super();
    
    // Default configuration
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    const vmImagesDir = path.join(homeDir, '.a2r/vm-images');
    
    this.config = {
      kernelPath: path.join(vmImagesDir, 'vmlinux-6.5.0-a2r'),
      initrdPath: path.join(vmImagesDir, 'initrd.img-6.5.0-a2r'),
      rootfsPath: path.join(vmImagesDir, 'ubuntu-22.04-a2r-v1.1.0.ext4'),
      memoryMb: 2048,
      cpuCount: 2,
      vsockPort: 8080,
      socketPath: '/var/run/a2r/desktop-vm.sock',
      workspacePath: path.join(homeDir, 'workspace'),
      ...config,
    };
    
    this.socketPath = this.config.socketPath;
  }

  /**
   * Initialize the VM manager
   */
  async initialize(): Promise<void> {
    this.emit('log', 'Initializing VM Manager...');
    
    // Ensure socket directory exists
    await this.ensureSocketDirectory();
    
    // Check if VM images exist
    const imagesExist = await this.checkVmImages();
    if (!imagesExist) {
      this.emit('error', new Error('VM images not found. Run setup first.'));
      throw new Error('VM images not found');
    }
    
    this.emit('log', 'VM Manager initialized');
  }

  /**
   * Start the persistent VM
   */
  async startVm(): Promise<void> {
    if (this.state.status === 'running') {
      this.emit('log', 'VM is already running');
      return;
    }

    if (this.state.status === 'starting') {
      this.emit('log', 'VM is already starting');
      return;
    }

    this.setState({ status: 'starting' });
    this.emit('log', 'Starting VM...');

    try {
      // Platform-specific VM boot
      if (isMacOS) {
        await this.startMacOSVm();
      } else if (isLinux) {
        await this.startLinuxVm();
      } else {
        throw new Error(`Unsupported platform: ${process.platform}`);
      }

      // Wait for VM to be ready
      await this.waitForVmReady();
      
      // Connect to a2r-vm-executor
      await this.connectExecutor();
      
      // Start socket server for CLI
      await this.startSocketServer();
      
      // Start health monitoring
      this.startHealthCheck();
      
      this.setState({ 
        status: 'running',
        bootTime: new Date(),
      });
      
      this.emit('log', 'VM is running and ready');
      this.emit('ready');
      
    } catch (error) {
      this.setState({ 
        status: 'error',
        lastError: error instanceof Error ? error.message : String(error),
      });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop the VM
   */
  async stopVm(): Promise<void> {
    if (this.state.status === 'stopped') {
      return;
    }

    this.setState({ status: 'stopping' });
    this.emit('log', 'Stopping VM...');

    // Stop health check
    this.stopHealthCheck();

    // Stop socket server
    await this.stopSocketServer();

    // Disconnect from executor
    await this.disconnectExecutor();

    // Stop VM process
    if (this.vmProcess) {
      this.vmProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          this.vmProcess?.kill('SIGKILL');
          resolve();
        }, 10000);
        
        this.vmProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
      
      this.vmProcess = undefined;
    }

    this.setState({ 
      status: 'stopped',
      executorConnected: false,
    });
    
    this.emit('log', 'VM stopped');
  }

  /**
   * Restart the VM
   */
  async restartVm(): Promise<void> {
    await this.stopVm();
    await this.startVm();
  }

  /**
   * Get current VM state
   */
  getState(): VmState {
    return { ...this.state };
  }

  /**
   * Check if VM is running
   */
  isRunning(): boolean {
    return this.state.status === 'running';
  }

  /**
   * Check if executor is connected
   */
  isExecutorConnected(): boolean {
    return this.state.executorConnected;
  }

  /**
   * Get number of connected CLI clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Execute a command in the VM (via executor)
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: { 
      timeout?: number;
      workingDir?: string;
      env?: Record<string, string>;
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.state.executorConnected) {
      throw new Error('Executor not connected');
    }

    // TODO: Implement VSOCK protocol communication with executor
    // This would use the a2r-guest-agent-protocol
    
    throw new Error('executeCommand not yet implemented');
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    await this.stopVm();
    
    // Clean up socket file
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // Ignore if doesn't exist
    }
    
    this.removeAllListeners();
  }

  // === Private Methods ===

  private setState(updates: Partial<VmState>): void {
    this.state = { ...this.state, ...updates };
    this.emit('stateChange', this.state);
  }

  private async ensureSocketDirectory(): Promise<void> {
    const dir = path.dirname(this.socketPath);
    try {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    } catch (error) {
      // Fallback to home directory if /var/run is not writable
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        const homeDir = process.env.HOME || '/tmp';
        this.socketPath = path.join(homeDir, '.a2r/desktop-vm.sock');
        await fs.mkdir(path.dirname(this.socketPath), { recursive: true });
      }
    }
  }

  private async checkVmImages(): Promise<boolean> {
    try {
      await fs.access(this.config.kernelPath);
      await fs.access(this.config.rootfsPath);
      return true;
    } catch {
      return false;
    }
  }

  private async startMacOSVm(): Promise<void> {
    // On macOS, we use the Apple Virtualization.framework via a native addon
    // This is a placeholder - actual implementation would use node-api
    
    this.emit('log', 'Starting Apple Virtualization VM...');
    
    // For now, simulate with a placeholder
    // In reality, this would:
    // 1. Load the native addon (binding to AppleVfDriver Rust code)
    // 2. Create VZVirtualMachine configuration
    // 3. Start the VM with the kernel and rootfs
    // 4. Set up VZVirtioSocket for communication
    
    throw new Error('macOS VM support requires native addon implementation');
  }

  private async startLinuxVm(): Promise<void> {
    // On Linux, use Firecracker
    this.emit('log', 'Starting Firecracker VM...');

    const firecrackerPath = await this.findFirecracker();
    if (!firecrackerPath) {
      throw new Error('Firecracker not found. Install it first.');
    }

    // Create Firecracker config
    const configPath = await this.createFirecrackerConfig();

    // Start Firecracker
    this.vmProcess = spawn(firecrackerPath, [
      '--api-sock', '/tmp/a2r-firecracker.sock',
      '--config-file', configPath,
    ], {
      detached: false,
    });

    this.vmProcess.on('exit', (code) => {
      this.emit('log', `VM process exited with code ${code}`);
      if (this.state.status !== 'stopping') {
        this.setState({ 
          status: 'error',
          lastError: `VM exited unexpectedly with code ${code}`,
        });
        this.emit('error', new Error(`VM exited with code ${code}`));
      }
    });

    this.vmProcess.on('error', (error) => {
      this.emit('error', error);
    });

    // Capture logs
    this.vmProcess.stdout?.on('data', (data) => {
      this.emit('vmLog', data.toString());
    });

    this.vmProcess.stderr?.on('data', (data) => {
      this.emit('vmLog', data.toString());
    });

    this.setState({ pid: this.vmProcess.pid });
  }

  private async findFirecracker(): Promise<string | null> {
    const paths = [
      '/usr/local/bin/firecracker',
      '/usr/bin/firecracker',
      path.join(process.env.HOME || '', '.local/bin/firecracker'),
    ];

    for (const p of paths) {
      try {
        await fs.access(p);
        return p;
      } catch {
        continue;
      }
    }

    return null;
  }

  private async createFirecrackerConfig(): Promise<string> {
    const config = {
      'boot-source': {
        'kernel_image_path': this.config.kernelPath,
        'initrd_path': this.config.initrdPath,
        'boot_args': 'console=ttyS0 reboot=k panic=1 pci=off nomodules',
      },
      'drives': [
        {
          'drive_id': 'rootfs',
          'path_on_host': this.config.rootfsPath,
          'is_root_device': true,
          'is_read_only': false,
        },
      ],
      'machine-config': {
        'vcpu_count': this.config.cpuCount,
        'mem_size_mib': this.config.memoryMb,
      },
      'vsock': {
        'guest_cid': 3,
        'uds_path': '/tmp/a2r-vsock.sock',
      },
    };

    const configPath = '/tmp/a2r-firecracker-config.json';
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  private async waitForVmReady(): Promise<void> {
    // Wait for VM to boot and executor to be ready
    const maxWait = 60000; // 60 seconds
    const interval = 1000;
    let waited = 0;

    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        waited += interval;
        
        if (waited >= maxWait) {
          clearInterval(check);
          reject(new Error('VM boot timeout'));
        }

        // TODO: Check if VM is actually ready (ping executor)
        // For now, just wait a fixed time
        if (waited >= 10000) {
          clearInterval(check);
          resolve();
        }
      }, interval);
    });
  }

  private async connectExecutor(): Promise<void> {
    // TODO: Implement VSOCK connection to a2r-vm-executor
    // This would use the a2r-guest-agent-protocol crate
    
    this.emit('log', 'Connecting to a2r-vm-executor...');
    
    // Placeholder - actual implementation would establish VSOCK connection
    this.setState({ executorConnected: true });
    this.emit('log', 'Connected to a2r-vm-executor');
  }

  private async disconnectExecutor(): Promise<void> {
    this.setState({ executorConnected: false });
  }

  private async startSocketServer(): Promise<void> {
    // Remove old socket file if exists
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // Ignore if doesn't exist
    }

    this.socketServer = net.createServer((socket) => {
      this.handleSocketConnection(socket);
    });

    return new Promise((resolve, reject) => {
      this.socketServer!.listen(this.socketPath, () => {
        this.emit('log', `Socket server listening on ${this.socketPath}`);
        resolve();
      });

      this.socketServer!.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async stopSocketServer(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socketServer) {
        resolve();
        return;
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        client.socket.end();
      }
      this.clients.clear();

      this.socketServer.close(() => {
        this.emit('log', 'Socket server stopped');
        resolve();
      });
    });
  }

  private handleSocketConnection(socket: net.Socket): void {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.emit('log', `CLI client connected: ${clientId}`);

    const client: SocketClient = {
      id: clientId,
      socket,
      authenticated: false,
    };

    this.clients.set(clientId, client);
    this.emit('clientConnected', clientId);

    // Handle data from CLI
    socket.on('data', (data) => {
      this.handleSocketData(client, data);
    });

    // Handle disconnect
    socket.on('close', () => {
      this.clients.delete(clientId);
      this.emit('clientDisconnected', clientId);
      this.emit('log', `CLI client disconnected: ${clientId}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      this.emit('error', error);
    });

    // Send welcome message
    socket.write(JSON.stringify({
      type: 'connected',
      version: '1.1.0',
    }) + '\n');
  }

  private handleSocketData(client: SocketClient, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      
      // TODO: Implement protocol handling
      // Forward to a2r-vm-executor and return results
      
      this.emit('socketMessage', client.id, message);
      
    } catch (error) {
      client.socket.write(JSON.stringify({
        type: 'error',
        error: 'Invalid JSON',
      }) + '\n');
    }
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 5000);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private async performHealthCheck(): Promise<void> {
    // Check if VM process is still running
    if (this.vmProcess && this.vmProcess.exitCode !== null) {
      this.emit('log', 'VM process exited unexpectedly');
      await this.restartVm();
      return;
    }

    // TODO: Ping a2r-vm-executor to check if it's responsive
    
    this.emit('healthCheck', { status: 'ok' });
  }
}

// Singleton instance
let managerInstance: VmManager | null = null;

export function getVmManager(config?: Partial<VmConfig>): VmManager {
  if (!managerInstance) {
    managerInstance = new VmManager(config);
  }
  return managerInstance;
}

export function destroyVmManager(): void {
  managerInstance?.dispose();
  managerInstance = null;
}

// Export types
export type { VmConfig, VmState, SocketClient };
