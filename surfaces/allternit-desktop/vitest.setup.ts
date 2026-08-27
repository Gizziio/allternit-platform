/**
 * Vitest setup for desktop main-process unit tests.
 *
 * Several src/main modules were written against the Electron runtime
 * (`app.getPath('userData')`, `safeStorage`, `dialog`) but their tests run
 * in plain Node. This setup provides a minimal fake so those tests exercise
 * real logic (encryption-at-rest invariants, approval fingerprints) without
 * launching Electron.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';

const userDataDir = mkdtempSync(join(tmpdir(), 'allternit-test-userdata-'));

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir,
    isPackaged: false,
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    // Tagged mock cipher: round-trips values it produced, throws on anything
    // else — matching real safeStorage's behaviour on damaged input, which
    // the leak-guard tests rely on.
    encryptString: (value: string) => Buffer.from(`ENC:${value}`, 'utf8'),
    decryptString: (value: Buffer) => {
      const text = value.toString('utf8');
      if (!text.startsWith('ENC:')) throw new Error('decryption failed');
      return text.slice(4);
    },
  },
  dialog: {
    // Auto-approve; fingerprint tests seed the approvals file directly and
    // never reach the dialog.
    showMessageBox: async () => ({ response: 1 }),
  },
  BrowserWindow: class {},
  ipcMain: { handle: () => {}, on: () => {} },
}));

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}));
