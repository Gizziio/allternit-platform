import { test, expect, _electron as electron } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const preloadPath = path.join(packageDir, 'dist', 'preload', 'index.js');
const TEST_URL = 'https://httpbin.org/get?desktop_capture=headless';

test('Electron desktop browser capture produces a HAR without UI', async () => {
  const app = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  try {
    // Create a hidden BrowserWindow with the Allternit preload script injected.
    await app.evaluate(async ({ BrowserWindow }, { testUrl, preloadPath }) => {
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
      (global as any).__captureWindowId = win.id;
    }, { testUrl: TEST_URL, preloadPath });

    // Find the capture window in Playwright.
    const capturePage: Page | undefined = await expect.poll(
      () => app.windows().find((w) => w.url().startsWith('https://httpbin.org/get')),
      { timeout: 10000 },
    ).toBeTruthy().then(() => app.windows().find((w) => w.url().startsWith('https://httpbin.org/get')));

    if (!capturePage) throw new Error('Capture window not found');

    capturePage.on('console', (msg) => console.log('[capture]', msg.type(), msg.text()));
    capturePage.on('pageerror', (err) => console.log('[capture pageerror]', err.message));

    // Start capture via the exposed preload API.
    const startResult = await capturePage.evaluate(async () => {
      const api = (window as any).allternit?.browserCapture;
      if (!api) throw new Error('window.allternit.browserCapture is not exposed');
      const available = await api.isAvailable();
      if (!available) throw new Error('Browser capture is not available');
      return api.start({ filterUrls: ['*://httpbin.org/*'] });
    });

    expect(startResult.success).toBe(true);
    expect(startResult.sessionId).toBeTruthy();

    // Generate traffic: reload twice.
    await capturePage.reload({ waitUntil: 'networkidle' });
    await capturePage.waitForTimeout(1000);
    await capturePage.reload({ waitUntil: 'networkidle' });
    await capturePage.waitForTimeout(1000);

    // Stop capture and return the HAR.
    const har = await capturePage.evaluate(async ({ sessionId }) => {
      const api = (window as any).allternit?.browserCapture;
      const result = await api.stop(sessionId);
      if (!result.success || !result.har) {
        throw new Error(result.error ?? 'Stop capture failed');
      }
      return result.har;
    }, { sessionId: startResult.sessionId });

    expect(har).toBeTruthy();
    const harObj = JSON.parse(har);
    expect(harObj.log.entries.length).toBeGreaterThan(0);

    const requests = harObj.log.entries.map((e: any) => ({
      method: e.request.method,
      url: e.request.url,
      queryCount: e.request.queryString?.length ?? 0,
      status: e.response?.status,
    }));
    console.log('[capture-test] Requests:', JSON.stringify(requests, null, 2));

    const hasTarget = harObj.log.entries.some((e: any) =>
      e.request.url.includes('httpbin.org/get?desktop_capture=headless'),
    );
    expect(hasTarget).toBe(true);
  } finally {
    await app.close();
  }
});
