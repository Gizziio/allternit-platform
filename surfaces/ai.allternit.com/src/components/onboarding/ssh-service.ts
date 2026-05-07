/**
 * SSH Connection Service - Frontend
 * 
 * Communicates with backend API for SSH operations and backend installation.
 */

import { sshApi } from '@/api/infrastructure/ssh';
import { runtimeBackendApi } from '@/api/infrastructure/runtime-backend';

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'key';
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface SystemInfo {
  os: string;
  distro: string;
  version: string;
  architecture: string;
  isAllternitInstalled: boolean;
  allternitVersion?: string;
  hasSystemd: boolean;
  glibcVersion?: string;
}

export interface VPSProvider {
  id: string;
  name: string;
  logo: string;
  description: string;
  startingPrice: string;
  url: string;
}

export interface ConnectionStatus {
  connected: boolean;
  status: 'idle' | 'connecting' | 'connected' | 'failed' | 'installing' | 'ready';
  message: string;
  progress?: number;
  error?: string;
}

export type InstallStep = 
  | 'connecting'
  | 'detecting_os'
  | 'preparing'
  | 'downloading'
  | 'configuring'
  | 'starting'
  | 'verifying'
  | 'complete'
  | 'error';

export interface InstallProgress {
  step: InstallStep;
  progress: number;
  message: string;
  log?: string;
}

interface TestSSHConnectionResult {
  success: boolean;
  error?: string;
  systemInfo?: SystemInfo;
  info?: SystemInfo;
}

interface InstallBackendResult {
  success: boolean;
  error?: string;
  apiUrl?: string | null;
  systemInfo?: SystemInfo;
  connectionId?: string;
}

// Step descriptions for UI
export const STEP_DESCRIPTIONS: Record<InstallStep, string> = {
  connecting: 'Connecting to your VPS over SSH...',
  detecting_os: 'Probing the server and confirming compatibility...',
  preparing: 'Saving this VPS as your backend target...',
  downloading: 'Installing or verifying the Allternit backend...',
  configuring: 'Configuring the backend runtime...',
  starting: 'Starting backend services...',
  verifying: 'Activating this VPS as your runtime backend...',
  complete: 'Installation complete!',
  error: 'Installation failed',
};

// Detailed log messages for each step
export const STEP_DETAILS: Record<InstallStep, string[]> = {
  connecting: [
    'Opening SSH session...',
    'Authenticating with credentials...',
    'SSH connection established.',
  ],
  detecting_os: [
    'Reading OS metadata...',
    'Detecting CPU architecture...',
    'Checking backend prerequisites...',
    'Server probe complete.',
  ],
  preparing: [
    'Looking for an existing saved VPS...',
    'Saving or updating the SSH connection...',
    'Binding this host to your account...',
    'Connection record is ready.',
  ],
  downloading: [
    'Checking remote backend state...',
    'Installing the Allternit backend bundle if needed...',
    'Validating the remote binary...',
    'Backend install check complete.',
  ],
  configuring: [
    'Applying backend configuration...',
    'Writing service metadata...',
    'Preparing runtime settings...',
    'Configuration synchronized.',
  ],
  starting: [
    'Starting backend service...',
    'Waiting for the server to boot...',
    'Checking service health...',
    'Runtime is online.',
  ],
  verifying: [
    'Verifying the backend health endpoint...',
    'Selecting this VPS as your active runtime...',
    'Persisting the BYOC preference...',
    'Runtime activation complete.',
  ],
  complete: [
    'Backend is running and ready!',
    'API endpoint is accessible.',
    'Installation successful!',
  ],
  error: [
    'An error occurred during installation.',
    'Check the error message above.',
    'You can retry or contact support.',
  ],
};

