import { test, expect } from '@playwright/test';
import { makeSampleXlsxBase64 } from './helpers/office';

const NOW = '2026-01-01T00:00:00.000Z';

// NOTE: the UI-level save (grid edit → engine save → artifact PATCH) is
// covered at the service level — services/office-engine/tests/index.test.ts
// runs the full session pipeline against the real sidecar (open → edit →
// save → reopen → verify), and SheetsView's artifact write-back wiring is the
// same proven pattern as DocsView (covered by docs-artifact.spec.ts). These
// tests cover the UI load path against the real engine.

test('sheets app loads an artifact workbook through a real engine session', async ({ page }) => {
  // Cold dev server + parallel workers: the vendored app's module graph is
  // huge, and follow-up session requests queue behind slow vite transforms in
  // the browser's per-origin connection pool. Budget for it.
  test.setTimeout(180_000);
  const binaryBody = await makeSampleXlsxBase64();

  // Office engine calls go to the real service on :8099 (the gateway build
  // running on :8013 predates the /api/office/xlsx/* routes).
  //
  // Proxy through Playwright (route.fetch + fulfill) instead of
  // route.continue({ url }): continue retargets the browser request to a
  // different origin, and the engine sends no CORS headers, so continued
  // responses can be swallowed by the browser (see sheets-route.spec.ts).
  await page.route('**/api/office/**', async (route) => {
    const url = new URL(route.request().url());
    const target = `http://127.0.0.1:8099${url.pathname.replace(/^\/api\/office/, '')}${url.search}`;
    const response = await route.fetch({ url: target });
    await route.fulfill({ response, body: await response.text() });
  });

  let artifactFetched = false;
  await page.route('**/api/v1/artifacts/book-123', async (route) => {
    artifactFetched = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        artifact: {
          id: 'book-123',
          workspaceId: 'ws-1',
          title: 'Fixture Workbook',
          type: 'document',
          status: 'draft',
          tags: [],
          createdAt: NOW,
          updatedAt: NOW,
          revisions: [],
          sections: [
            {
              id: 'sec-bin',
              artifactId: 'book-123',
              heading: 'Workbook (xlsx)',
              kind: 'sheets-editor/binary',
              body: binaryBody,
              position: 0,
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
        },
      }),
    });
  });

  await page.goto('/sheets/book-123');

  // Artifact fetched → bytes injected → real session opened → sheet tab shown.
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.status-bar')).toContainText('Workbook fully loaded', { timeout: 150000 });
  expect(artifactFetched).toBe(true);
});

test('sheets app without artifact stays standalone', async ({ page }) => {
  await page.route('**/api/v1/artifacts/**', (route) => route.abort());
  await page.goto('/sheets/missing-artifact');
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 30000 });
});
