/**
 * Test helpers for spawning the gateway subprocess.
 *
 * Tests must use the workspace-local tsx binary; `spawn('tsx', ...)` only works
 * when tsx is globally installed, which is not guaranteed.
 */

import { spawn, ChildProcess, SpawnOptions } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TSX_CLI = join(__dirname, '../node_modules/tsx/dist/cli.mjs');
const GATEWAY_PATH = join(__dirname, '../index.ts');

export function spawnGateway(args: string[], options?: SpawnOptions): ChildProcess {
  return spawn(process.execPath, [TSX_CLI, GATEWAY_PATH, ...args], {
    ...options,
    stdio: options?.stdio ?? ['pipe', 'pipe', 'pipe'],
  });
}

export function waitForGateway(gateway: ChildProcess, timeoutMs = 10000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Gateway startup timeout')), timeoutMs);

    const onData = (data: Buffer) => {
      if (data.toString().includes('Listening')) {
        clearTimeout(timeout);
        gateway.stdout?.off('data', onData);
        gateway.stderr?.off('data', onData);
        resolve();
      }
    };

    gateway.stdout?.on('data', onData);
    gateway.stderr?.on('data', onData);
  });
}
