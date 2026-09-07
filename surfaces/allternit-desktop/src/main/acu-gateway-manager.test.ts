import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAcuGatewaySpawn, resolveAcuPython } from './acu-gateway-manager.js';

function checkoutWithLaunch(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'allternit-acu-'));
  const core = join(repoRoot, 'domains', 'computer-use', 'core');
  mkdirSync(core, { recursive: true });
  writeFileSync(join(core, 'launch.py'), '# launch');
  return repoRoot;
}

describe('resolveAcuGatewaySpawn', () => {
  it('resolves repo launch.py in development', () => {
    const repoRoot = checkoutWithLaunch();
    const spec = resolveAcuGatewaySpawn({ packaged: false, repoRoot, platform: 'darwin' });
    expect(spec).not.toBeNull();
    expect(spec!.args[0]).toBe(join(repoRoot, 'domains', 'computer-use', 'core', 'launch.py'));
    expect(spec!.cwd).toBe(join(repoRoot, 'domains', 'computer-use', 'core'));
    expect(spec!.extraEnv.ALLTERNIT_ACU_PORT).toBe('8760');
    expect(spec!.extraEnv.ALLTERNIT_VISION_PROVIDER).toBe('allternit');
    expect(spec!.extraEnv.ALLTERNIT_LOCAL_BRAIN_URL).toBe('http://127.0.0.1:4096');
  });

  it('returns null in dev when launch.py is missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'allternit-acu-empty-'));
    expect(resolveAcuGatewaySpawn({ packaged: false, repoRoot, platform: 'darwin' })).toBeNull();
  });

  it('resolves staged launch.py when packaged', () => {
    const resourcesPath = mkdtempSync(join(tmpdir(), 'allternit-acu-res-'));
    const acu = join(resourcesPath, 'computer-use', 'acu');
    mkdirSync(acu, { recursive: true });
    writeFileSync(join(acu, 'launch.py'), '# launch');
    const spec = resolveAcuGatewaySpawn({
      packaged: true,
      resourcesPath,
      repoRoot: '/nonexistent',
      platform: 'darwin',
      pythonPath: '/usr/bin/python3',
    });
    expect(spec).not.toBeNull();
    expect(spec!.command).toBe('/usr/bin/python3');
    expect(spec!.args).toEqual([join(acu, 'launch.py')]);
  });
});

describe('resolveAcuPython', () => {
  it('prefers ALLTERNIT_ACU_PYTHON then an explicit pythonPath', () => {
    expect(
      resolveAcuPython({ packaged: false, repoRoot: '/tmp', pythonPath: '/opt/custom/python' }),
    ).toBe('/opt/custom/python');
  });
});
