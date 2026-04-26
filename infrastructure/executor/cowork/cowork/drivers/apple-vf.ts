/**
 * Apple Virtualization.framework Driver
 * 
 * Production-ready TypeScript driver for macOS VM management using Apple's
 * native Virtualization.framework. Provides VM lifecycle management, socket
 * communication, and file sharing capabilities.
 * 
 * @module apple-vf
 * @requires macOS 11.0+ (Big Sur)
 * @requires Virtualization.framework
 */

import { EventEmitter } from 'events';
import { existsSync, statSync } from 'fs';
import { resolve, normalize } from 'path';
import { promisify } from 'util';

// ============================================================================
// Type Declarations
// ============================================================================

/**
 * VM Configuration interface
 */
export interface VMConfig {
  /** Unique VM identifier */
  id: string;
  /** Human-readable VM name */
  name: string;
  /** Path to kernel image (vmlinux) */
  kernelPath: string;
  /** Path to initrd image (initrd.img) */
  initrdPath: string;
  /** Path to root filesystem (ext4) */
  rootfsPath: string;
  /** Number of CPU cores */
  cpuCount: number;
  /** Memory size in bytes */
  memorySize: number;
  /** Optional disk size in bytes */
  diskSize?: number;
  /** Shared directories configuration */
  sharedDirectories?: Array<{
    hostPath: string;
    vmPath: string;
    readOnly?: boolean;
  }>;
  /** Enable Rosetta 2 for x86_64 translation on Apple Silicon */
  enableRosetta?: boolean;
  /** Console output buffer size in bytes (default: 1MB) */
  consoleBufferSize?: number;
  /** Socket device port for guest agent communication */
  guestAgentPort?: number;
  /** Auto-start VM on creation */
  autoStart?: boolean;
  /** Boot arguments for kernel */
  bootArgs?: string;
}

/**
 * VM Status enumeration
 */
export enum VMStatus {
  /** VM is not initialized */
  UNKNOWN = 'unknown',
  /** VM configuration is being created */
  CONFIGURING = 'configuring',
  /** VM is configured but not started */
  STOPPED = 'stopped',
  /** VM is starting up */
  STARTING = 'starting',
  /** VM is running */
  RUNNING = 'running',
  /** VM is pausing */
  PAUSING = 'pausing',
  /** VM is paused */
  PAUSED = 'paused',
  /** VM is resuming */
  RESUMING = 'resuming',
  /** VM is stopping */
  STOPPING = 'stopping',
  /** VM encountered an error */
  ERROR = 'error',
}

/**
 * VM instance interface
 */
export interface VMInstance {
  /** VM configuration */
  config: VMConfig;
  /** Current VM status */
  status: VMStatus;
  /** Native VM handle (opaque) */
  handle?: VZVirtualMachine;
  /** Socket connection handle */
  socketConnection?: VZVirtioSocketConnection;
  /** Creation timestamp */
  createdAt: Date;
  /** Start timestamp (if started) */
  startedAt?: Date;
  /** Stop timestamp (if stopped) */
  stoppedAt?: Date;
  /** Console log buffer */
  consoleBuffer: string[];
  /** Guest agent protocol version */
  guestAgentVersion?: number;
}

/**
 * Command execution result
 */
