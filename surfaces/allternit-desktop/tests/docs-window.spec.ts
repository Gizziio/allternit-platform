import { test, expect, _electron as electron } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('desktop opens Allternit Docs (real editor UI) and roundtrips a docx', async () => {
  const app = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      // Open the docs window on startup and point it at the local platform
      // dev server (started by the playwright webServer block on :3013).
      ALLTERNIT_OPEN_DOCS_ON_START: '1',
      ALLTERNIT_PLATFORM_URL: 'http://localhost:3013',
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  try {
    // The app also opens splash/main windows; find the one loading /docs.
    let docsPage: Page | undefined;
    await expect
      .poll(
        () => {
          docsPage = app.windows().find((w) => w.url().includes('/docs'));
          return Boolean(docsPage);
        },
        { timeout: 60000 },
      )
      .toBe(true);

    if (!docsPage) throw new Error('docs window not found');

    docsPage.on('console', (msg) => console.log('[docs window]', msg.type(), msg.text()));
    docsPage.on('pageerror', (err) => console.log('[docs window pageerror]', err.message));

    // The full GenOffice editor: ribbon + paginated document + ProseMirror.
    await expect(docsPage.locator('.ribbon')).toBeVisible({ timeout: 30000 });
    await expect(docsPage.locator('.doc-page').first()).toBeVisible({ timeout: 30000 });

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
    const editor = docsPage.locator('.ProseMirror');
    await editor.click();
    await editor.pressSequentially('Desktop e2e roundtrip');
    await editor.press('Control+s');
    const filename = await downloadPromise;
    expect(filename).toMatch(/\.docx$/);
  } finally {
    await app.close();
  }
});
