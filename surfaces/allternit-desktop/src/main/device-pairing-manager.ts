/**
 * Device pairing approval broker.
 *
 * `gizzi pair` (or another runtime) prints a user code; the desktop app —
 * already paired and holding a runtime device credential in this process —
 * approves or denies it directly against the Allternit Cloud API. Runtime
 * credentials never leave Electron main: the renderer talks to these IPC
 * handlers, never to the cloud API with a token of its own.
 */
import { ipcMain } from 'electron';
import log from 'electron-log';
import { authManager } from './auth-manager.js';
import { URLS } from './config.js';

export interface PairingInfo {
  pairingId: string;
  userCode: string;
  name: string;
  runtimeType: string;
  hostname?: string;
  platform?: string;
  publicKeyFingerprint: string;
  capabilities: string[];
  status: string;
  expiresAt: string;
}

export interface RuntimeDevice {
  id: string;
  name: string;
  runtimeType: string;
  hostname?: string;
  platform?: string;
  version?: string;
  capabilities: string[];
  publicKeyFingerprint: string;
  status: string;
  lastSeenAt?: string;
  createdAt: string;
  credentialExpiresAt: string;
}

export interface PairingApprovalResult {
  status: string;
  pairingId?: string;
  runtimeName?: string;
}

function cloudApiBaseUrl(): string {
  return (process.env.ALLTERNIT_CLOUD_API_URL || URLS.CLOUD_API).replace(/\/$/, '');
}

/** Same normalization as the platform pairing page: XXXX-XXXX, Crockford-safe alphabet. */
function normalizeUserCode(value: string): string {
  const compact = String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8);
  return compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

async function cloudRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = await authManager.getSession();
  if (!session) {
    throw new Error('This desktop is not paired with an Allternit account.');
  }
  const response = await fetch(`${cloudApiBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Allternit Cloud request failed (${response.status})`);
  }
  return payload as T;
}

function requireCode(value: string): string {
  const code = normalizeUserCode(value);
  if (code.length !== 9) {
    throw new Error('Enter the full 8-character pairing code.');
  }
  return code;
}

class DevicePairingManager {
  constructor() {
    ipcMain.handle('device-pairing:lookup', async (_event, code: string) => {
      const normalized = requireCode(code);
      log.info(`[DevicePairing] Looking up pairing ${normalized}`);
      return cloudRequest<PairingInfo>(
        'GET',
        `/api/v1/runtime-pairings/code/${encodeURIComponent(normalized)}`,
      );
    });

    ipcMain.handle('device-pairing:approve', async (_event, code: string) => {
      const normalized = requireCode(code);
      const session = await authManager.getSession();
      log.info(`[DevicePairing] Approving pairing ${normalized}`);
      return cloudRequest<PairingApprovalResult>(
        'POST',
        `/api/v1/runtime-pairings/code/${encodeURIComponent(normalized)}/approve`,
        { email: session?.userEmail },
      );
    });

    ipcMain.handle('device-pairing:deny', async (_event, code: string) => {
      const normalized = requireCode(code);
      log.info(`[DevicePairing] Denying pairing ${normalized}`);
      return cloudRequest<{ status: string }>(
        'POST',
        `/api/v1/runtime-pairings/code/${encodeURIComponent(normalized)}/deny`,
      );
    });

    ipcMain.handle('device-pairing:list', async () => {
      const result = await cloudRequest<{ runtimes?: RuntimeDevice[] }>('GET', '/api/v1/runtime-devices');
      return result.runtimes ?? [];
    });
  }
}

export const devicePairingManager = new DevicePairingManager();
