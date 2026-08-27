import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

vi.mock('electron-log', () => ({
  default: { info: () => {}, warn: () => {}, error: () => {} },
}));

import { OfficeEngineManager, resolveOfficeEngineSpawn } from './office-engine-manager.js';

function devCheckout(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'allternit-office-engine-'));
  const serviceDir = join(repoRoot, 'services', 'office-engine');
  mkdirSync(join(serviceDir, 'src'), { recursive: true });
  mkdirSync(join(serviceDir, 'node_modules', '.bin'), { recursive: true });
  writeFileSync(join(serviceDir, 'src', 'index.ts'), '// entry');
  writeFileSync(join(serviceDir, 'node_modules', '.bin', 'tsx'), '#!/bin/sh\n');
  return repoRoot;
}

function healthyFetch(): typeof fetch {
  return (async () =>
    new Response(JSON.stringify({ status: 'ok', service: 'office-engine' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('resolveOfficeEngineSpawn', () => {
  it('resolves the dev tsx entry when the checkout has the service and tsx bin', () => {
    const spec = resolveOfficeEngineSpawn({ packaged: false, repoRoot: devCheckout(), platform: 'darwin' });
    expect(spec).not.toBeNull();
    expect(spec!.args).toEqual(['src/index.ts']);
    expect(spec!.command).toContain('tsx');
    expect(spec!.cwd).toContain(join('services', 'office-engine'));
  });

  it('returns null in dev when the service checkout is missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'allternit-office-engine-empty-'));
    expect(resolveOfficeEngineSpawn({ packaged: false, repoRoot, platform: 'darwin' })).toBeNull();
  });

  it('re-execs the Electron binary as Node for the packaged bundle', () => {
    const resourcesPath = mkdtempSync(join(tmpdir(), 'allternit-office-engine-res-'));
    mkdirSync(join(resourcesPath, 'office-engine', 'dist'), { recursive: true });
    writeFileSync(join(resourcesPath, 'office-engine', 'dist', 'index.js'), '// bundle');
    const spec = resolveOfficeEngineSpawn({
      packaged: true,
      resourcesPath,
      repoRoot: '/nonexistent',
      execPath: '/Applications/Allternit.app/Contents/MacOS/Allternit',
    });
    expect(spec).not.toBeNull();
    expect(spec!.command).toBe('/Applications/Allternit.app/Contents/MacOS/Allternit');
    expect(spec!.extraEnv).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });

  it('returns null when the packaged bundle was not staged', () => {
    const resourcesPath = mkdtempSync(join(tmpdir(), 'allternit-office-engine-res-empty-'));
    expect(
      resolveOfficeEngineSpawn({ packaged: true, resourcesPath, repoRoot: '/nonexistent' }),
    ).toBeNull();
  });
});

describe('OfficeEngineManager.start', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adopts an already-healthy office-engine without spawning', async () => {
    const manager = new OfficeEngineManager({ port: 18099, fetchImpl: healthyFetch() });
    const url = await manager.start();
    expect(url).toBe('http://127.0.0.1:18099');
    expect(manager.getMode()).toBe('adopted');
    expect((await manager.getStatus()).running).toBe(true);
    manager.stop(); // no-op for adopted instances; must not throw
  });

  it('returns null instead of throwing when no spawn entry exists', async () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), 'allternit-office-engine-none-'));
    const deadFetch = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    const manager = new OfficeEngineManager({
      port: 18098,
      fetchImpl: deadFetch,
      spawnContext: { packaged: false, repoRoot: emptyRoot },
    });
    expect(await manager.start()).toBeNull();
    expect(manager.getMode()).toBeNull();
  });
});
