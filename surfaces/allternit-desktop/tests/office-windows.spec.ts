import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EDITORS = [
  { target: 'sheets', route: '/sheets', selector: '.app-shell' },
  { target: 'slides', route: '/slides', selector: '.app' },
  { target: 'pdf', route: '/pdf', selector: '.app' },
] as const;

/** Launch the desktop app pointed at the platform dev server, with the
 *  onboarding portal pre-dismissed (same seed as the platform's
 *  office-extensions-view.spec). Office opens are delivered to the MAIN
 *  window now — there are no separate office windows. */
async function launchApp(): Promise<ElectronApplication> {
  const app = await electron.launch({
    args: ['.'],
    cwd: packageDir,
    env: {
      ...process.env,
      ALLTERNIT_PLATFORM_URL: 'http://localhost:3013',
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });
  await app.context().addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });
  return app;
}

/** The main window loads the platform SPA root; the splash window does not. */
async function mainWindowPage(app: ElectronApplication): Promise<Page> {
  let page: Page | undefined;
  await expect
    .poll(
      () => {
        page = app.windows().find((w) => w.url().includes('localhost:3013'));
        return Boolean(page);
      },
      { timeout: 60000, intervals: [500, 1000, 2000] },
    )
    .toBe(true);
  if (!page) throw new Error('main platform window not found');
  return page;
}

test('shell:open-office delivers each editor to the main window (no separate office windows)', async () => {
  const app = await launchApp();

  try {
    const mainPage = await mainWindowPage(app);

    for (const editor of EDITORS) {
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
            // In-shell editor view mounts inside the main window; the app must
            // NOT open a separate window on the editor route.
            const editorWindow = app.windows().find((w) => w.url().includes(editor.route));
            return !editorWindow && (await mainPage.locator(editor.selector).first().isVisible());
          },
          { timeout: 60000, intervals: [1000, 2000, 3000] },
        )
        .toBe(true);
    }
  } finally {
    await app.close();
  }
});

test('shell:open-office launcher target opens the Office & Extensions hub in the main window', async () => {
  const app = await launchApp();

  try {
    const mainPage = await mainWindowPage(app);

    await expect
      .poll(
        async () => {
          await app.evaluate(({ ipcMain }) => {
            ipcMain.emit('shell:open-office', {}, 'launcher');
          });
          const launcherWindow = app.windows().find((w) => w.url().includes('/office'));
          return (
            !launcherWindow &&
            (await mainPage.getByTestId('office-suite-block').isVisible())
          );
        },
        { timeout: 60000, intervals: [1000, 2000, 3000] },
      )
      .toBe(true);
  } finally {
    await app.close();
  }
});
