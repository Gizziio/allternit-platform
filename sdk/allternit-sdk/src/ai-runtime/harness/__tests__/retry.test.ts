import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { fetchWithRetry } from '../retry';

describe('fetchWithRetry', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns the response immediately on success without retrying', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const response = await fetchWithRetry('https://example.com', {}, { initialDelayMs: 1 });

    expect(response.status).toBe(200);
    expect(calls).toBe(1);
  });

  it('retries once after a network error then succeeds', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) throw new Error('network down');
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      { initialDelayMs: 1, maxDelayMs: 1, jitter: false }
    );

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('retries once after a 429 then succeeds', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      if (calls === 1) return new Response('rate limited', { status: 429 });
      return new Response('ok', { status: 200 });
    }) as typeof fetch;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      { initialDelayMs: 1, maxDelayMs: 1, jitter: false }
    );

    expect(response.status).toBe(200);
    expect(calls).toBe(2);
  });

  it('does not retry non-retryable 4xx responses', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response('bad request', { status: 400 });
    }) as typeof fetch;

    const response = await fetchWithRetry('https://example.com', {}, { initialDelayMs: 1 });

    expect(response.status).toBe(400);
    expect(calls).toBe(1);
  });

  it('gives up after max_retries and throws the last error', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      throw new Error('always down');
    }) as typeof fetch;

    await expect(
      fetchWithRetry('https://example.com', {}, { maxRetries: 2, initialDelayMs: 1, maxDelayMs: 1 })
    ).rejects.toThrow('always down');
    expect(calls).toBe(3); // initial + 2 retries
  });

  it('gives up after max_retries on persistent 500s and returns the response', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response('server error', { status: 500 });
    }) as typeof fetch;

    const response = await fetchWithRetry(
      'https://example.com',
      {},
      { maxRetries: 1, initialDelayMs: 1, maxDelayMs: 1 }
    );

    expect(response.status).toBe(500);
    expect(calls).toBe(2); // initial + 1 retry
  });
});
