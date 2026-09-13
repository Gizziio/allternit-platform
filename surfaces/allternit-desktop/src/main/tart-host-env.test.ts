import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadTartHostEnv } from './backend-manager.js';

function writeEnvFile(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tart-host-env-'));
  const file = path.join(dir, 'tart-host.env');
  fs.writeFileSync(file, contents);
  return file;
}

describe('loadTartHostEnv', () => {
  it('fills TART_HOST_URL and TART_HOST_TOKEN from the file when unset', () => {
    const env: Record<string, string> = {};
    const file = writeEnvFile('TART_HOST_URL=http://100.88.98.69:8020\nTART_HOST_TOKEN="secret-token"\n');
    loadTartHostEnv(env, file);
    expect(env.TART_HOST_URL).toBe('http://100.88.98.69:8020');
    expect(env.TART_HOST_TOKEN).toBe('secret-token');
  });

  it('does not override values already present in the environment', () => {
    const env: Record<string, string> = {
      TART_HOST_URL: 'http://override:9999',
      TART_HOST_TOKEN: 'override-token',
    };
    const file = writeEnvFile('TART_HOST_URL=http://file:8020\nTART_HOST_TOKEN=file-token\n');
    loadTartHostEnv(env, file);
    expect(env.TART_HOST_URL).toBe('http://override:9999');
    expect(env.TART_HOST_TOKEN).toBe('override-token');
  });

  it('tolerates a missing file and leaves the env untouched', () => {
    const env: Record<string, string> = {};
    loadTartHostEnv(env, path.join(os.tmpdir(), 'does-not-exist-tart-host.env'));
    expect(env).toEqual({});
  });

  it('ignores malformed lines and comments', () => {
    const env: Record<string, string> = {};
    const file = writeEnvFile('# comment\nnot a line\nTART_HOST_URL=http://host:8020\n\nexport TART_HOST_TOKEN=exported-token\n');
    loadTartHostEnv(env, file);
    expect(env.TART_HOST_URL).toBe('http://host:8020');
    expect(env.TART_HOST_TOKEN).toBe('exported-token');
  });
});
