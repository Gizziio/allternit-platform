import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildWindowsSandboxProfile,
  findWindowsHelper,
  validateWindowsHelper,
  windowsHelperCandidates,
  windowsSandboxCommand,
} from './mini-app-sandbox-windows.js';

const HELPER_ENV = 'ALLTERNIT_WINDOWS_SANDBOX_HELPER';
const savedEnv = process.env[HELPER_ENV];

afterEach(() => {
  if (savedEnv === undefined) delete process.env[HELPER_ENV];
  else process.env[HELPER_ENV] = savedEnv;
});

function fakeHelper(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'win-helper-test-'));
  const helper = path.join(directory, 'allternit-sandbox-helper.exe');
  fs.writeFileSync(helper, 'MZ fake');
  return helper;
}

describe('buildWindowsSandboxProfile', () => {
  it('maps loopback network mode with declared hosts', () => {
    const profile = buildWindowsSandboxProfile('node', ['server.js'], '/work', { network: ['api.example.com'] }, 'loopback', {});
    expect(profile.version).toBe(1);
    expect(profile.network).toEqual({ mode: 'loopback', allowedHosts: ['api.example.com'] });
    expect(profile.command).toEqual({ binary: 'node', args: ['server.js'], cwd: path.resolve('/work') });
  });

  it('emits network mode none without declared hosts', () => {
    const profile = buildWindowsSandboxProfile('node', [], '/work', {}, 'loopback', {});
    expect(profile.network).toEqual({ mode: 'none', allowedHosts: [] });
  });

  it('emits full network only in full mode', () => {
    const profile = buildWindowsSandboxProfile('npm', ['ci'], '/work', { network: ['registry.npmjs.org'] }, 'full', {});
    expect(profile.network.mode).toBe('full');
  });

  it('grants read and write only on the workdir and declared paths', () => {
    const profile = buildWindowsSandboxProfile('node', [], '/work', { filesystem: ['C:\\data\\shared'] }, 'loopback', {});
    expect(profile.filesystem.write).toEqual([path.resolve('/work'), path.resolve('C:\\data\\shared')]);
    expect(profile.filesystem.read).toEqual(profile.filesystem.write);
  });

  it('maps resource limits, dropping unset values', () => {
    const profile = buildWindowsSandboxProfile('node', [], '/work', {}, 'loopback', { maxMemoryMb: 512.7, maxProcesses: 64, maxCpuSeconds: 30 });
    expect(profile.limits).toEqual({ maxMemoryMb: 512, maxProcesses: 64, maxCpuSeconds: 30 });
  });
});

describe('helper discovery and validation', () => {
  it('prefers the environment override', () => {
    expect(windowsHelperCandidates({ ...process.env, [HELPER_ENV]: 'X:\\helper.exe' })[0]).toBe('X:\\helper.exe');
  });

  it('finds a helper through the environment override', () => {
    const helper = fakeHelper();
    expect(findWindowsHelper({ ...process.env, [HELPER_ENV]: helper })).toBe(helper);
  });

  it('passes validation on non-Windows platforms (existence only)', () => {
    expect(validateWindowsHelper(fakeHelper())).toBeNull();
  });
});

describe('windowsSandboxCommand', () => {
  it('fails closed when no helper is installed', () => {
    delete process.env[HELPER_ENV];
    const command = windowsSandboxCommand('node', ['server.js'], os.tmpdir(), { network: ['api.example.com'] }, 'loopback', {});
    expect('error' in command && command.error).toContain('sandbox helper');
  });

  it('builds a helper invocation and writes the profile when a helper exists', () => {
    const helper = fakeHelper();
    process.env[HELPER_ENV] = helper;
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'win-profile-test-'));
    const command = windowsSandboxCommand('node', ['server.js'], workdir, { network: ['api.example.com'] }, 'loopback', { maxMemoryMb: 256 });
    if ('error' in command) throw new Error(`unexpected error: ${command.error}`);
    expect(command.binary).toBe(helper);
    expect(command.args).toEqual(['--profile', path.join(workdir, '.allternit-sandbox-win.json')]);
    const profile = JSON.parse(fs.readFileSync(command.args[1], 'utf8'));
    expect(profile.network).toEqual({ mode: 'loopback', allowedHosts: ['api.example.com'] });
    expect(profile.limits).toEqual({ maxMemoryMb: 256 });
    expect((fs.statSync(command.args[1]).mode & 0o777) === 0o600 || process.platform === 'win32').toBe(true);
    fs.rmSync(workdir, { recursive: true, force: true });
  });
});
