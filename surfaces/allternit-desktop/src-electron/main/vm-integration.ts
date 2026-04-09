/**
 * VM Integration Module
 * 
 * Manages the lifecycle of Allternit VMs using Apple Virtualization.framework (macOS)
 * or KVM/QEMU (Linux). Provides IPC handlers for the renderer process.
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// VM Status types
export type VMStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface VMInfo {
  status: VMStatus;
  version?: string;
  pid?: number;
  socketPath?: string;
  error?: string;
}

export interface VMSetupOptions {
  force?: boolean;
  version?: string;
}

export interface VMExecuteOptions {
  command: string;
  args?: string[];
  workingDir?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface VMExecuteResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
}

// Singleton state
let vmProcess: ChildProcess | null = null;
let vmStatus: VMStatus = 'stopped';
let vmSocketPath: string = '';
let statusCallbacks: Array<(status: VMStatus) => void> = [];

const DEFAULT_IMAGE_VERSION = '1.1.0';
const VM_IMAGES_DIR = path.join(os.homedir(), '.allternit/vm-images');

/**
 * Get current VM status
 */
export function getVMStatus(): VMInfo {
  return {
    status: vmStatus,
    pid: vmProcess?.pid,
    socketPath: vmSocketPath || undefined,
  };
}

/**
 * Check if VM images exist locally
 */
export async function checkVMImages(): Promise<boolean> {
  const requiredFiles = [
    'vmlinux-6.5.0-allternit',
    'initrd.img-6.5.0-allternit',
    'ubuntu-22.04-allternit-v1.1.0.ext4',
    'version.json',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(VM_IMAGES_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.log(`[VM] Missing required file: ${file}`);
      return false;
    }
  }

  return true;
}

/**
 * Download VM images using allternit-vm-image-builder
 */
export async function downloadVMImages(options: VMSetupOptions = {}): Promise<boolean> {
  const version = options.version || DEFAULT_IMAGE_VERSION;
  const forceFlag = options.force ? '--force' : '';

  return new Promise((resolve, reject) => {
    console.log(`[VM] Downloading images version ${version}...`);

    // Find allternit-vm-image-builder
    const possiblePaths = [
      path.join(process.resourcesPath || '', 'bin/allternit-vm-image-builder'),
      path.join(os.homedir(), '.cargo/bin/allternit-vm-image-builder'),
      'allternit-vm-image-builder',
    ];

    let builderPath = possiblePaths.find(p => {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return true;
      } catch {
        return false;
      }
    });

    if (!builderPath) {
      // Try to use cargo run
      builderPath = 'cargo';
    }

    const args = builderPath === 'cargo'
      ? ['run', '-p', 'allternit-vm-image-builder', '--', 'download', '--version', version]
      : ['download', '--version', version];

    if (forceFlag) {
      args.push(forceFlag);
    }

    const process_ = spawn(builderPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: builderPath === 'cargo' ? path.join(__dirname, '../../../..') : undefined,
    });

    let stdout = '';
    let stderr = '';

    process_.stdout?.on('data', (data) => {
      stdout += data.toString();
      console.log(`[VM Builder] ${data.toString().trim()}`);
    });

    process_.stderr?.on('data', (data) => {
      stderr += data.toString();
      console.error(`[VM Builder] ${data.toString().trim()}`);
    });

    process_.on('close', (code) => {
      if (code === 0) {
        console.log('[VM] Images downloaded successfully');
        resolve(true);
      } else {
        reject(new Error(`Image download failed with code ${code}: ${stderr}`));
      }
    });

    process_.on('error', (err) => {
      reject(new Error(`Failed to start image builder: ${err.message}`));
    });
  });
}

/**
 * Setup VM (download images if needed)
 */
export async function setupVM(options: VMSetupOptions = {}): Promise<boolean> {
  const imagesExist = await checkVMImages();

  if (imagesExist && !options.force) {
    console.log('[VM] Images already exist, skipping download');
    return true;
  }

  return downloadVMImages(options);
}

/**
 * Start the VM
 * On macOS, this uses Apple Virtualization.framework via a helper binary
 */
