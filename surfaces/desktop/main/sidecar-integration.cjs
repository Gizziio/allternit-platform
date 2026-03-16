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

const { spawn } = require('child_process');
const { join } = require('path');
const { app } = require('electron');
const fs = require('fs');
const net = require('net');
const crypto = require('crypto');
const os = require('os');

let apiProcess = null;
let isShuttingDown = false;
let currentPort = null;
let authPassword = null;
let statusCallback = null;

// Configuration
const API_HOST = process.env.A2R_API_HOST || '127.0.0.1';
const MIN_PORT = 3000;
const MAX_PORT = 3100;
const HEALTH_CHECK_INTERVAL = 1000; // ms
const MAX_HEALTH_CHECK_ATTEMPTS = 30;
const SIDECAR_USERNAME = 'a2r';  // Basic auth username (was 'opencode' in agent-shell)

// Store keys for persistence
const STORE_KEYS = {
  API_URL: 'sidecar.apiUrl',
  AUTH_PASSWORD: 'sidecar.authPassword',
  LAST_PORT: 'sidecar.lastPort',
};

/**
 * Generate a secure random password for API authentication
 * Pattern from agent-shell: Generate random password on startup
 */
function generateAuthPassword() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get the authentication password
 * Creates one if it doesn't exist
 */
function getAuthPassword() {
  if (!authPassword) {
    authPassword = generateAuthPassword();
  }
  return authPassword;
}

/**
 * Find an available port in the range
 * Pattern from agent-shell: Dynamic port discovery
 */