// VPS Providers with real logos
export const VPS_PROVIDERS: VPSProvider[] = [
  {
    id: 'hetzner',
    name: 'Hetzner Cloud',
    logo: '/providers/hetzner.ico',
    description: 'High-performance German cloud infrastructure',
    startingPrice: '€3.79/mo',
    url: 'https://www.hetzner.com/cloud/',
  },
  {
    id: 'contabo',
    name: 'Contabo',
    logo: '/providers/contabo.ico',
    description: 'Affordable VPS with generous resources',
    startingPrice: '€3.99/mo',
    url: 'https://contabo.com/en/vps/',
  },
  {
    id: 'racknerd',
    name: 'RackNerd',
    logo: '/providers/racknerd.ico',
    description: 'Budget-friendly VPS hosting',
    startingPrice: '$10/year',
    url: 'https://www.racknerd.com/',
  },
];

/**
 * Get API base URL
 */
function getApiUrl(): string {
  if (typeof window === 'undefined') return '';

  return process.env.NEXT_PUBLIC_ALLTERNIT_API_URL?.replace(/\/$/, '') || window.location.origin;
}

function normalizeSSHConfig(config: SSHConnectionConfig) {
  const host = config.host.includes('@') ? config.host.split('@')[1] : config.host;
  const username = config.host.includes('@') ? config.host.split('@')[0] : config.username;

  return {
    name: host,
    host,
    port: config.port,
    username,
    auth_type: config.authType,
    private_key: config.authType === 'key' ? config.privateKey : undefined,
    password: config.authType === 'password' ? config.password : undefined,
  } as const;
}

function toSystemInfo(details?: {
  os?: string;
  architecture?: string;
  dockerInstalled?: boolean;
  allternitInstalled?: boolean;
}): SystemInfo | undefined {
  if (!details) return undefined;

  return {
    os: details.os || 'Unknown',
    distro: details.os || 'unknown',
    version: 'unknown',
    architecture: details.architecture || 'unknown',
    isAllternitInstalled: Boolean(details.allternitInstalled),
    hasSystemd: true,
    allternitVersion: undefined,
    glibcVersion: undefined,
  };
}

/**
 * Test SSH connection
 */
export async function testSSHConnection(
  config: SSHConnectionConfig
): Promise<TestSSHConnectionResult> {
  const request = normalizeSSHConfig(config);
  const result = await sshApi.testConnection(request);
  const systemInfo = toSystemInfo(result.details);

  return {
    success: result.success,
    error: result.success ? undefined : result.message,
    systemInfo,
    info: systemInfo,
  };
}

/**
 * Save, connect, install, and activate a VPS as the runtime backend.
 */
