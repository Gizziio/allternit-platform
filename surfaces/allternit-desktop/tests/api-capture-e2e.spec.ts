import { test, expect, _electron as electron } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const API_BASE = 'http://127.0.0.1:8013';
const TEST_URL = 'https://httpbin.org/get?e2e=capture';

test('Electron desktop browser capture derives a Site API contract end-to-end', async () => {
  const app = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      ALLTERNIT_PLATFORM_URL: 'http://localhost:3013',
      ELECTRON_ENABLE_LOGGING: '1',
      NODE_ENV: 'development',
    },
  });

  try {
    // Wait for backend to be reachable (BackendManager starts allternit-api automatically in dev).
    // /health may return 503 while optional deps (e.g. Gizzi) are still starting; /health/live is always 200.
    await expect.poll(
      async () => {
        try {
          const res = await fetch(`${API_BASE}/health/live`);
          return res.status;
        } catch {
          return 0;
        }
      },
      { timeout: 120000 },
    ).toBe(200);

    // Create a hidden BrowserWindow with the Allternit preload script injected
    // so we can drive the real desktop capture API from the renderer.
    const preloadPath = path.join(packageDir, 'dist', 'preload', 'index.js');
    const captureWindowId = await app.evaluate(async ({ BrowserWindow }, { testUrl, preloadPath }) => {
      const win = new BrowserWindow({
        width: 1024,
        height: 768,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          preload: preloadPath,
        },
      });
      await win.loadURL(testUrl);
      return win.id;
    }, { testUrl: TEST_URL, preloadPath });

    // Find the capture window in Playwright and use the exposed preload API.
    const capturePage: Page | undefined = await expect.poll(
      () => app.windows().find((w) => w.url().startsWith('https://httpbin.org/get')),
      { timeout: 10000 },
    ).toBeTruthy().then(() => app.windows().find((w) => w.url().startsWith('https://httpbin.org/get')));

    if (!capturePage) throw new Error('Capture window not found');

    capturePage.on('console', (msg) => console.log('[capture]', msg.type(), msg.text()));
    capturePage.on('pageerror', (err) => console.log('[capture pageerror]', err.message));

    const startResult = await capturePage.evaluate(async () => {
      const api = (window as any).allternit?.browserCapture;
      if (!api) throw new Error('window.allternit.browserCapture is not exposed');
      const available = await api.isAvailable();
      if (!available) throw new Error('Browser capture is not available');
      return api.start({ filterUrls: ['*://httpbin.org/*'] });
    });

    expect(startResult.success).toBe(true);
    expect(startResult.sessionId).toBeTruthy();

    // Generate traffic: reload the test URL twice.
    await capturePage.reload({ waitUntil: 'networkidle' });
    await capturePage.waitForTimeout(1000);
    await capturePage.reload({ waitUntil: 'networkidle' });
    await capturePage.waitForTimeout(1000);

    const har = await capturePage.evaluate(async ({ sessionId }) => {
      const api = (window as any).allternit?.browserCapture;
      const result = await api.stop(sessionId);
      if (!result.success || !result.har) {
        throw new Error(result.error ?? 'Stop capture failed');
      }
      return result.har;
    }, { sessionId: startResult.sessionId });

    expect(har).toBeTruthy();
    expect(JSON.parse(har).log.entries.length).toBeGreaterThan(0);

    // Send the captured HAR to the backend ingest endpoint.
    const ingestRes = await fetch(`${API_BASE}/api/har-derived-api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Dev-mode auth headers used by the platform↔backend bridge.
        'x-allternit-user-id': 'e2e-test-user',
        'x-allternit-user-email': 'e2e@test.allternit',
      },
      body: JSON.stringify({ har }),
    });

    expect(ingestRes.status).toBe(200);
    const ingestBody = await ingestRes.json();

    expect(ingestBody.stats.total_entries).toBeGreaterThan(0);
    expect(ingestBody.stats.api_entries).toBeGreaterThan(0);
    expect(ingestBody.endpoints.length).toBeGreaterThan(0);

    const getEndpoint = ingestBody.endpoints.find(
      (ep: { method: string; path: string }) => ep.method === 'GET' && ep.path === '/get',
    );
    expect(getEndpoint).toBeTruthy();
    expect(getEndpoint.query_params.some((p: { name: string }) => p.name === 'e2e')).toBe(true);

    // Persist the contract through a capture session so the Site APIs panel can show it.
    const sessionRes = await fetch(`${API_BASE}/api/har-derived-api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-allternit-user-id': 'e2e-test-user',
        'x-allternit-user-email': 'e2e@test.allternit',
      },
      body: JSON.stringify({ domain: 'httpbin.org', source: 'aci' }),
    });
    expect(sessionRes.status).toBe(200);
    const { id: sessionId } = await sessionRes.json();

    const stopRes = await fetch(`${API_BASE}/api/har-derived-api/sessions/${sessionId}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-allternit-user-id': 'e2e-test-user',
        'x-allternit-user-email': 'e2e@test.allternit',
      },
      body: JSON.stringify({ har }),
    });
    expect(stopRes.status).toBe(200);
    const stopBody = await stopRes.json();

    expect(stopBody.contract).toBeTruthy();
    expect(stopBody.endpoints.length).toBeGreaterThan(0);

    // Replay the captured GET /get endpoint server-side.
    const endpoint = stopBody.endpoints.find(
      (ep: { method: string; path: string }) => ep.method === 'GET' && ep.path === '/get',
    );
    expect(endpoint).toBeTruthy();

    const replayRes = await fetch(`${API_BASE}/api/har-derived-api/replay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-allternit-user-id': 'e2e-test-user',
        'x-allternit-user-email': 'e2e@test.allternit',
      },
      body: JSON.stringify({
        endpoint_id: endpoint.id,
        query_params: { e2e: 'replay' },
      }),
    });
    expect(replayRes.status).toBe(200);
    const replayBody = await replayRes.json();
    expect(replayBody.status).toBe(200);

    // Generate a Python client from the contract.
    const clientRes = await fetch(`${API_BASE}/api/har-derived-api/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-allternit-user-id': 'e2e-test-user',
        'x-allternit-user-email': 'e2e@test.allternit',
      },
      body: JSON.stringify({
        endpoints: stopBody.endpoints.map((ep: { id: string }) => ep.id),
        language: 'python',
      }),
    });
    expect(clientRes.status).toBe(200);
    const clientBody = await clientRes.json();
    expect(clientBody.code).toContain('httpbin');
    expect(clientBody.code.length).toBeGreaterThan(0);

    console.log('[e2e] Derived contract:', stopBody.contract.id, 'endpoints:', stopBody.endpoints.length);
  } finally {
    await app.close();
  }
});
