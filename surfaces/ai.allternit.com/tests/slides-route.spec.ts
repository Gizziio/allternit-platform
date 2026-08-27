import { test, expect } from '@playwright/test';
import { createBlankPptx } from '@allternit/office-pptx-engine';

const NOW = '2026-01-01T00:00:00.000Z';

test('/slides/:artifactId renders the real slides app', async ({ page }) => {
  await page.goto('/slides/test-123');
  // The vendored app mounts (start screen or canvas — both prove the real UI).
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });
});

test('slides app opens a real .pptx from an artifact', async ({ page }) => {
  const bytes = await createBlankPptx();
  const binaryBody = Buffer.from(bytes).toString('base64');

  await page.route('**/api/v1/artifacts/deck-123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        artifact: {
          id: 'deck-123',
          workspaceId: 'ws-1',
          title: 'Fixture Deck',
          type: 'document',
          status: 'draft',
          tags: [],
          createdAt: NOW,
          updatedAt: NOW,
          revisions: [],
          sections: [
            {
              id: 'sec-bin',
              artifactId: 'deck-123',
              heading: 'Presentation (pptx)',
              kind: 'slides-editor/binary',
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

  await page.goto('/slides/deck-123');

  // The vendored app opens the injected deck through the in-process engine.
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });
  // A blank deck still renders a slide canvas (Konva) once opened.
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 });
});

test('slides app without artifact stays standalone', async ({ page }) => {
  await page.route('**/api/v1/artifacts/**', (route) => route.abort());
  await page.goto('/slides/missing-artifact');
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });
});
