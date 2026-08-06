import { test, expect } from '@playwright/test';
import { makeSampleXlsxBase64 } from './helpers/office';

test('/sheets/:artifactId renders the real sheets app', async ({ page }) => {
  await page.goto('/sheets/test-123');
  // The vendored Univer shell proves the full GenOffice UI mounted.
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.excel-header')).toBeVisible({ timeout: 30000 });
});

test('sheets app opens a real .xlsx from an artifact via the office engine', async ({ page }) => {
  // Cold dev server + parallel workers: the vendored app's module graph is
  // huge, and follow-up session requests queue behind slow vite transforms in
  // the browser's per-origin connection pool. Budget for it.
  test.setTimeout(180_000);
  const binaryBody = await makeSampleXlsxBase64();

  // The artifact API is mocked (fixture carries real xlsx bytes); the office
  // engine calls go to the REAL service on :8099 (the gateway build running
  // on :8013 predates the /api/office/xlsx/* routes).
  //
  // Proxy through Playwright (route.fetch + fulfill) instead of
  // route.continue({ url }): continue retargets the browser request to a
  // different origin, and the engine sends no CORS headers (OPTIONS
  // preflight 404s), so continued responses can be swallowed by the browser
  // — observed as the status bar sticking at "Streaming …" when the dev
  // server is cold. Fetching in Node and fulfilling keeps the exchange
  // same-origin from the page's perspective and deterministic.
  await page.route('**/api/office/**', async (route) => {
    const url = new URL(route.request().url());
    const target = `http://127.0.0.1:8099${url.pathname.replace(/^\/api\/office/, '')}${url.search}`;
    const response = await route.fetch({ url: target });
    await route.fulfill({ response, body: await response.text() });
  });
  await page.route('**/api/v1/artifacts/book-123', async (route) => {
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
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          revisions: [],
          sections: [
            {
              id: 'sec-bin',
              artifactId: 'book-123',
              heading: 'Workbook (xlsx)',
              kind: 'sheets-editor/binary',
              body: binaryBody,
              position: 0,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }),
    });
  });

  await page.goto('/sheets/book-123');

  // The app auto-opens the injected workbook through a real engine session:
  // the fixture's sheet tab must appear in the Univer shell.
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('.status-bar')).toContainText('Workbook fully loaded', { timeout: 150000 });
});
