import { test, expect, _electron as electron } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EDITORS = [
  { target: 'sheets', route: '/sheets', selector: '.app-shell' },
  { target: 'slides', route: '/slides', selector: '.app' },
  { target: 'pdf', route: '/pdf', selector: '.app' },
] as const;

test('desktop opens office program windows for all editors via shell:open-office', async () => {
  const app = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      ALLTERNIT_PLATFORM_URL: 'http://localhost:3013',
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  try {
    for (const editor of EDITORS) {
      let editorPage: Page | undefined;
      // Retry the emit: the IPC handler registers in app.whenReady, which may
      // not have run yet when the test starts.
      await expect
        .poll(
          async () => {
            await app.evaluate(
              ({ ipcMain }, target) => {
                ipcMain.emit('shell:open-office', {}, target);
              },
              editor.target,
            );
            editorPage = app.windows().find((w) => w.url().includes(editor.route));
            return Boolean(editorPage);
          },
          { timeout: 60000, intervals: [1000, 2000, 3000] },
        )
        .toBe(true);
      if (!editorPage) throw new Error(`${editor.target} window not found`);

      await expect(editorPage.locator(editor.selector).first()).toBeVisible({ timeout: 60000 });
    }
  } finally {
    await app.close();
  }
});

test('desktop launcher window loads the office launcher', async () => {
  const app = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      ALLTERNIT_PLATFORM_URL: 'http://localhost:3013',
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  try {
    let launcherPage: Page | undefined;
    await expect
      .poll(
        async () => {
          await app.evaluate(({ ipcMain }) => {
            ipcMain.emit('shell:open-office', {}, 'launcher');
          });
          launcherPage = app.windows().find((w) => w.url().includes('/office'));
          return Boolean(launcherPage);
        },
        { timeout: 60000, intervals: [1000, 2000, 3000] },
      )
      .toBe(true);
    if (!launcherPage) throw new Error('launcher window not found');

    await expect(launcherPage.getByTestId('office-launcher')).toBeVisible({ timeout: 30000 });
    await expect(launcherPage.getByTestId('office-card-docs')).toBeVisible();
  } finally {
    await app.close();
  }
});
