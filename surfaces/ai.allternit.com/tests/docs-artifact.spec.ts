import { test, expect } from '@playwright/test';
import { buildBlankDocx, parseDocx, saveDocx } from '@allternit/office-docx-engine';

const NOW = '2026-01-01T00:00:00.000Z';

/** Build a real .docx fixture and return it base64-encoded (section body). */
async function makeDocxBase64(): Promise<string> {
  const blank = await buildBlankDocx();
  const doc = await parseDocx(blank);
  const bytes = await saveDocx(doc, [
    { kind: 'generated', block: { type: 'heading', level: 1, runs: [{ text: 'Fixture Heading' }] } },
    { kind: 'generated', block: { type: 'paragraph', runs: [{ text: 'Fixture body text' }] } },
  ]);
  return Buffer.from(bytes).toString('base64');
}

function makeArtifact(binaryBody: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'art-123',
    workspaceId: 'ws-1',
    title: 'Fixture Doc',
    type: 'document',
    status: 'draft',
    tags: [],
    createdAt: NOW,
    updatedAt: NOW,
    revisions: [],
    sections: [
      {
        id: 'sec-bin',
        artifactId: 'art-123',
        heading: 'Document (docx)',
        kind: 'docs-editor/binary',
        body: binaryBody,
        position: 0,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    ...overrides,
  };
}

test('docs editor loads a real docx from the artifact and saves bytes back', async ({ page }) => {
  const binaryBody = await makeDocxBase64();
  const sectionPatches: { sectionId: string; body: Record<string, unknown> }[] = [];
  const sectionPosts: Record<string, unknown>[] = [];

  await page.route('**/api/v1/artifacts/art-123/sections/*', async (route) => {
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
            artifactId: 'art-123',
            heading: 'Document (docx)',
            kind: body.kind ?? 'docs-editor/binary',
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

  await page.route('**/api/v1/artifacts/art-123/sections', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      sectionPosts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          section: {
            id: `sec-new-${sectionPosts.length}`,
            artifactId: 'art-123',
            heading: body.heading ?? 'Text',
            kind: body.kind ?? 'docs-editor/plaintext',
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

  await page.route('**/api/v1/artifacts/art-123', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ artifact: makeArtifact(binaryBody) }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ artifact: makeArtifact(binaryBody) }),
    });
  });

  await page.goto('/docs/art-123');

  // The real editor opens the artifact's docx bytes.
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.ProseMirror')).toContainText('Fixture Heading', { timeout: 15000 });
  await expect(page.locator('.ProseMirror')).toContainText('Fixture body text');

  // Type an edit and save with Ctrl+S (the app also autosaves).
  await page.locator('.ProseMirror').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' — edited live');
  await page.keyboard.press('Control+s');

  // Persist is debounced 1.5s: the binary section gets PATCHed with fresh
  // base64 (zip magic "UEs") and a plaintext section is POSTed for iOS/search.
  await expect
    .poll(() => sectionPatches.length, { timeout: 15000 })
    .toBeGreaterThan(0);
  expect(sectionPatches[0].sectionId).toBe('sec-bin');
  expect(String(sectionPatches[0].body.body)).toMatch(/^UEs/);

  await expect
    .poll(() => sectionPosts.length, { timeout: 15000 })
    .toBeGreaterThan(0);
  expect(sectionPosts[0].kind).toBe('docs-editor/plaintext');
  expect(String(sectionPosts[0].body)).toContain('Fixture body text');
});

test('docs editor without artifact stays standalone', async ({ page }) => {
  await page.route('**/api/v1/artifacts/**', (route) => route.abort());
  await page.goto('/docs/missing-artifact');
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.doc-page').first()).toBeVisible({ timeout: 30000 });
});
