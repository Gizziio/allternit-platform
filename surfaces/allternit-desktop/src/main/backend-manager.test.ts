import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackendManager } from './backend-manager.js';

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
