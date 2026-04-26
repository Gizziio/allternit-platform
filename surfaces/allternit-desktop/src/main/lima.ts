import { spawn, execFile } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import log from 'electron-log';

export const VM_NAME = 'allternit';

const isDev = process.env.NODE_ENV === 'development';

export type VMStatus = 'running' | 'stopped' | 'error' | 'not-installed';

/**
 * Returns the path to the limactl binary.
 * In a packaged app, uses the binary bundled in Resources/lima/.
 * In development, falls back to limactl on PATH (brew install lima).
 */
function getLimactlPath(): string {
  if (process.resourcesPath) {
    const bundled = join(process.resourcesPath, 'lima', 'limactl');
    if (existsSync(bundled)) return bundled;
  }
  return 'limactl';
}

/**
 * Returns the path to the Lima VM YAML config.
 * In a packaged app, bundled at Resources/allternit.yaml.
 * In development, uses the source tree path.
 */
function getLimaYamlPath(): string {
  if (!isDev && process.resourcesPath) {
    const bundled = join(process.resourcesPath, 'allternit.yaml');
    if (existsSync(bundled)) return bundled;
  }
  return join(process.cwd(), 'cmd/gizzi-code/src/runtime/vm/allternit.yaml');
}

export async function isLimaInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(getLimactlPath(), ['--version'], { timeout: 3000 }, (err) => resolve(!err));
  });
}

export async function vmExists(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(getLimactlPath(), ['list', VM_NAME, '--format', 'json'], { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) { resolve(false); return; }
      try {
        const rows = JSON.parse(stdout) as Array<{ name: string }>;
        resolve(Array.isArray(rows) && rows.some(v => v.name === VM_NAME));
      } catch { resolve(false); }
    });
  });
}

export async function getVMStatus(): Promise<VMStatus> {
  const limactl = getLimactlPath();
  return new Promise((resolve) => {
    execFile(limactl, ['--version'], { timeout: 3000 }, (err) => {
      if (err) { resolve('not-installed'); return; }
      execFile(limactl, ['list', VM_NAME, '--format', 'json'], { timeout: 5000 }, (listErr, stdout) => {
        if (listErr || !stdout.trim()) { resolve('stopped'); return; }
        try {
          const rows = JSON.parse(stdout) as Array<{ name: string; status: string }>;
          const vm = Array.isArray(rows) ? rows.find(v => v.name === VM_NAME) : null;
          if (!vm) { resolve('stopped'); return; }
          if (vm.status === 'Running') { resolve('running'); return; }
          if (vm.status === 'Stopped') { resolve('stopped'); return; }
          resolve('error');
        } catch { resolve('error'); }
      });
    });
  });
}

export async function startVM(
  onProgress?: (stage: string, message: string, progress: number) => void
): Promise<void> {
  const limactl = getLimactlPath();
  const limaYaml = getLimaYamlPath();

  const exists = await vmExists();
  const args = exists ? ['start', VM_NAME] : ['start', '--name', VM_NAME, limaYaml];

  log.info(`[Lima] Starting VM (${exists ? 'existing' : 'new'}) with binary: ${limactl}`);
  onProgress?.('booting', 'Starting Linux VM...', 30);

  return new Promise((resolve, reject) => {
    const proc = spawn(limactl, args, { stdio: 'pipe' });
    let stderr = '';
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) { onProgress?.('ready', 'VM Ready!', 100); log.info('[Lima] VM started'); resolve(); }
      else reject(new Error(`limactl start failed (exit ${code}): ${stderr.slice(-400)}`));
    });
    proc.on('error', reject);
  });
}

export async function stopVM(): Promise<void> {
  const limactl = getLimactlPath();
  return new Promise((resolve, reject) => {
    execFile(limactl, ['stop', VM_NAME], { timeout: 30_000 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// installLima is no longer needed at runtime — limactl is bundled.
// Kept as a no-op so the IPC handler still compiles without changes.
export async function installLima(): Promise<void> {
  log.info('[Lima] limactl is bundled with the app — no installation needed');
}