async function findAvailablePort() {
  for (let port = MIN_PORT; port <= MAX_PORT; port++) {
    const isAvailable = await new Promise((resolve) => {
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
function getSidecarPath() {
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

function getSidecarDataPaths() {
  const dataDir = join(app.getPath('userData'), 'a2r-data');
  return {
    dataDir,
    dbPath: join(dataDir, 'a2rchitech.db'),
    ledgerPath: join(dataDir, 'a2rchitech.jsonl'),
  };
}

function getPersistedConfigPath() {
  return join(app.getPath('userData'), 'sidecar-config.json');
}

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
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
async function waitForApi(maxAttempts = MAX_HEALTH_CHECK_ATTEMPTS) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  
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
function spawnSidecar(binaryPath, args, env) {
  const platform = os.platform();
  
  const options = {
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
function notifyStatusChange(status) {
  if (statusCallback) {
    statusCallback(status);
  }
}

/**
 * Register a callback for sidecar status changes
 */
function onSidecarStatusChanged(callback) {
  statusCallback = callback;
}

/**
 * Start the Rust API sidecar
 * Enhanced with patterns from agent-shell
 */
async function startSidecar() {
  if (apiProcess) {
    console.log('[Sidecar] API already running');
    return { port: currentPort, password: getAuthPassword() };
  }
  
  notifyStatusChange('starting');
  
  // Find available port
  currentPort = await findAvailablePort();
  console.log('[Sidecar] Using port:', currentPort);
  
  // Generate auth password
  const password = getAuthPassword();
  
  const binaryPath = getSidecarPath();
  const dataPaths = getSidecarDataPaths();

  fs.mkdirSync(dataPaths.dataDir, { recursive: true });
  
  console.log('[Sidecar] Starting API server...');
  console.log('[Sidecar] Binary path:', binaryPath);
  
  // Verify binary exists
  if (!fs.existsSync(binaryPath)) {
    notifyStatusChange('error');
    throw new Error(`API binary not found at: ${binaryPath}. Build with: cargo build --release`);
  }
  
  // Spawn the API process with auth
  const binaryName = binaryPath.split('/').pop();
  const sidecarArgs =
    binaryName === 'a2r' || binaryName === 'a2r.exe'
      ? ['--port', currentPort.toString()]
      : [];

  apiProcess = spawnSidecar(binaryPath, sidecarArgs, {
    RUST_LOG: process.env.RUST_LOG || 'info',
    HOST: API_HOST,
    PORT: currentPort.toString(),
    A2RCHITECH_API_BIND: `${API_HOST}:${currentPort}`,
    A2RCHITECH_DB_PATH: dataPaths.dbPath,
    A2RCHITECH_LEDGER_PATH: dataPaths.ledgerPath,
    A2R_OPERATOR_URL: `http://${API_HOST}:${currentPort}`,
    A2R_OPERATOR_API_KEY: password,
    A2R_DATA_DIR: dataPaths.dataDir,
    A2R_API_PORT: currentPort.toString(),
    A2R_API_HOST: API_HOST,
  });
  
  // Handle stdout
  apiProcess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.log('[API]', line);
    });
  });
  
  // Handle stderr
  apiProcess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      console.error('[API Error]', line);
    });
  });
  
  // Handle process exit
  apiProcess.on('close', (code, signal) => {
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
  
  apiProcess.on('error', (err) => {
    console.error('[Sidecar] Failed to start API:', err);
    notifyStatusChange('error');
    apiProcess = null;
    currentPort = null;
    throw err;
  });
  
  // Wait for API to be ready
  await waitForApi();
  
  // Persist configuration for renderer to discover
  persistConfig();
  
  return { port: currentPort, password };
}

/**
 * Stop the Rust API sidecar
 * Enhanced with platform-specific termination
 */
function stopSidecar() {
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
    spawn('taskkill', ['/pid', pid, '/t', '/f']);
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
        spawn('taskkill', ['/pid', pid, '/t', '/f']);
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
async function restartSidecar() {
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
function getSidecarStatus() {
  if (apiProcess) {
    return 'running';
  }
  return 'stopped';
}

/**
 * Get API URL for making requests
 */
function getApiUrl() {
  if (!currentPort) {
    return undefined;
  }
  return `http://${API_HOST}:${currentPort}`;
}

/**
 * Get Basic Auth credentials for API requests
 * Returns the username:password pair for Basic Auth header
 */
function getBasicAuthCredentials() {
  if (!authPassword) {
    return undefined;
  }
  return {
    username: SIDECAR_USERNAME,
    password: authPassword,
    header: `Basic ${Buffer.from(`${SIDECAR_USERNAME}:${authPassword}`).toString('base64')}`,
  };
}

/**
 * Persist sidecar configuration to electron-store
 */
function persistConfig() {
  try {
    const configPath = getPersistedConfigPath();
    fs.mkdirSync(app.getPath('userData'), { recursive: true });

    if (currentPort && authPassword) {
      fs.writeFileSync(
        configPath,
        JSON.stringify(
          {
            [STORE_KEYS.API_URL]: `http://${API_HOST}:${currentPort}`,
            [STORE_KEYS.AUTH_PASSWORD]: authPassword,
            [STORE_KEYS.LAST_PORT]: currentPort,
          },
          null,
          2,
        ),
        'utf8',
      );
      console.log('[Sidecar] Configuration persisted');
    }
  } catch (e) {
    console.warn('[Sidecar] Failed to persist config:', e.message);
  }
}

/**
 * Load persisted configuration from electron-store
 */
function loadPersistedConfig() {
  try {
    const configPath = getPersistedConfigPath();
    if (!fs.existsSync(configPath)) {
      return null;
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    const apiUrl = parsed[STORE_KEYS.API_URL];
    const password = parsed[STORE_KEYS.AUTH_PASSWORD];
    const port = parsed[STORE_KEYS.LAST_PORT];
    
    if (apiUrl && password && port) {
      console.log('[Sidecar] Loaded persisted config:', { apiUrl, port });
      return { apiUrl, password, port };
    }
  } catch (e) {
    console.warn('[Sidecar] Failed to load persisted config:', e.message);
  }
  return null;
}

/**
 * Clear persisted configuration
 */
function clearPersistedConfig() {
  try {
    const configPath = getPersistedConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    console.log('[Sidecar] Configuration cleared');
  } catch (e) {
    console.warn('[Sidecar] Failed to clear config:', e.message);
  }
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

module.exports = {
  startSidecar,
  stopSidecar,
  restartSidecar,
  getSidecarStatus,
  getSidecarPath,
  getApiUrl,
  getAuthPassword,
  getBasicAuthCredentials,
  onSidecarStatusChanged,
  loadPersistedConfig,
  clearPersistedConfig,
  STORE_KEYS,
  SIDECAR_USERNAME,
};
