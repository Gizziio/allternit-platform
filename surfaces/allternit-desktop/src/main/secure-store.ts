/**
 * Minimal secure store for desktop-main secrets (managed runtime, P1).
 *
 * Single-purpose: holds the fabric-transport worker credential the desktop
 * provisions on first launch. Follows the auth-manager secret pattern:
 * in packaged builds Electron's `safeStorage` is the sole Keychain owner
 * (on macOS safeStorage is Keychain-backed); development builds fall back
 * to an authenticated-local AES-GCM envelope so rebuilding the API or
 * Electron does not cause repeated macOS Keychain prompts. Values are
 * encrypted at rest (mode 0600 inside a 0700 directory); the plaintext
 * never leaves the main process.
 */

import { app, safeStorage } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const SAFE_STORAGE_HEADER = 'allternit-safe-storage-v1\n';
const LOCAL_STORAGE_HEADER = 'allternit-local-secret-v1\n';

function storePath(key: string): string {
  const safe = key.replace(/[^a-z0-9_-]/gi, '_');
  return path.join(app.getPath('userData'), 'secrets', `${safe}.bin`);
}

function localHardwareKey(): Buffer {
  // Same inputs as auth-manager's localHardwareKey (hostname deliberately
  // excluded — it flips between mDNS names on macOS).
  return crypto
    .createHash('sha256')
    .update(`allternit-desktop-local-secret|${app.getPath('userData')}`)
    .digest();
}

function encodeSecret(value: string): Buffer {
  if (app.isPackaged && safeStorage.isEncryptionAvailable()) {
    return Buffer.from(
      `${SAFE_STORAGE_HEADER}${safeStorage.encryptString(value).toString('base64')}`,
      'utf8',
    );
  }
  const key = localHardwareKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.from(
    `${LOCAL_STORAGE_HEADER}${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`,
    'utf8',
  );
}

function decodeSecret(raw: Buffer): string {
  const value = raw.toString('utf8');
  if (value.startsWith(SAFE_STORAGE_HEADER)) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('macOS credential storage is unavailable');
    }
    return safeStorage.decryptString(Buffer.from(value.slice(SAFE_STORAGE_HEADER.length), 'base64'));
  }
  if (value.startsWith(LOCAL_STORAGE_HEADER)) {
    const payload = Buffer.from(value.slice(LOCAL_STORAGE_HEADER.length), 'base64');
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', localHardwareKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
  throw new Error('Unknown secure-store entry format');
}

/** Read a secret. Returns null when the entry does not exist. */
export function readSecret(key: string): string | null {
  const file = storePath(key);
  if (!fs.existsSync(file)) return null;
  try {
    return decodeSecret(fs.readFileSync(file));
  } catch {
    return null;
  }
}

/** Write (or overwrite) a secret, encrypted at rest. */
export function writeSecret(key: string, value: string): void {
  const file = storePath(key);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, encodeSecret(value), { mode: 0o600 });
}

/** Delete a secret if present. */
export function deleteSecret(key: string): void {
  const file = storePath(key);
  if (fs.existsSync(file)) fs.rmSync(file);
}

/** Key for the fabric-transport worker credential in the Keychain store. */
export const FABRIC_WORKER_TOKEN_KEY = 'fabric-worker-token';
