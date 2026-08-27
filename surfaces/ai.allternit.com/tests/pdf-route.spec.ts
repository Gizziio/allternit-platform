import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';

const NOW = '2026-01-01T00:00:00.000Z';

test('/pdf/:artifactId renders the real pdf app', async ({ page }) => {
  await page.goto('/pdf/test-123');
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
});

test('pdf app opens a real .pdf from an artifact', async ({ page }) => {
  const binaryBody = makeHelloPdf().toString('base64');

  await page.route('**/api/v1/artifacts/pdf-123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        artifact: {
          id: 'pdf-123',
          workspaceId: 'ws-1',
          title: 'Fixture PDF',
          type: 'document',
          status: 'draft',
          tags: [],
          createdAt: NOW,
          updatedAt: NOW,
          revisions: [],
          sections: [
            {
              id: 'sec-bin',
              artifactId: 'pdf-123',
              heading: 'Document (pdf)',
              kind: 'pdf-viewer/binary',
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

  await page.goto('/pdf/pdf-123');

  // The vendored app opens the injected PDF through the in-process flow.
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 });
});

test('pdf app without artifact stays standalone', async ({ page }) => {
  await page.route('**/api/v1/artifacts/**', (route) => route.abort());
  await page.goto('/pdf/missing-artifact');
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
});
