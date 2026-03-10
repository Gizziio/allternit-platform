/**
 * Sidecar Integration Module
 * 
 * Manages the Rust API server as a sidecar process in Electron.
 * Handles spawning, health checks, graceful shutdown, and secure authentication.
 * 
 * Ported patterns from agent-shell (Tauri) to Electron:
 * - Dynamic port discovery
 * - Secure password generation
 * - Platform-specific process management
 * - Health check polling
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { app } from 'electron';
import * as fs from 'fs';
import * as net from 'net';
import * as crypto from 'crypto';
import * as os from 'os';
import type { SidecarStatus } from '../shared/types';

let apiProcess: ChildProcess | null = null;
let isShuttingDown = false;
let currentPort: number | null = null;
let authPassword: string | null = null;
let statusCallback: ((status: SidecarStatus) => void) | null = null;

// Configuration
const API_HOST = process.env.A2R_API_HOST || '127.0.0.1';
const MIN_PORT = 3000;
const MAX_PORT = 3100;
const HEALTH_CHECK_INTERVAL = 1000; // ms
const MAX_HEALTH_CHECK_ATTEMPTS = 30;

/**
 * Generate a secure random password for API authentication
 * Pattern from agent-shell: Generate random password on startup
 */
function generateAuthPassword(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the authentication password
 * Creates one if it doesn't exist
 */
export function getAuthPassword(): string {
  if (!authPassword) {
    authPassword = generateAuthPassword();
  }
  return authPassword;
}

/**
 * Find an available port in the range
 * Pattern from agent-shell: Dynamic port discovery
 */
async function findAvailablePort(): Promise<number> {
  for (let port = MIN_PORT; port <= MAX_PORT; port++) {
    const isAvailable = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, API_HOST);
    });
    
    if (isAvailable) {
      return port;
    }
  }
  throw new Error(`No available ports in range ${MIN_PORT}-${MAX_PORT}`);
}

/**
 * Get the path to the sidecar binary
 * Handles both development and production environments
 */
function getSidecarPath(): string {
  const isDev = process.env.NODE_ENV === 'development' ||
                process.env.VITE_DEV_SERVER_URL ||
                !app.isPackaged;

  if (isDev) {
    // In development, use cargo-built binary (try debug first, then release)
    // Check for a2rchitech-api first (the API server), then a2r (CLI)
    const debugPaths = [
      join(__dirname, '../../../../target/debug/a2rchitech-api'),
      join(__dirname, '../../../../target/debug/a2r'),
    ];
    const releasePaths = [
      join(__dirname, '../../../../target/release/a2rchitech-api'),
      join(__dirname, '../../../../target/release/a2r'),
    ];
    
    // Try debug first (faster to build)
    for (const path of debugPaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
    
    // Try release
    for (const path of releasePaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
    
    // Fall back to first debug path (will show error if not found)
    return debugPaths[0];
  }

  // In production, binary is in app resources
  const platform = process.platform;
  const binaryNames = [
    platform === 'win32' ? 'a2rchitech-api.exe' : 'a2rchitech-api',
    platform === 'win32' ? 'a2r.exe' : 'a2r',
  ];
  
  for (const binaryName of binaryNames) {
    const path = join(process.resourcesPath, 'bin', binaryName);
    if (fs.existsSync(path)) {
      return path;
    }
  }
  
  return join(process.resourcesPath, 'bin', binaryNames[0]);
}

/**
 * Check if a port is available
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, API_HOST);
  });
}

/**
 * Wait for the API to become healthy
 * Pattern from agent-shell: Polling health endpoint
 */
async function waitForApi(maxAttempts = MAX_HEALTH_CHECK_ATTEMPTS): Promise<boolean> {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  console.log('[Sidecar] Waiting for API to be ready on port', currentPort);
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      
      const response = await fetch(`http://${API_HOST}:${currentPort}/health`, {
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        console.log('[Sidecar] API is ready');
        notifyStatusChange('running');
        return true;
      }
    } catch (e) {
      // API not ready yet
    }
    
    process.stdout.write('.');
    await delay(HEALTH_CHECK_INTERVAL);
  }
  
  console.log('');
  throw new Error(`API failed to start within ${maxAttempts} seconds`);
}

/**
 * Spawn sidecar with platform-specific options
 * Pattern from agent-shell: Platform-specific process management
 */
function spawnSidecar(binaryPath: string, args: string[], env: Record<string, string>): ChildProcess {
  const platform = os.platform();
  
  const options: { env: Record<string, string>; stdio: ('ignore' | 'pipe')[]; windowsHide?: boolean; detached?: boolean } = {
    env: {
      ...process.env,
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  };
  
  if (platform === 'win32') {
    // Windows: Use shell to get proper process tree, hide console
    options.windowsHide = true;
    options.detached = false;
    
    // For Windows, wrap in cmd to ensure proper process group
    return spawn('cmd', ['/c', binaryPath, ...args], options);
  }
  
  // Unix (macOS/Linux): Use process groups for clean termination
  options.detached = false;
  
  // Check if binary is a2r CLI (needs 'serve' command) or a2rchitech-api (no args)
  const binaryName = binaryPath.split('/').pop();
  if (binaryName === 'a2r' || binaryName === 'a2r.exe') {
    return spawn(binaryPath, ['serve', ...args], options);
  }
  
  return spawn(binaryPath, args, options);
}

/**
 * Notify status change listeners
 */
function notifyStatusChange(status: SidecarStatus): void {
  if (statusCallback) {
    statusCallback(status);
  }
}

/**
 * Register a callback for sidecar status changes
 */
export function onSidecarStatusChanged(callback: (status: SidecarStatus) => void): void {
  statusCallback = callback;
}

/**
 * Start the Rust API sidecar
 * Enhanced with patterns from agent-shell
 */
export async function startSidecar(): Promise<{ port: number; password: string }> {
  if (apiProcess) {
    console.log('[Sidecar] API already running');
    return { port: currentPort!, password: getAuthPassword() };
  }
  
  notifyStatusChange('starting');
  
  // Find available port
  currentPort = await findAvailablePort();
  console.log('[Sidecar] Using port:', currentPort);
  
  // Generate auth password
  const password = getAuthPassword();
  
  const binaryPath = getSidecarPath();
  
  console.log('[Sidecar] Starting API server...');
  console.log('[Sidecar] Binary path:', binaryPath);
  
  // Verify binary exists
  if (!fs.existsSync(binaryPath)) {
    notifyStatusChange('error');
    throw new Error(`API binary not found at: ${binaryPath}. Build with: cargo build --release`);
  }
  
  // Spawn the API process with auth
  apiProcess = spawnSidecar(binaryPath, [`--port`, currentPort.toString()], {
    RUST_LOG: process.env.RUST_LOG || 'info',
    A2R_OPERATOR_URL: `http://${API_HOST}:${currentPort}`,
    A2R_OPERATOR_API_KEY: password,
    A2R_DATA_DIR: join(app.getPath('userData'), 'a2r-data'),
    A2R_API_PORT: currentPort.toString(),
    A2R_API_HOST: API_HOST,
  });
  
  // Handle stdout
  apiProcess.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.log('[API]', line);
    });
  });
  
  // Handle stderr
  apiProcess.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.error('[API Error]', line);
    });
  });
  
  // Handle process exit
  apiProcess.on('close', (code: number | null, signal: string | null) => {
    if (isShuttingDown) {
      console.log(`[Sidecar] API process exited cleanly (code: ${code})`);
      notifyStatusChange('stopped');
    } else {
      console.error(`[Sidecar] API process exited unexpectedly (code: ${code}, signal: ${signal})`);
      notifyStatusChange(code === 0 ? 'stopped' : 'crashed');
      // Could trigger restart here
    }
    apiProcess = null;
    currentPort = null;
  });
  
  apiProcess.on('error', (err: Error) => {
    console.error('[Sidecar] Failed to start API:', err);
    notifyStatusChange('error');
    apiProcess = null;
    currentPort = null;
    throw err;
  });
  
  // Wait for API to be ready
  await waitForApi();
  
  return { port: currentPort, password };
}