export interface CommandResult {
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Command execution options
 */
export interface CommandOptions {
  /** Working directory in VM */
  workingDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds (default: 60000) */
  timeout?: number;
  /** Run as specific user */
  user?: string;
  /** Stream output instead of buffering */
  stream?: boolean;
}

/**
 * Socket message for guest agent protocol
 */
export interface GuestAgentMessage {
  /** Message type */
  type: 'command' | 'response' | 'event' | 'ping' | 'pong';
  /** Unique message ID */
  id: string;
  /** Payload data */
  payload: unknown;
  /** Timestamp */
  timestamp: number;
}

/**
 * Platform capabilities
 */
export interface PlatformCapabilities {
  /** macOS version */
  macosVersion: string;
  /** Virtualization.framework available */
  virtualizationAvailable: boolean;
  /** Virtualization.framework version */
  virtualizationVersion?: string;
  /** Apple Silicon (ARM64) */
  isAppleSilicon: boolean;
  /** Rosetta 2 available */
  rosettaAvailable: boolean;
  /** Maximum recommended CPUs */
  maxCPUs: number;
  /** Maximum recommended memory in bytes */
  maxMemory: number;
  /** Supports nested virtualization */
  supportsNestedVirtualization: boolean;
}

// ============================================================================
// Native Virtualization.framework Types (Opaque handles)
// ============================================================================

/** Opaque handle to VZVirtualMachine */
interface VZVirtualMachine {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZVirtualMachineConfiguration */
interface VZVirtualMachineConfiguration {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZLinuxBootLoader */
interface VZLinuxBootLoader {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZVirtioSocketDevice */
interface VZVirtioSocketDevice {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZVirtioSocketListener */
interface VZVirtioSocketListener {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZVirtioSocketConnection */
interface VZVirtioSocketConnection {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZVirtioFileSystemDevice */
interface VZVirtioFileSystemDevice {
  readonly _opaque: unique symbol;
}

/** Opaque handle to VZMemoryBalloonDevice */
interface VZMemoryBalloonDevice {
  readonly _opaque: unique symbol;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for Apple Virtualization driver
 */
export class AppleVError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AppleVError';
    Object.setPrototypeOf(this, AppleVError.prototype);
  }
}

/**
 * Platform compatibility error
 */
export class PlatformError extends AppleVError {
  constructor(message: string, cause?: Error) {
    super(message, 'PLATFORM_ERROR', cause);
    this.name = 'PlatformError';
    Object.setPrototypeOf(this, PlatformError.prototype);
  }
}

/**
 * VM configuration error
 */
export class VMConfigError extends AppleVError {
  constructor(message: string, cause?: Error) {
    super(message, 'VM_CONFIG_ERROR', cause);
    this.name = 'VMConfigError';
    Object.setPrototypeOf(this, VMConfigError.prototype);
  }
}

/**
 * VM lifecycle error
 */
export class VMLifecycleError extends AppleVError {
  constructor(
    message: string,
    public readonly vmId: string,
    public readonly currentStatus: VMStatus,
    cause?: Error
  ) {
    super(message, 'VM_LIFECYCLE_ERROR', cause);
    this.name = 'VMLifecycleError';
    Object.setPrototypeOf(this, VMLifecycleError.prototype);
  }
}

/**
 * Command execution error
 */
export class CommandExecutionError extends AppleVError {
  constructor(
    message: string,
    public readonly vmId: string,
    public readonly command: string,
    public readonly exitCode?: number,
    cause?: Error
  ) {
    super(message, 'COMMAND_EXECUTION_ERROR', cause);
    this.name = 'CommandExecutionError';
    Object.setPrototypeOf(this, CommandExecutionError.prototype);
  }
}

/**
 * Socket communication error
 */
export class SocketError extends AppleVError {
  constructor(
    message: string,
    public readonly vmId: string,
    cause?: Error
  ) {
    super(message, 'SOCKET_ERROR', cause);
    this.name = 'SocketError';
    Object.setPrototypeOf(this, SocketError.prototype);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends AppleVError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

// ============================================================================
// Native Binding Interface
// ============================================================================

/**
 * Native binding interface for Virtualization.framework
 * This would be implemented by a Node-API native module
 */
interface VirtualizationNativeBinding {
  /** Check platform capabilities */
  checkPlatform(): PlatformCapabilities;
  
  /** Create VM configuration */
  createConfiguration(config: VMConfig): VZVirtualMachineConfiguration;
  
  /** Validate configuration */
  validateConfiguration(config: VZVirtualMachineConfiguration): {
    valid: boolean;
    errors: string[];
  };
  
  /** Create VM instance */
  createVM(config: VZVirtualMachineConfiguration): VZVirtualMachine;
  
  /** Start VM */
  startVM(vm: VZVirtualMachine): Promise<void>;
  
  /** Stop VM gracefully */
  stopVM(vm: VZVirtualMachine): Promise<void>;
  
  /** Pause VM */
  pauseVM(vm: VZVirtualMachine): Promise<void>;
  
  /** Resume VM */
  resumeVM(vm: VZVirtualMachine): Promise<void>;
  
  /** Force stop VM */
  destroyVM(vm: VZVirtualMachine): Promise<void>;
  
  /** Get VM state */
  getVMState(vm: VZVirtualMachine): VMStatus;
  
  /** Create socket listener */
  createSocketListener(port: number): VZVirtioSocketListener;
  
  /** Accept socket connection */
  acceptSocketConnection(listener: VZVirtioSocketListener): Promise<VZVirtioSocketConnection>;
  
  /** Send data over socket */
  sendSocketData(connection: VZVirtioSocketConnection, data: Buffer): Promise<void>;
  
  /** Receive data from socket */
  receiveSocketData(connection: VZVirtioSocketConnection, maxBytes?: number): Promise<Buffer>;
  
  /** Close socket connection */
  closeSocketConnection(connection: VZVirtioSocketConnection): Promise<void>;
  
  /** Get console output */
  getConsoleOutput(vm: VZVirtualMachine): string;
  
  /** Setup file sharing */
  setupFileSharing(vm: VZVirtualMachine, directories: VMConfig['sharedDirectories']): void;
}

// ============================================================================
// Native Binding Loader
// ============================================================================

let nativeBinding: VirtualizationNativeBinding | null = null;

/**
 * Load native binding module
 * Attempts to load the compiled native module, falls back to mock in development
 */
function loadNativeBinding(): VirtualizationNativeBinding {
  if (nativeBinding) {
    return nativeBinding;
  }

  try {
    // Try to load the native module
    const binding = require('./native/apple-vf-native');
    nativeBinding = binding as VirtualizationNativeBinding;
    return nativeBinding;
  } catch (error) {
    // In development/testing without native module, use mock implementation
    if (process.env.Allternit_MOCK_VIRTUALIZATION === '1') {
      nativeBinding = createMockBinding();
      return nativeBinding;
    }
    
    throw new PlatformError(
      'Failed to load Virtualization.framework native binding. ' +
      'Ensure the native module is compiled or set Allternit_MOCK_VIRTUALIZATION=1 for testing.',
      error as Error
    );
  }
}

/**
 * Create mock binding for development/testing
 */
function createMockBinding(): VirtualizationNativeBinding {
  const mockVMs = new Map<string, {
    state: VMStatus;
    config: VMConfig;
    console: string[];
  }>();

  return {
    checkPlatform(): PlatformCapabilities {
      return {
        macosVersion: '14.0',
        virtualizationAvailable: true,
        virtualizationVersion: '1.0',
        isAppleSilicon: true,
        rosettaAvailable: true,
        maxCPUs: 8,
        maxMemory: 32 * 1024 * 1024 * 1024,
        supportsNestedVirtualization: false,
      };
    },

    createConfiguration(config: VMConfig): VZVirtualMachineConfiguration {
      return { _opaque: Symbol('config') as unknown as unique symbol };
    },

    validateConfiguration(config: VZVirtualMachineConfiguration): { valid: boolean; errors: string[] } {
      return { valid: true, errors: [] };
    },

    createVM(config: VZVirtualMachineConfiguration): VZVirtualMachine {
      const handle = { _opaque: Symbol('vm') as unknown as unique symbol };
      return handle;
    },

    async startVM(vm: VZVirtualMachine): Promise<void> {
      await delay(100);
    },

    async stopVM(vm: VZVirtualMachine): Promise<void> {
      await delay(100);
    },

    async pauseVM(vm: VZVirtualMachine): Promise<void> {
      await delay(50);
    },

    async resumeVM(vm: VZVirtualMachine): Promise<void> {
      await delay(50);
    },

    async destroyVM(vm: VZVirtualMachine): Promise<void> {
      await delay(50);
    },

    getVMState(vm: VZVirtualMachine): VMStatus {
      return VMStatus.RUNNING;
    },

    createSocketListener(port: number): VZVirtioSocketListener {
      return { _opaque: Symbol('listener') as unknown as unique symbol };
    },

    async acceptSocketConnection(listener: VZVirtioSocketListener): Promise<VZVirtioSocketConnection> {
      await delay(10);
      return { _opaque: Symbol('connection') as unknown as unique symbol };
    },

    async sendSocketData(connection: VZVirtioSocketConnection, data: Buffer): Promise<void> {
      await delay(10);
    },

    async receiveSocketData(connection: VZVirtioSocketConnection, maxBytes?: number): Promise<Buffer> {
      await delay(10);
      return Buffer.from(JSON.stringify({ type: 'response', id: '1', payload: {}, timestamp: Date.now() }));
    },

    async closeSocketConnection(connection: VZVirtioSocketConnection): Promise<void> {
      await delay(10);
    },

    getConsoleOutput(vm: VZVirtualMachine): string {
      return '[mock console output]';
    },

    setupFileSharing(vm: VZVirtualMachine, directories: VMConfig['sharedDirectories']): void {
      // Mock implementation
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Delay utility
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Resolve and validate file path
 */
function resolvePath(filePath: string): string {
  const expanded = filePath.replace(/^~/, process.env.HOME || '');
  return resolve(normalize(expanded));
}

/**
 * Validate file exists
 */
function validateFileExists(filePath: string, description: string): void {
  const resolved = resolvePath(filePath);
  if (!existsSync(resolved)) {
    throw new VMConfigError(`${description} not found: ${filePath}`);
  }
  
  const stats = statSync(resolved);
  if (!stats.isFile()) {
    throw new VMConfigError(`${description} is not a file: ${filePath}`);
  }
}

/**
 * Validate VM configuration
 */
function validateConfig(config: VMConfig): void {
  if (!config.id || typeof config.id !== 'string') {
    throw new VMConfigError('VM ID is required and must be a string');
  }

  if (!config.name || typeof config.name !== 'string') {
    throw new VMConfigError('VM name is required and must be a string');
  }

  if (!config.kernelPath) {
    throw new VMConfigError('Kernel path is required');
  }
  validateFileExists(config.kernelPath, 'Kernel image');

  if (!config.initrdPath) {
    throw new VMConfigError('Initrd path is required');
  }
  validateFileExists(config.initrdPath, 'Initrd image');

  if (!config.rootfsPath) {
    throw new VMConfigError('Rootfs path is required');
  }
  validateFileExists(config.rootfsPath, 'Root filesystem');

  if (config.cpuCount < 1 || config.cpuCount > 64) {
    throw new VMConfigError('CPU count must be between 1 and 64');
  }

  const minMemory = 256 * 1024 * 1024; // 256MB
  const maxMemory = 128 * 1024 * 1024 * 1024; // 128GB
  if (config.memorySize < minMemory || config.memorySize > maxMemory) {
    throw new VMConfigError(`Memory size must be between ${minMemory} and ${maxMemory} bytes`);
  }

  if (config.sharedDirectories) {
    for (const dir of config.sharedDirectories) {
      if (!existsSync(resolvePath(dir.hostPath))) {
        throw new VMConfigError(`Shared directory not found: ${dir.hostPath}`);
      }
    }
  }
}

/**
 * Check if running on macOS
 */
function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Check macOS version
 */
function getMacOSVersion(): string {
  if (!isMacOS()) {
    return '';
  }
  
  try {
    const { execSync } = require('child_process');
    const version = execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
    return version;
  } catch {
    return '';
  }
}

/**
 * Check if Virtualization.framework is available
 */
function checkVirtualizationFramework(): boolean {
  if (!isMacOS()) {
    return false;
  }

  const version = getMacOSVersion();
  if (!version) {
    return false;
  }

  // Virtualization.framework requires macOS 11.0+
  const [major] = version.split('.').map(Number);
  return major >= 11;
}

/**
 * Check if Rosetta 2 is available
 */
function checkRosetta2(): boolean {
  if (!isMacOS()) {
    return false;
  }

  try {
    const { execSync } = require('child_process');
    execSync('arch -x86_64 /usr/bin/true', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if running on Apple Silicon
 */
function isAppleSilicon(): boolean {
  return process.arch === 'arm64' && isMacOS();
}

// ============================================================================
// Apple Virtualization Driver Class
// ============================================================================

/**
 * Apple Virtualization.framework Driver
 * 
 * Provides complete VM lifecycle management using Apple's native
 * Virtualization.framework on macOS 11.0+ (Big Sur and later).
 * 
 * @example
 * ```typescript
 * const driver = new AppleVFDriver();
 * 
 * const vm = await driver.createVM({
 *   id: "vm-001",
 *   name: "Ubuntu 22.04",
 *   kernelPath: "~/.allternit/images/vmlinux-6.5.0-allternit-arm64",
 *   initrdPath: "~/.allternit/images/initrd.img-6.5.0-allternit-arm64",
 *   rootfsPath: "~/.allternit/images/ubuntu-22.04.ext4",
 *   cpuCount: 4,
 *   memorySize: 8 * 1024 * 1024 * 1024,
 * });
 * 
 * await driver.startVM(vm);
 * const result = await driver.executeCommand(vm, "uname -a");
 * await driver.stopVM(vm);
 * ```
 */
export class AppleVFDriver extends EventEmitter {
  private binding: VirtualizationNativeBinding;
  private vms: Map<string, VMInstance> = new Map();
  private capabilities: PlatformCapabilities | null = null;
  private readonly defaultTimeout = 60000;
  private readonly commandTimeout = 300000;

  /**
   * Creates an instance of AppleVFDriver
   * @throws {PlatformError} If not running on macOS or Virtualization.framework unavailable
   */
  constructor() {
    super();
    
    if (!isMacOS()) {
      throw new PlatformError(
        `AppleVFDriver requires macOS. Current platform: ${process.platform}`
      );
    }

    if (!checkVirtualizationFramework()) {
      throw new PlatformError(
        'Virtualization.framework requires macOS 11.0 (Big Sur) or later'
      );
    }

    this.binding = loadNativeBinding();
  }

  /**
   * Get platform capabilities
   * @returns {PlatformCapabilities} Platform capability information
   */
  getPlatformCapabilities(): PlatformCapabilities {
    if (!this.capabilities) {
      this.capabilities = this.binding.checkPlatform();
      
      // Enhance with runtime checks
      this.capabilities = {
        ...this.capabilities,
        rosettaAvailable: checkRosetta2(),
        isAppleSilicon: isAppleSilicon(),
      };
    }
    
    return this.capabilities;
  }

  /**
   * Validate platform compatibility
   * @returns {Promise<{ compatible: boolean; issues: string[] }>} Validation result
   */
  async validatePlatform(): Promise<{ compatible: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    if (!isMacOS()) {
      issues.push(`Incompatible platform: ${process.platform}. macOS required.`);
      return { compatible: false, issues };
    }

    const caps = this.getPlatformCapabilities();
    
    if (!caps.virtualizationAvailable) {
      issues.push('Virtualization.framework not available');
    }

    if (caps.isAppleSilicon && !caps.rosettaAvailable) {
      issues.push('Rosetta 2 not installed. Required for x86_64 VM support on Apple Silicon.');
    }

    return {
      compatible: issues.length === 0,
      issues,
    };
  }

  /**
   * Create a new VM instance
   * @param {VMConfig} config - VM configuration
   * @returns {Promise<VMInstance>} Created VM instance
   * @throws {VMConfigError} If configuration is invalid
   */
  async createVM(config: VMConfig): Promise<VMInstance> {
    // Validate configuration
    validateConfig(config);

    // Check platform limits
    const caps = this.getPlatformCapabilities();
    if (config.cpuCount > caps.maxCPUs) {
      throw new VMConfigError(
        `CPU count ${config.cpuCount} exceeds maximum ${caps.maxCPUs}`
      );
    }

    if (config.memorySize > caps.maxMemory) {
      throw new VMConfigError(
        `Memory size ${config.memorySize} exceeds maximum ${caps.maxMemory}`
      );
    }

    // Create VM instance
    const vm: VMInstance = {
      config: {
        ...config,
        guestAgentPort: config.guestAgentPort || 1024,
        consoleBufferSize: config.consoleBufferSize || 1024 * 1024,
      },
      status: VMStatus.CONFIGURING,
      createdAt: new Date(),
      consoleBuffer: [],
    };

    this.vms.set(config.id, vm);
    this.emit('vm:created', { vmId: config.id, name: config.name });

    try {
      // Create native configuration
      const nativeConfig = this.binding.createConfiguration(vm.config);
      
      // Validate native configuration
      const validation = this.binding.validateConfiguration(nativeConfig);
      if (!validation.valid) {
        throw new VMConfigError(
          `Native configuration validation failed: ${validation.errors.join(', ')}`
        );
      }

      // Create native VM
      const handle = this.binding.createVM(nativeConfig);
      vm.handle = handle;
      vm.status = VMStatus.STOPPED;

      // Setup file sharing if configured
      if (vm.config.sharedDirectories && vm.config.sharedDirectories.length > 0) {
        this.binding.setupFileSharing(handle, vm.config.sharedDirectories);
      }

      this.emit('vm:configured', { vmId: config.id });

      // Auto-start if configured
      if (vm.config.autoStart) {
        await this.startVM(vm);
      }

      return vm;
    } catch (error) {
      vm.status = VMStatus.ERROR;
      this.emit('vm:error', { vmId: config.id, error });
      throw new VMConfigError(
        `Failed to create VM: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * Start a VM
   * @param {VMInstance} vm - VM instance to start
   * @returns {Promise<void>}
   * @throws {VMLifecycleError} If VM cannot be started
   */
  async startVM(vm: VMInstance): Promise<void> {
    if (!vm.handle) {
      throw new VMLifecycleError(
        'VM not initialized',
        vm.config.id,
        vm.status
      );
    }

    if (vm.status === VMStatus.RUNNING) {
      return; // Already running
    }

    if (vm.status !== VMStatus.STOPPED && vm.status !== VMStatus.ERROR) {
      throw new VMLifecycleError(
        `Cannot start VM from state: ${vm.status}`,
        vm.config.id,
        vm.status
      );
    }

    const previousStatus = vm.status;
    vm.status = VMStatus.STARTING;
    this.emit('vm:starting', { vmId: vm.config.id });

    try {
      await this.binding.startVM(vm.handle);
      vm.status = VMStatus.RUNNING;
      vm.startedAt = new Date();
      
      // Setup socket listener for guest agent
      await this.setupGuestAgentSocket(vm);
      
      this.emit('vm:started', { vmId: vm.config.id });
    } catch (error) {
      vm.status = previousStatus === VMStatus.ERROR ? VMStatus.ERROR : VMStatus.STOPPED;
      this.emit('vm:error', { vmId: vm.config.id, error });
      throw new VMLifecycleError(
        `Failed to start VM: ${(error as Error).message}`,
        vm.config.id,
        vm.status,
        error as Error
      );
    }
  }

  /**
   * Stop a VM gracefully
   * @param {VMInstance} vm - VM instance to stop
   * @param {number} timeoutMs - Timeout for graceful shutdown (default: 60000)
   * @returns {Promise<void>}
   * @throws {VMLifecycleError} If VM cannot be stopped
   */
  async stopVM(vm: VMInstance, timeoutMs: number = this.defaultTimeout): Promise<void> {
    if (!vm.handle) {
      throw new VMLifecycleError(
        'VM not initialized',
        vm.config.id,
        vm.status
      );
    }

    if (vm.status === VMStatus.STOPPED) {
      return; // Already stopped
    }

    if (vm.status !== VMStatus.RUNNING && vm.status !== VMStatus.PAUSED) {
      throw new VMLifecycleError(
        `Cannot stop VM from state: ${vm.status}`,
        vm.config.id,
        vm.status
      );
    }

    vm.status = VMStatus.STOPPING;
    this.emit('vm:stopping', { vmId: vm.config.id });

    try {
      // Close socket connection first
      if (vm.socketConnection) {
        await this.binding.closeSocketConnection(vm.socketConnection);
        vm.socketConnection = undefined;
      }

      // Attempt graceful shutdown with timeout
      const stopPromise = this.binding.stopVM(vm.handle);
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new TimeoutError(
          'VM graceful shutdown timed out',
          'stopVM',
          timeoutMs
        )), timeoutMs);
      });

      await Promise.race([stopPromise, timeoutPromise]);
      
      vm.status = VMStatus.STOPPED;
      vm.stoppedAt = new Date();
      this.emit('vm:stopped', { vmId: vm.config.id });
    } catch (error) {
      if (error instanceof TimeoutError) {
        // Force stop on timeout
        this.emit('vm:stopTimeout', { vmId: vm.config.id });
        await this.destroyVM(vm);
      } else {
        vm.status = VMStatus.ERROR;
        this.emit('vm:error', { vmId: vm.config.id, error });
        throw new VMLifecycleError(
          `Failed to stop VM: ${(error as Error).message}`,
          vm.config.id,
          vm.status,
          error as Error
        );
      }
    }
  }

  /**
   * Force stop and cleanup a VM
   * @param {VMInstance} vm - VM instance to destroy
   * @returns {Promise<void>}
   */
  async destroyVM(vm: VMInstance): Promise<void> {
    if (!vm.handle) {
      return;
    }

    this.emit('vm:destroying', { vmId: vm.config.id });

    try {
      // Close socket connection
      if (vm.socketConnection) {
        await this.binding.closeSocketConnection(vm.socketConnection).catch(() => {
          // Ignore socket close errors during destroy
        });
        vm.socketConnection = undefined;
      }

      await this.binding.destroyVM(vm.handle);
      vm.status = VMStatus.STOPPED;
      vm.stoppedAt = new Date();
      
      this.vms.delete(vm.config.id);
      this.emit('vm:destroyed', { vmId: vm.config.id });
    } catch (error) {
      vm.status = VMStatus.ERROR;
      this.emit('vm:error', { vmId: vm.config.id, error });
      throw new VMLifecycleError(
        `Failed to destroy VM: ${(error as Error).message}`,
        vm.config.id,
        vm.status,
        error as Error
      );
    }
  }

  /**
   * Pause a running VM
   * @param {VMInstance} vm - VM instance to pause
   * @returns {Promise<void>}
   */
  async pauseVM(vm: VMInstance): Promise<void> {
    if (!vm.handle || vm.status !== VMStatus.RUNNING) {
      throw new VMLifecycleError(
        'VM must be running to pause',
        vm.config.id,
        vm.status
      );
    }

    vm.status = VMStatus.PAUSING;
    this.emit('vm:pausing', { vmId: vm.config.id });

    try {
      await this.binding.pauseVM(vm.handle);
      vm.status = VMStatus.PAUSED;
      this.emit('vm:paused', { vmId: vm.config.id });
    } catch (error) {
      vm.status = VMStatus.ERROR;
      this.emit('vm:error', { vmId: vm.config.id, error });
      throw new VMLifecycleError(
        `Failed to pause VM: ${(error as Error).message}`,
        vm.config.id,
        vm.status,
        error as Error
      );
    }
  }

  /**
   * Resume a paused VM
   * @param {VMInstance} vm - VM instance to resume
   * @returns {Promise<void>}
   */
  async resumeVM(vm: VMInstance): Promise<void> {
    if (!vm.handle || vm.status !== VMStatus.PAUSED) {
      throw new VMLifecycleError(
        'VM must be paused to resume',
        vm.config.id,
        vm.status
      );
    }

    vm.status = VMStatus.RESUMING;
    this.emit('vm:resuming', { vmId: vm.config.id });

    try {
      await this.binding.resumeVM(vm.handle);
      vm.status = VMStatus.RUNNING;
      this.emit('vm:resumed', { vmId: vm.config.id });
    } catch (error) {
      vm.status = VMStatus.ERROR;
      this.emit('vm:error', { vmId: vm.config.id, error });
      throw new VMLifecycleError(
        `Failed to resume VM: ${(error as Error).message}`,
        vm.config.id,
        vm.status,
        error as Error
      );
    }
  }

  /**
   * Get current VM status
   * @param {VMInstance} vm - VM instance
   * @returns {VMStatus} Current status
   */
  getVMStatus(vm: VMInstance): VMStatus {
    if (vm.handle) {
      // Sync with native state
      try {
        const nativeState = this.binding.getVMState(vm.handle);
        // Only update if not in a transition state
        if (![VMStatus.STARTING, VMStatus.STOPPING, VMStatus.PAUSING, VMStatus.RESUMING].includes(vm.status)) {
          vm.status = nativeState;
        }
      } catch {
        // Ignore errors, use cached state
      }
    }
    
    return vm.status;
  }

  /**
   * Execute a command in the VM
   * @param {VMInstance} vm - VM instance
   * @param {string} command - Command to execute
   * @param {CommandOptions} options - Execution options
   * @returns {Promise<CommandResult>} Command result
   * @throws {CommandExecutionError} If command execution fails
   */
  async executeCommand(
    vm: VMInstance,
    command: string,
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    if (vm.status !== VMStatus.RUNNING) {
      throw new VMLifecycleError(
        'VM must be running to execute commands',
        vm.config.id,
        vm.status
      );
    }

    if (!vm.socketConnection) {
      throw new SocketError(
        'Guest agent socket not connected',
        vm.config.id
      );
    }

    const timeout = options.timeout || this.commandTimeout;
    const startTime = Date.now();
    const messageId = generateId();

    const message: GuestAgentMessage = {
      type: 'command',
      id: messageId,
      payload: {
        command,
        workingDir: options.workingDir,
        env: options.env,
        user: options.user,
      },
      timestamp: startTime,
    };

    try {
      // Send command to guest agent
      const data = Buffer.from(JSON.stringify(message));
      await this.binding.sendSocketData(vm.socketConnection, data);

      // Wait for response with timeout
      const responsePromise = this.waitForResponse(vm, messageId);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new TimeoutError(
          'Command execution timed out',
          'executeCommand',
          timeout
        )), timeout);
      });

      const response = await Promise.race([responsePromise, timeoutPromise]);
      const duration = Date.now() - startTime;

      if (response.payload && typeof response.payload === 'object') {
        const payload = response.payload as {
          exitCode: number;
          stdout: string;
          stderr: string;
        };

        return {
          exitCode: payload.exitCode,
          stdout: payload.stdout,
          stderr: payload.stderr,
          duration,
        };
      }

      throw new CommandExecutionError(
        'Invalid response from guest agent',
        vm.config.id,
        command
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw new CommandExecutionError(
          `Command timed out after ${timeout}ms`,
          vm.config.id,
          command,
          undefined,
          error
        );
      }
      
      throw new CommandExecutionError(
        `Command execution failed: ${(error as Error).message}`,
        vm.config.id,
        command,
        undefined,
        error as Error
      );
    }
  }

  /**
   * Stream VM console logs
   * @param {VMInstance} vm - VM instance
   * @param {boolean} follow - Continuously stream new logs
   * @returns {AsyncGenerator<string>} Console log lines
   */
  async *streamLogs(vm: VMInstance, follow: boolean = false): AsyncGenerator<string> {
    if (!vm.handle) {
      throw new VMLifecycleError(
        'VM not initialized',
        vm.config.id,
        vm.status
      );
    }

    let lastIndex = 0;

    while (true) {
      // Get console output from native layer
      const output = this.binding.getConsoleOutput(vm.handle);
      
      if (output) {
        const lines = output.split('\n');
        
        for (let i = lastIndex; i < lines.length; i++) {
          yield lines[i];
        }
        
        lastIndex = lines.length;
        
        // Store in buffer
        vm.consoleBuffer.push(...lines.slice(lastIndex));
        
        // Trim buffer if exceeds limit
        const maxBufferLines = Math.ceil(vm.config.consoleBufferSize! / 100);
        if (vm.consoleBuffer.length > maxBufferLines) {
          vm.consoleBuffer = vm.consoleBuffer.slice(-maxBufferLines);
        }
      }

      if (!follow) {
        break;
      }

      // Wait before next poll
      await delay(100);

      // Stop streaming if VM is stopped
      if (vm.status === VMStatus.STOPPED || vm.status === VMStatus.ERROR) {
        break;
      }
    }
  }

  /**
   * Get buffered console logs
   * @param {VMInstance} vm - VM instance
   * @param {number} lines - Number of lines to retrieve (default: all)
   * @returns {string[]} Console log lines
   */
  getConsoleLogs(vm: VMInstance, lines?: number): string[] {
    if (lines && lines > 0) {
      return vm.consoleBuffer.slice(-lines);
    }
    return [...vm.consoleBuffer];
  }

  /**
   * Get all managed VMs
   * @returns {VMInstance[]} Array of VM instances
   */
  getVMs(): VMInstance[] {
    return Array.from(this.vms.values());
  }

  /**
   * Get VM by ID
   * @param {string} vmId - VM identifier
   * @returns {VMInstance | undefined} VM instance or undefined
   */
  getVM(vmId: string): VMInstance | undefined {
    return this.vms.get(vmId);
  }

  /**
   * Setup guest agent socket connection
   * @private
   */
  private async setupGuestAgentSocket(vm: VMInstance): Promise<void> {
    if (!vm.handle) {
      return;
    }

    const port = vm.config.guestAgentPort || 1024;
    const listener = this.binding.createSocketListener(port);

    // Wait for guest agent to connect (with timeout)
    const connectTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < connectTimeout) {
      try {
        const connection = await this.binding.acceptSocketConnection(listener);
        vm.socketConnection = connection;
        
        // Send ping to verify connection
        const pingMessage: GuestAgentMessage = {
          type: 'ping',
          id: generateId(),
          payload: {},
          timestamp: Date.now(),
        };
        
        await this.binding.sendSocketData(
          connection,
          Buffer.from(JSON.stringify(pingMessage))
        );
        
        this.emit('vm:guestAgentConnected', { vmId: vm.config.id, port });
        return;
      } catch {
        // Connection not ready yet, wait and retry
        await delay(500);
      }
    }

    throw new SocketError(
      `Guest agent failed to connect within ${connectTimeout}ms`,
      vm.config.id
    );
  }

  /**
   * Wait for response to a specific message
   * @private
   */
  private async waitForResponse(
    vm: VMInstance,
    messageId: string
  ): Promise<GuestAgentMessage> {
    if (!vm.socketConnection) {
      throw new SocketError('Socket not connected', vm.config.id);
    }

    const maxRetries = 300; // 30 seconds with 100ms delay
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const data = await this.binding.receiveSocketData(vm.socketConnection, 65536);
        const message: GuestAgentMessage = JSON.parse(data.toString('utf8'));
        
        if (message.id === messageId) {
          return message;
        }
        
        // Handle events while waiting
        if (message.type === 'event') {
          this.emit('vm:event', { vmId: vm.config.id, event: message });
        }
      } catch {
        // Ignore parse errors, continue waiting
      }
      
      await delay(100);
    }

    throw new TimeoutError(
      'Response wait timed out',
      'waitForResponse',
      maxRetries * 100
    );
  }

  /**
   * Cleanup all VMs
   * Should be called on process exit
   */
  async cleanup(): Promise<void> {
    const stopPromises: Promise<void>[] = [];
    
    for (const vm of this.vms.values()) {
      if (vm.status === VMStatus.RUNNING || vm.status === VMStatus.PAUSED) {
        stopPromises.push(
          this.stopVM(vm).catch(error => {
            this.emit('error', { vmId: vm.config.id, error });
          })
        );
      }
    }
    
    await Promise.all(stopPromises);
    this.vms.clear();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Apple Virtualization driver
 * @returns {AppleVFDriver} New driver instance
 * @throws {PlatformError} If platform is not supported
 */
export function createAppleVFDriver(): AppleVFDriver {
  return new AppleVFDriver();
}

/**
 * Quick VM creation helper
 * @param {VMConfig} config - VM configuration
 * @returns {Promise<VMInstance>} Created and started VM
 */
export async function quickCreateVM(config: VMConfig): Promise<VMInstance> {
  const driver = createAppleVFDriver();
  const vm = await driver.createVM({ ...config, autoStart: true });
  return vm;
}

// ============================================================================
// Export Default
// ============================================================================

export default AppleVFDriver;
