/**
 * Server Discovery Module
 * 
 * Automatically discovers the A2R API server using multiple strategies:
 * 1. Check Electron sidecar (if running in desktop app)
 * 2. Check persisted configuration from previous session
 * 3. Check common local ports
 * 4. Fall back to WASM mode
 * 
 * Pattern ported from agent-shell integration guide.
 */

import { healthCheck } from './health';

// Common ports to check for local API server.
// 4096 is the gizzi-code default; others are fallbacks.
const COMMON_PORTS = [4096, 4097, 4098, 3000, 8080, 8081, 3001, 9000];

// Default health check endpoint
const HEALTH_ENDPOINT = '/health';

export interface DiscoveredServer {
  url: string;
  source: 'electron' | 'persisted' | 'port-scan' | 'manual';
  username?: string;
  password?: string;
}

/**
 * Check if running in Electron environment
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && 
    (window.a2rSidecar !== undefined || 
     (window.process?.versions?.electron !== undefined));
}

/**
 * Discover server from Electron sidecar
 */
async function discoverFromElectron(): Promise<DiscoveredServer | null> {
  if (!isElectron() || !window.a2rSidecar) {
    return null;
  }

  try {
    // Check if sidecar is running
    const status = await window.a2rSidecar.getStatus();
    if (status !== 'running') {
      console.log('[Discovery] Electron sidecar not running');
      return null;
    }

    // Get API URL and credentials
    const [apiUrl, basicAuth] = await Promise.all([
      window.a2rSidecar.getApiUrl(),
      window.a2rSidecar.getBasicAuth(),
    ]);

    if (!apiUrl) {
      console.log('[Discovery] Electron sidecar has no API URL');
      return null;
    }

    // Verify health
    const isHealthy = await healthCheck(apiUrl, basicAuth?.header);
    if (!isHealthy) {
      console.log('[Discovery] Electron sidecar unhealthy');
      return null;
    }

    console.log('[Discovery] Found server via Electron sidecar:', apiUrl);
    return {
      url: apiUrl,
      source: 'electron',
      username: basicAuth?.username,
      password: basicAuth?.password,
    };
  } catch (error) {
    console.error('[Discovery] Electron discovery failed:', error);
    return null;
  }
}

/**
 * Discover server from persisted configuration
 */
async function discoverFromPersisted(): Promise<DiscoveredServer | null> {
  if (!isElectron() || !window.a2rSidecar) {
    return null;
  }

  try {
    const config = await window.a2rSidecar.getPersistedConfig();
    if (!config) {
      return null;
    }

    // Verify the persisted server is still running
    const isHealthy = await healthCheck(config.apiUrl);
    if (!isHealthy) {
      console.log('[Discovery] Persisted server no longer available');
      return null;
    }

    console.log('[Discovery] Found server via persisted config:', config.apiUrl);
    return {
      url: config.apiUrl,
      source: 'persisted',
      password: config.password,
    };
  } catch (error) {
    console.error('[Discovery] Persisted config discovery failed:', error);
    return null;
  }
}

/**
 * Discover server by scanning common ports
 */
async function discoverFromPortScan(): Promise<DiscoveredServer | null> {
  for (const port of COMMON_PORTS) {
    const url = `http://127.0.0.1:${port}`;
    
    try {
      const isHealthy = await healthCheck(url, undefined, 500); // Short timeout for scan
      if (isHealthy) {
        console.log('[Discovery] Found server via port scan:', url);
        return {
          url,
          source: 'port-scan',
        };
      }
    } catch {
      // Port not available, continue scanning
    }
  }

  console.log('[Discovery] No server found in port scan');
  return null;
}

/**
 * Discover the API server using multiple strategies
 * 
 * @param options - Discovery options
 * @returns Discovered server or null if none found
 */
export async function discoverServer(
  options: { 
    preferElectron?: boolean;
    allowPortScan?: boolean;
    timeout?: number;
  } = {}
): Promise<DiscoveredServer | null> {
  const { 
    preferElectron = true, 
    allowPortScan = true,
    timeout = 10000 
  } = options;

  console.log('[Discovery] Starting server discovery...');

  // Strategy 1: Electron sidecar (preferred for desktop app)
  if (preferElectron && isElectron()) {
    const electronServer = await discoverFromElectron();
    if (electronServer) {
      return electronServer;
    }
  }

  // Strategy 2: Persisted configuration
  if (isElectron()) {
    const persistedServer = await discoverFromPersisted();
    if (persistedServer) {
      return persistedServer;
    }
  }

  // Strategy 3: Port scan
  if (allowPortScan) {
    const scannedServer = await discoverFromPortScan();
    if (scannedServer) {
      return scannedServer;
    }
  }

  console.log('[Discovery] No server found, will use WASM fallback');
  return null;
}

/**
 * Quick check if a server is available at the given URL
 */
export async function isServerAvailable(
  url: string, 
  authHeader?: string,
  timeout: number = 2000
): Promise<boolean> {
  return healthCheck(url, authHeader, timeout);
}

/**
 * Get the WebSocket URL for a given HTTP URL
 */
export function getWebSocketUrl(httpUrl: string): string {
  const url = new URL(httpUrl);
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${url.host}/ws`;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    a2rSidecar?: {
      getStatus: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
      getApiUrl: () => Promise<string | undefined>;
      getBasicAuth: () => Promise<{ username: string; password: string; header: string } | undefined>;
      getPersistedConfig: () => Promise<{ apiUrl: string; password: string; port: number } | null>;
      clearPersistedConfig: () => Promise<boolean>;
    };
    process?: {
      versions?: {
        electron?: string;
      };
    };
  }
}

export default discoverServer;
