import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('desktop opens Allternit Docs in the main window (real editor UI) and roundtrips a docx', async () => {
  const app: ElectronApplication = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      // Request the docs editor on startup (delivered to the main window via
      // the office:open-target channel once it loads) and point the app at
      // the local platform dev server (started by the playwright webServer
      // block on :3013).
      ALLTERNIT_OPEN_DOCS_ON_START: '1',
      ALLTERNIT_PLATFORM_URL: 'http://localhost:3013',
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });
  await app.context().addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });

  try {
    // The docs editor now opens INSIDE the main platform window (in-shell
    // view) — there is no separate docs window.
    let mainPage: Page | undefined;
    await expect
      .poll(
        () => {
          mainPage = app.windows().find((w) => w.url().includes('localhost:3013'));
          return Boolean(mainPage);
        },
        { timeout: 60000 },
      )
      .toBe(true);

    if (!mainPage) throw new Error('main platform window not found');

    // No separate window should have been opened on the /docs route.
    expect(
      app.windows().filter((w) => w !== mainPage && w.url().includes('/docs')),
    ).toHaveLength(0);

    mainPage.on('console', (msg) => console.log('[main window]', msg.type(), msg.text()));
    mainPage.on('pageerror', (err) => console.log('[main window pageerror]', err.message));

    // The full GenOffice editor: ribbon + paginated document + ProseMirror.
    await expect(mainPage.locator('.ribbon')).toBeVisible({ timeout: 60000 });
    await expect(mainPage.locator('.doc-page').first()).toBeVisible({ timeout: 60000 });

    // Type into the editor and export a .docx via Ctrl+S. Electron surfaces
    // the blob download through session will-download (Playwright's page
    // 'download' event does not fire for it).
    const downloadPromise = app.evaluate(({ session }) =>
      new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 30000);
        session.defaultSession.once('will-download', (_event, item) => {
          clearTimeout(timer);
          resolve(item.getFilename());
        });
      }),
    );
    const editor = mainPage.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('Desktop e2e roundtrip');
    await editor.press('Control+s');
    const filename = await downloadPromise;
    expect(filename).toMatch(/\.docx$/);
  } finally {
    await app.close();
  }
});