/**
 * Stop the Rust API sidecar
 * Enhanced with platform-specific termination
 */
export function stopSidecar(): void {
  if (!apiProcess) {
    return;
  }
  
  isShuttingDown = true;
  console.log('[Sidecar] Stopping API server...');
  notifyStatusChange('stopped');
  
  const pid = apiProcess.pid;
  
  if (!pid) {
    apiProcess = null;
    return;
  }
  
  // Try graceful shutdown first
  if (os.platform() === 'win32') {
    // Windows: Use taskkill for process tree
    spawn('taskkill', ['/pid', pid.toString(), '/t', '/f']);
  } else {
    // Unix: SIGTERM
    apiProcess.kill('SIGTERM');
    
    // Also try process group kill
    try {
      process.kill(-pid, 'SIGTERM');
    } catch (e) {
      // Process group may not exist
    }
  }
  
  // Force kill after timeout
  setTimeout(() => {
    if (apiProcess) {
      console.log('[Sidecar] Force killing API process...');
      
      if (os.platform() === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/t', '/f']);
      } else {
        apiProcess.kill('SIGKILL');
        try {
          process.kill(-pid, 'SIGKILL');
        } catch (e) {}
      }
    }
  }, 5000);
}

/**
 * Restart the sidecar
 */
export async function restartSidecar(): Promise<{ port: number; password: string }> {
  stopSidecar();
  
  // Wait for process to fully exit
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Reset password on restart
  authPassword = null;
  
  return await startSidecar();
}

/**
 * Get API status
 */
export function getSidecarStatus(): SidecarStatus {
  if (apiProcess) {
    return 'running';
  }
  return 'stopped';
}

/**
 * Get API URL for making requests
 */
export function getApiUrl(): string | undefined {
  if (!currentPort) {
    return undefined;
  }
  return `http://${API_HOST}:${currentPort}`;
}

// Register cleanup handlers
app.on('before-quit', () => {
  isShuttingDown = true;
  stopSidecar();
});

app.on('will-quit', (event) => {
  if (apiProcess) {
    event.preventDefault();
    stopSidecar();
    
    // Give it time to shut down
    setTimeout(() => {
      app.exit(0);
    }, 2000);
  }
});

// Handle window-all-closed properly for macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopSidecar();
    app.quit();
  }
});
