import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildLimitsScript,
  buildMacProfile,
  buildSystemdRunPrefix,
  canonicalSandboxPath,
  macReadGrants,
  DEFAULT_SANDBOX_LIMITS,
} from './mini-app-sandbox.js';

describe('canonicalSandboxPath', () => {
  it('resolves symlinked ancestors even when the leaf does not exist', () => {
    const result = canonicalSandboxPath('/tmp/allternit-definitely-missing-leaf');
    if (process.platform === 'darwin') {
      expect(result).toBe('/private/tmp/allternit-definitely-missing-leaf');
    } else {
      expect(result).toBe('/tmp/allternit-definitely-missing-leaf');
    }
  });

  it('returns real paths for existing directories', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sandbox-canon-'));
    try {
      const result = canonicalSandboxPath(directory);
      expect(fs.existsSync(result)).toBe(true);
      expect(result).toBe(fs.realpathSync(directory));
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('buildLimitsScript', () => {
  it('converts MB to 1024-byte blocks for ulimit -f', () => {
    expect(buildLimitsScript({ maxFileSizeMb: 2 })).toBe('ulimit -f 2048; ');
    expect(buildLimitsScript({ maxFileSizeMb: 1024 })).toBe('ulimit -f 1048576; ');
  });

  it('emits ulimit -t for CPU seconds', () => {
    expect(buildLimitsScript({ maxCpuSeconds: 90 })).toBe('ulimit -t 90; ');
  });

  it('combines limits and never sets memory or process limits via ulimit', () => {
    const script = buildLimitsScript({ maxFileSizeMb: 1, maxCpuSeconds: 5, maxMemoryMb: 512, maxProcesses: 100 });
    expect(script).toBe('ulimit -f 1024; ulimit -t 5; ');
    expect(script).not.toContain('-v');
    expect(script).not.toContain('-u');
  });

  it('returns an empty script when nothing is limited', () => {
    expect(buildLimitsScript({})).toBe('');
  });

  it('default limits cap file size only', () => {
    expect(buildLimitsScript(DEFAULT_SANDBOX_LIMITS)).toBe('ulimit -f 1048576; ');
  });
});

describe('buildSystemdRunPrefix', () => {
  it('builds a user scope with MemoryMax and TasksMax', () => {
    expect(buildSystemdRunPrefix({ maxMemoryMb: 512, maxProcesses: 128 })).toEqual([
      'systemd-run', '--user', '--scope', '--quiet', '--collect',
      '-p', 'MemoryMax=512M', '-p', 'TasksMax=128', '--',
    ]);
  });

  it('returns null when no cgroup-backed limit is requested', () => {
    expect(buildSystemdRunPrefix({ maxFileSizeMb: 100, maxCpuSeconds: 10 })).toBeNull();
    expect(buildSystemdRunPrefix({})).toBeNull();
  });
});

describe('macReadGrants', () => {
  it('enumerates system reads with a root literal and no blanket allow', () => {
    const grants = macReadGrants(process.env.HOME || '/nonexistent');
    expect(grants).toContain('(allow file-read* (literal "/"))');
    expect(grants.some((grant) => grant.includes('(subpath "/usr")'))).toBe(true);
    expect(grants.some((grant) => grant === '(allow file-read*)')).toBe(false);
  });

  it('never grants credential stores', () => {
    const grants = macReadGrants('/Users/test').join('\n');
    for (const sensitive of ['.ssh', '.aws', '.gnupg', 'Keychains', 'Cookies', '.kube', '.docker']) {
      expect(grants).not.toContain(sensitive);
    }
  });
});

describe('buildMacProfile', () => {
  const workdir = canonicalSandboxPath('/tmp/example-workdir');
  const shared = canonicalSandboxPath('/var/data/shared');
  const profile = buildMacProfile('/tmp/example-workdir', { network: ['api.example.com'], filesystem: ['/var/data/shared'] }, 'loopback', '/home/test');

  it('denies by default and grants loopback-only network when hosts are declared', () => {
    expect(profile).toContain('(deny default)');
    expect(profile).toContain('(allow network-outbound (remote ip "localhost:*"))');
    expect(profile).not.toContain('(allow network*)');
  });

  it('grants no network at all without a declared permission', () => {
    const offline = buildMacProfile('/tmp/example-workdir', {}, 'loopback', '/home/test');
    expect(offline).not.toContain('network');
  });

  it('emits full network only in full mode', () => {
    const full = buildMacProfile('/tmp/example-workdir', { network: ['api.example.com'] }, 'full', '/home/test');
    expect(full).toContain('(allow network*)');
  });

  it('makes the workdir and declared paths readable and writable (canonicalized)', () => {
    expect(profile).toContain(`(allow file-write* (subpath "${workdir}"))`);
    expect(profile).toContain(`(allow file-read* (subpath "${workdir}"))`);
    expect(profile).toContain(`(allow file-write* (subpath "${shared}"))`);
  });
});
