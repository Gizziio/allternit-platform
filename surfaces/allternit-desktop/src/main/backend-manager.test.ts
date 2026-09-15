import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { BackendManager, loadIncusHostEnv } from './backend-manager.js';

function connectionRefused(): Error {
  const err = new Error('fetch failed');
  (err as { cause?: unknown }).cause = { code: 'ECONNREFUSED' };
  return err;
}

function healthResponse(): Response {
  return new Response(JSON.stringify({ live: true }), { status: 200 });
}

function platformResponse(): Response {
  return new Response('<!doctype html><html></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });
}

describe('BackendManager.probeExistingBackend', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns none immediately when the port is closed (ECONNREFUSED)', async () => {
    vi.mocked(fetch).mockRejectedValue(connectionRefused());
    const manager = new BackendManager();

    const startedAt = Date.now();
    const result = await manager.probeExistingBackend();

    expect(result).toBe('none');
    // Regression guard: without the fast path this burns the full 30s
    // HEALTH_TIMEOUT_MS polling a closed port on every cold boot.
    expect(Date.now() - startedAt).toBeLessThan(1_500);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('returns usable when an existing backend serves the platform UI', async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('/health') ? healthResponse() : platformResponse(),
    );
    const manager = new BackendManager();

    expect(await manager.probeExistingBackend()).toBe('usable');
  });

  it('returns misbehaving when /health answers but / is not HTML', async () => {
    vi.mocked(fetch).mockImplementation(
      async (url) =>
        String(url).endsWith('/health')
          ? healthResponse()
          : new Response(JSON.stringify({ error: 'Not Implemented' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
    );
    const manager = new BackendManager();

    expect(await manager.probeExistingBackend()).toBe('misbehaving');
  });

  it('falls back to the patient probe when the first probe fails without ECONNREFUSED', async () => {
    let healthCalls = 0;
    vi.mocked(fetch).mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith('/health')) {
        healthCalls += 1;
        // First health probe dies with an ambiguous error (e.g. a backend
        // mid-start); by the time the patient probe polls, it is up.
        if (healthCalls === 1) throw new Error('socket reset');
        return healthResponse();
      }
      return platformResponse();
    });
    const manager = new BackendManager();

    expect(await manager.probeExistingBackend()).toBe('usable');
    expect(healthCalls).toBeGreaterThan(1);
  });
});

describe('BackendManager waitForUrl fail-fast', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects immediately when the spawned child exits during readiness', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('not up'));
    const { EventEmitter } = await import('node:events');
    const fakeChild = new EventEmitter() as import('node:child_process').ChildProcess;
    const manager = new BackendManager();

    const startedAt = Date.now();
    const promise = (
      manager as unknown as {
        waitForUrl: (url: string, label: string, child: unknown) => Promise<void>;
      }
    ).waitForUrl('http://127.0.0.1:18013/health', 'allternit-api', fakeChild);
    // The sidecar dies right after spawn, the way a missing binary or a bad
    // platform-static export does.
    setTimeout(() => fakeChild.emit('exit', 1), 10);

    await expect(promise).rejects.toThrow('allternit-api exited during startup (code 1)');
    // Regression guard: without the exit race this burns the full 90s
    // HEALTH_TIMEOUT_MS before the backoff retry ladder even starts.
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  });

  it('removes the exit listener as soon as health answers OK', async () => {
    vi.mocked(fetch).mockResolvedValue(healthResponse());
    const { EventEmitter } = await import('node:events');
    const fakeChild = new EventEmitter() as import('node:child_process').ChildProcess;
    const manager = new BackendManager();

    await (
      manager as unknown as {
        waitForUrl: (url: string, label: string, child: unknown) => Promise<void>;
      }
    ).waitForUrl('http://127.0.0.1:18013/health', 'allternit-api', fakeChild);

    expect(fakeChild.listenerCount('exit')).toBe(0);
  });
});

describe('loadIncusHostEnv', () => {
  it('injects Incus substrate keys from the operator file when absent from env', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incus-env-'));
    const file = path.join(dir, 'incus-host.env');
    fs.writeFileSync(
      file,
      [
        'INCUS_URL=https://incus.example.com:8443',
        'INCUS_CLIENT_CERT=/home/op/.allternit/incus-client/cert.pem',
        'INCUS_CLIENT_KEY=/home/op/.allternit/incus-client/key.pem',
        'INCUS_VNC_HOST=incus.example.com',
        '# comment line',
        '',
      ].join('\n'),
    );
    const env: Record<string, string> = {};

    loadIncusHostEnv(env, file);

    expect(env.INCUS_URL).toBe('https://incus.example.com:8443');
    expect(env.INCUS_CLIENT_CERT).toContain('cert.pem');
    expect(env.INCUS_VNC_HOST).toBe('incus.example.com');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('does not override keys already present in the environment', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'incus-env-'));
    const file = path.join(dir, 'incus-host.env');
    fs.writeFileSync(file, 'INCUS_URL=https://file.example.com:8443\n');
    const env: Record<string, string> = { INCUS_URL: 'https://env.example.com:8443' };

    loadIncusHostEnv(env, file);

    expect(env.INCUS_URL).toBe('https://env.example.com:8443');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('tolerates a missing operator file', () => {
    const env: Record<string, string> = {};

    loadIncusHostEnv(env, path.join(os.tmpdir(), 'does-not-exist-incus-host.env'));

    expect(env).toEqual({});
  });
});