export function installBackend(
  config: SSHConnectionConfig,
  onProgress: (progress: InstallProgress) => void,
  onComplete: (result: InstallBackendResult) => void
): () => void {
  let aborted = false;
  const messageLog: string[] = [];

  const emit = (step: InstallStep, progress: number, message: string) => {
    if (aborted) return;
    if (!messageLog.includes(message)) {
      messageLog.push(message);
    }
    onProgress({
      step,
      progress,
      message,
      log: messageLog.slice(-5).join('\n'),
    });
  };

  void (async () => {
    let latestSystemInfo: SystemInfo | undefined;

    try {
      const request = normalizeSSHConfig(config);

      emit('preparing', 8, 'Saving this VPS connection...');
      const existingConnections = await sshApi.getConnections();
      if (aborted) return;

      const existing = existingConnections.find((connection) =>
        connection.host === request.host &&
        connection.port === request.port &&
        connection.username === request.username,
      );

      const connection = existing
        ? await sshApi.updateConnection(existing.id, request)
        : await sshApi.createConnection(request);

      if (aborted) return;

      emit('connecting', 22, 'Connecting to the VPS over SSH...');
      const connected = await sshApi.connect(connection.id);
      if (!connected.success) {
        throw new Error(connected.error || 'Failed to connect to the VPS');
      }

      latestSystemInfo = toSystemInfo({
        os: connected.os,
        architecture: connected.architecture,
        dockerInstalled: connected.dockerInstalled,
        allternitInstalled: connected.allternitInstalled,
      });

      emit('detecting_os', 34, `Connected to ${connected.os || 'server'} (${connected.architecture || 'unknown'})`);
      emit('downloading', 54, connected.allternitInstalled ? 'Verifying existing Allternit backend...' : 'Installing the Allternit backend...');

      const installResult = await sshApi.installAgent(connection.id);
      if (!installResult.success) {
        throw new Error(installResult.message || 'Failed to install the Allternit backend');
      }

      emit('configuring', 72, 'Synchronizing backend configuration...');
      emit('starting', 84, 'Starting and checking the remote backend...');

      if (!latestSystemInfo || !latestSystemInfo.isAllternitInstalled) {
        latestSystemInfo = {
          ...(latestSystemInfo ?? {
            os: connected.os || 'Unknown',
            distro: connected.os || 'unknown',
            version: 'unknown',
            architecture: connected.architecture || 'unknown',
            hasSystemd: true,
            glibcVersion: undefined,
          }),
          isAllternitInstalled: true,
          allternitVersion: installResult.version,
        };
      } else {
        latestSystemInfo = {
          ...latestSystemInfo,
          allternitVersion: installResult.version ?? latestSystemInfo.allternitVersion,
        };
      }

      emit('verifying', 94, 'Activating this VPS as your runtime backend...');
      const runtime = await runtimeBackendApi.activateSSHConnection(connection.id);
      if (aborted) return;

      const apiUrl = runtime.gateway_url ?? installResult.api_url ?? null;
      emit('complete', 100, 'Remote backend is ready.');
      onComplete({
        success: true,
        apiUrl,
        systemInfo: latestSystemInfo,
        connectionId: connection.id,
      });
    } catch (error) {
      if (aborted) return;
      const message = error instanceof Error ? error.message : 'Installation failed';
      emit('error', 0, message);
      onComplete({ success: false, error: message });
    }
  })();

  return () => {
    aborted = true;
  };
}

/**
 * Get version manifest
 */
export async function getVersionManifest(): Promise<{
  version: string;
  desktop: { version: string };
  backend: { version: string };
  version_lock: { enabled: boolean; compatible: boolean };
}> {
  const response = await fetch(`${getApiUrl()}/api/v1/version`);
  if (!response.ok) {
    throw new Error('Failed to fetch version');
  }
  return response.json();
}

/**
 * Save VPS provider purchase intent for later connection
 */
export function savePurchaseIntent(providerId: string, purchaseData: { 
  orderId?: string; 
  expectedIp?: string;
  rootPassword?: string;
}): void {
  const intents = JSON.parse(localStorage.getItem('allternit-vps-purchases') || '[]');
  intents.push({
    providerId,
    ...purchaseData,
    createdAt: new Date().toISOString(),
    status: 'pending',
  });
  localStorage.setItem('allternit-vps-purchases', JSON.stringify(intents));
}

/**
 * Get pending VPS purchases
 */
export function getPendingPurchases(): Array<{
  providerId: string;
  orderId?: string;
  expectedIp?: string;
  rootPassword?: string;
  createdAt: string;
  status: string;
}> {
  return JSON.parse(localStorage.getItem('allternit-vps-purchases') || '[]');
}

/**
 * Check for completed purchases and prompt connection
 */
export function checkCompletedPurchases(): Array<{
  providerId: string;
  expectedIp: string;
  rootPassword: string;
}> {
  const purchases = getPendingPurchases();
  const completed: Array<{ providerId: string; expectedIp: string; rootPassword: string }> = [];
  
  // In production, this would poll the VPS provider API or check email
  // For now, we just look for purchases older than 5 minutes
  const now = new Date();
  purchases.forEach(purchase => {
    const created = new Date(purchase.createdAt);
    const age = now.getTime() - created.getTime();
    
    if (age > 5 * 60 * 1000 && purchase.expectedIp && purchase.status === 'pending') {
      completed.push({
        providerId: purchase.providerId,
        expectedIp: purchase.expectedIp,
        rootPassword: purchase.rootPassword || '',
      });
      
      // Update status
      purchase.status = 'notified';
    }
  });
  
  localStorage.setItem('allternit-vps-purchases', JSON.stringify(purchases));
  return completed;
}
