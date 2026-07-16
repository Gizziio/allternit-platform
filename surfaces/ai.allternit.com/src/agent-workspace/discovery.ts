/**
 * Server Discovery Module
 * 
 * Automatically discovers the Allternit API server using multiple strategies:
 * 1. Check Electron sidecar (if running in desktop app)
 * 2. Check persisted configuration from previous session
 * 3. Check common local ports
 * 4. Fall back to WASM mode
 * 
 * Pattern ported from agent-shell integration guide.
 */

import { healthCheck } from './health';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Discovery');

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
    (window.allternitSidecar !== undefined || 
     (window.process?.versions?.electron !== undefined));
}

type SidecarApi = NonNullable<Window['allternitSidecar']>;

function hasSidecarMethods(
  sidecar: Window['allternitSidecar'],
  methods: Array<keyof SidecarApi>,
): sidecar is SidecarApi {
  return Boolean(
    sidecar &&
      methods.every((method) => typeof sidecar[method] === 'function'),
  );
}

/**
 * Discover server from Electron sidecar
 */
async function discoverFromElectron(): Promise<DiscoveredServer | null> {
  if (!isElectron()) {
    return null;
  }

  const sidecar = window.allternitSidecar;
  if (!hasSidecarMethods(sidecar, ['getStatus', 'getApiUrl'])) {
    logger.debug('Electron sidecar API unavailable in this shell');
    return null;
  }

  try {
    // Check if sidecar is running
    const status = await sidecar.getStatus!();
    if (status !== 'running') {
      logger.debug('Electron sidecar not running');
      return null;
    }

    // Electron returns a custom URL whose requests are credential-brokered in
    // the signed main process.
    const apiUrl = await sidecar.getApiUrl!();

    if (!apiUrl) {
      logger.debug('Electron sidecar has no API URL');
      return null;
    }

    // Verify health
    const isHealthy = await healthCheck(apiUrl);
    if (!isHealthy) {
      logger.debug('Electron sidecar unhealthy');
      return null;
    }

    console.debug('[Discovery] Found server via Electron sidecar:', apiUrl);
    return {
      url: apiUrl,
      source: 'electron',
    };
  } catch (error) {
    logger.error({ err: error }, 'Electron discovery failed');
    return null;
  }
}

/**
 * Discover server by scanning common ports in parallel
 */
async function discoverFromPortScan(): Promise<DiscoveredServer | null> {
  try {
    // Check all ports in parallel
    const result = await Promise.any(
      COMMON_PORTS.map(async (port) => {
        const url = `http://127.0.0.1:${port}`;
        const isHealthy = await healthCheck(url, undefined, 500);
        if (isHealthy) {
          console.debug('[Discovery] Found server via port scan:', url);
          return {
            url,
            source: 'port-scan' as const,
          };
        }
        throw new Error('Unhealthy');
      })
    );
    return result;
  } catch {
    logger.debug('No server found in port scan');
    return null;
  }
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

  logger.debug('Starting server discovery...');

  // Strategy 1: Electron sidecar (preferred for desktop app)
  if (preferElectron && isElectron()) {
    const electronServer = await discoverFromElectron();
    if (electronServer) {
      return electronServer;
    }
  }

  // Strategy 2: Port scan (browser development only)
  if (allowPortScan) {
    const scannedServer = await discoverFromPortScan();
    if (scannedServer) {
      return scannedServer;
    }
  }

  logger.debug('No server found, will use WASM fallback');
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

// Extend Window interface for TypeScript
declare global {
  interface Window {
    allternitSidecar?: {
      getStatus?: () => Promise<'stopped' | 'starting' | 'running' | 'error' | 'crashed'>;
      getApiUrl?: () => Promise<string | undefined>;
    };
    process?: {
      versions?: {
        electron?: string;
      };
    };
  }
}

export default discoverServer;
