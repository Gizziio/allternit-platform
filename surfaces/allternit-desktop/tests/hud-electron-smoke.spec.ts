import { test, expect, _electron as electron } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userDataDir = path.join(packageDir, 'test-results', 'hud-smoke-user-data-dev');
const PLATFORM_URL = process.env.ALLTERNIT_PLATFORM_URL || 'http://localhost:3017';

test('Electron desktop opens HUD window and renders floating chat', async () => {
  fs.rmSync(userDataDir, { recursive: true, force: true });

  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: packageDir,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      ALLTERNIT_PLATFORM_URL: PLATFORM_URL,
      ALLTERNIT_SKIP_PAIRING: '1',
      ALLTERNIT_FORCE_DEV_MODE: '1',
    },
  });

  try {
    // Locate the main platform window once it loads.
    await expect.poll(
      () => app.windows().some((w) => w.url().includes(PLATFORM_URL) || w.url().includes('localhost:3017')),
      { timeout: 60000 },
    ).toBe(true);

    const mainWindow = app.windows().find((w) => w.url().includes(PLATFORM_URL) || w.url().includes('localhost:3017'));
    if (!mainWindow) throw new Error('Main platform window not found');

    // Give the SPA a moment to bootstrap instead of relying on domcontentloaded,
    // which can be unreliable when Vite is still resolving dynamic imports.
    await mainWindow.waitForTimeout(5000);

    // Open HUD via the exposed preload API (same path as the global hotkey/tray).
    await mainWindow.evaluate(async () => {
      await (window as any).allternit.shell.hud.open();
    });

    // The HUD is a panel window; it only appears in Playwright's window list
    // once it is shown. Poll until the /hud URL is present.
    await expect.poll(
      () => app.windows().some((w) => w.url().includes('/hud')),
      { timeout: 30000, intervals: [500] },
    ).toBe(true);

    const hudPage = app.windows().find((w) => w.url().includes('/hud'));
    if (!hudPage) throw new Error('Could not attach Playwright Page to HUD window');

    hudPage.on('console', (msg) => console.log('[hud]', msg.type(), msg.text()));
    hudPage.on('pageerror', (err) => console.log('[hud pageerror]', err.message));

    await hudPage.waitForSelector('[data-hud-shell]', { timeout: 60000 });

    const results = await hudPage.evaluate(() => ({
      hudShell: !!document.querySelector('[data-hud-shell]'),
      composerBounds: !!document.querySelector('[data-hud-composer-bounds]'),
      dragStrip: !!document.querySelector('[data-hud-drag-strip]'),
      closeButton: !!document.querySelector('button[aria-label="Close HUD"]'),
      resizeHandles: document.querySelectorAll('[data-hud-resize]').length,
      hudApiAvailable: !!(window as any).allternit?.shell?.hud,
    }));

    console.log('[hud-smoke] results:', JSON.stringify(results, null, 2));

    expect(results.hudShell).toBe(true);
    expect(results.composerBounds).toBe(true);
    expect(results.dragStrip).toBe(true);
    expect(results.closeButton).toBe(true);
    expect(results.resizeHandles).toBeGreaterThan(0);
    expect(results.hudApiAvailable).toBe(true);

    await hudPage.screenshot({ path: path.join(packageDir, 'test-results', 'hud-smoke.png') });
  } finally {
    await app.close();
  }
});