export async function startVM(): Promise<boolean> {
  if (vmStatus === 'running' || vmStatus === 'starting') {
    console.log('[VM] VM is already running or starting');
    return true;
  }

  // Check if images exist
  const imagesExist = await checkVMImages();
  if (!imagesExist) {
    throw new Error('VM images not found. Run setup first.');
  }

  setVMStatus('starting');

  try {
    // For macOS, we need to use Virtualization.framework
    // This would typically be done via a native addon or swift binary
    // For now, we'll create a placeholder that will be implemented

    if (process.platform === 'darwin') {
      await startMacOSVM();
    } else if (process.platform === 'linux') {
      await startLinuxVM();
    } else {
      throw new Error(`Platform ${process.platform} not supported`);
    }

    setVMStatus('running');
    return true;
  } catch (error) {
    setVMStatus('error');
    console.error('[VM] Failed to start VM:', error);
    throw error;
  }
}

/**
 * Start VM on macOS using Virtualization.framework
 * This is a placeholder - actual implementation would use a native addon
 */
async function startMacOSVM(): Promise<void> {
  // In a real implementation, this would:
  // 1. Load a native addon that uses Virtualization.framework
  // 2. Configure the VM with kernel, initrd, and rootfs
  // 3. Start the VM
  // 4. Set up VSOCK for communication

  console.log('[VM] Starting macOS VM...');
  
  // For now, we'll simulate the VM running
  // TODO: Implement actual VM start using Virtualization.framework
  
  // Create a mock socket path
  vmSocketPath = path.join(os.tmpdir(), `allternit-vm-${Date.now()}.sock`);
  
  // This would be replaced with actual VM process management
  console.log('[VM] VM started (mock)');
  console.log('[VM] Note: Actual VM implementation requires native Virtualization.framework integration');
}

/**
 * Start VM on Linux using KVM/QEMU or Firecracker
 */
async function startLinuxVM(): Promise<void> {
  console.log('[VM] Starting Linux VM...');
  
  // This would use firecracker or qemu
  // For now, placeholder implementation
  
  vmSocketPath = path.join(os.tmpdir(), `allternit-vm-${Date.now()}.sock`);
  console.log('[VM] VM started (mock)');
}

/**
 * Stop the VM
 */
export async function stopVM(): Promise<boolean> {
  if (vmStatus === 'stopped' || vmStatus === 'stopping') {
    return true;
  }

  setVMStatus('stopping');

  try {
    if (vmProcess) {
      vmProcess.kill('SIGTERM');
      
      // Wait for process to exit
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          vmProcess?.kill('SIGKILL');
          resolve();
        }, 5000);

        vmProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      vmProcess = null;
    }

    // Clean up socket
    if (vmSocketPath && fs.existsSync(vmSocketPath)) {
      fs.unlinkSync(vmSocketPath);
    }

    setVMStatus('stopped');
    return true;
  } catch (error) {
    console.error('[VM] Error stopping VM:', error);
    setVMStatus('error');
    return false;
  }
}

/**
 * Restart the VM
 */
export async function restartVM(): Promise<boolean> {
  await stopVM();
  return startVM();
}

/**
 * Execute a command in the VM
 */
export async function executeInVM(options: VMExecuteOptions): Promise<VMExecuteResult> {
  if (vmStatus !== 'running') {
    throw new Error('VM is not running');
  }

  // This would communicate with the VM via VSOCK or socket
  // For now, return a mock response
  
  console.log(`[VM] Executing: ${options.command} ${options.args?.join(' ') || ''}`);

  // TODO: Implement actual command execution via VSOCK
  // This requires:
  // 1. Native addon to communicate with VM
  // 2. Protocol for sending commands and receiving output
  
  return {
    success: true,
    stdout: 'Command execution not yet fully implemented',
    stderr: '',
    exitCode: 0,
    executionTimeMs: 0,
  };
}

/**
 * Set VM status and notify callbacks
 */
function setVMStatus(status: VMStatus): void {
  vmStatus = status;
  statusCallbacks.forEach(cb => cb(status));
}

/**
 * Register a callback for status changes
 */
export function onVMStatusChanged(callback: (status: VMStatus) => void): void {
  statusCallbacks.push(callback);
}

/**
 * Unregister a status callback
 */
export function offVMStatusChanged(callback: (status: VMStatus) => void): void {
  statusCallbacks = statusCallbacks.filter(cb => cb !== callback);
}

/**
 * Clean up VM resources on app quit
 */
export function cleanupVM(): void {
  if (vmProcess) {
    vmProcess.kill('SIGTERM');
  }
  
  if (vmSocketPath && fs.existsSync(vmSocketPath)) {
    try {
      fs.unlinkSync(vmSocketPath);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
