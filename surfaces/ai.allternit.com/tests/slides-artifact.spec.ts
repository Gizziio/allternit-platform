import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { createBlankPptx } from '@allternit/office-pptx-engine';

const NOW = '2026-01-01T00:00:00.000Z';

function makeArtifact(binaryBody: string, overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

test('slides editor loads artifact deck and saves edited deck back', async ({ page }) => {
  const binaryBody = Buffer.from(await createBlankPptx()).toString('base64');
  const sectionPatches: { sectionId: string; body: Record<string, unknown> }[] = [];
  const sectionPosts: Record<string, unknown>[] = [];

  await page.route('**/api/v1/artifacts/deck-123/sections/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const sectionId = url.pathname.split('/').pop()!;
    if (request.method() === 'PATCH') {
      const body = request.postDataJSON() as Record<string, unknown>;
      sectionPatches.push({ sectionId, body });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          section: {
            id: sectionId,
            artifactId: 'deck-123',
            heading: 'Presentation (pptx)',
            kind: body.kind ?? 'slides-editor/binary',
            body: body.body ?? '',
            position: body.position ?? 0,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/artifacts/deck-123/sections', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      sectionPosts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          section: {
            id: `sec-new-${sectionPosts.length}`,
            artifactId: 'deck-123',
            heading: body.heading ?? 'Text',
            kind: body.kind ?? 'slides-editor/plaintext',
            body: body.body ?? '',
            position: body.position ?? 1,
            createdAt: NOW,
            updatedAt: NOW,
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route('**/api/v1/artifacts/deck-123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ artifact: makeArtifact(binaryBody) }),
    });
  });

  await page.goto('/slides/deck-123');

  // The vendored editor opens the artifact's pptx bytes (Konva canvas).
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 });

  // A real edit through the vendored UI: add a slide (Home tab → New Slide).
  // At the 1280px test viewport the ribbon collapses the Slides group into a
  // dropdown — open it if the big button isn't rendered inline.
  const newSlide = page.getByRole('button', { name: 'New Slide' }).first();
  if (!(await newSlide.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Slides', exact: true }).first().click();
  }
  await newSlide.click();

  const saveButton = page.locator('button[title="Save (⌘S)"]');
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // SlidesView persists the saved bytes (debounced 1.5s): the binary section
  // is PATCHed with fresh base64 (a real .pptx zip — base64 of "PK"), and the
  // saved deck actually contains the added slide.
  await expect
    .poll(() => sectionPatches.length, { timeout: 60000 })
    .toBeGreaterThan(0);
  expect(sectionPatches[0].sectionId).toBe('sec-bin');
  const savedBase64 = String(sectionPatches[0].body.body);
  expect(savedBase64.startsWith('UEs')).toBe(true);

  const savedZip = await JSZip.loadAsync(Buffer.from(savedBase64, 'base64'));
  const slideParts = Object.keys(savedZip.files).filter((name) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(name),
  );
  expect(slideParts.length).toBe(2);

  // A plaintext section is POSTed alongside for iOS/search.
  await expect
    .poll(() => sectionPosts.length, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect(sectionPosts[0].kind).toBe('slides-editor/plaintext');
});

test('slides editor without artifact stays standalone (no artifact save)', async ({ page }) => {
  const artifactWrites: string[] = [];
  await page.route('**/api/v1/artifacts/**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
      artifactWrites.push(`${method} ${new URL(route.request().url()).pathname}`);
    }
    return route.abort();
  });
  await page.goto('/slides/missing-artifact');

  // The vendored editor lands on a fresh blank deck (its normal no-document
  // behavior): shell and canvas render, but nothing is dirty, so Save stays
  // disabled and no artifact write-back is ever attempted.
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 60000 });
  await expect(page.locator('button[title="Save (⌘S)"]')).toBeDisabled();
  expect(artifactWrites).toHaveLength(0);
});
