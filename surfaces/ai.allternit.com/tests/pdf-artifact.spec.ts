import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';

const NOW = '2026-01-01T00:00:00.000Z';

function makeArtifact(binaryBody: string, overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

test('pdf viewer loads artifact bytes and saves edited bytes back', async ({ page }) => {
  const binaryBody = makeHelloPdf().toString('base64');
  const sectionPatches: { sectionId: string; body: Record<string, unknown> }[] = [];
  const sectionPosts: Record<string, unknown>[] = [];

  await page.route('**/api/v1/artifacts/pdf-123/sections/*', async (route) => {
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
            artifactId: 'pdf-123',
            heading: 'Document (pdf)',
            kind: body.kind ?? 'pdf-viewer/binary',
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

  await page.route('**/api/v1/artifacts/pdf-123/sections', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      sectionPosts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          section: {
            id: `sec-new-${sectionPosts.length}`,
            artifactId: 'pdf-123',
            heading: body.heading ?? 'Text',
            kind: body.kind ?? 'pdf-viewer/plaintext',
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

  await page.route('**/api/v1/artifacts/pdf-123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ artifact: makeArtifact(binaryBody) }),
    });
  });

  await page.goto('/pdf/pdf-123');

  // The vendored viewer opens the artifact's PDF bytes (pdf.js canvas).
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 });

  // A real edit through the vendored UI: rotate the page via the thumbnail
  // context menu. That marks the document dirty and enables Save.
  await page.locator('.pdf-thumb').first().click({ button: 'right' });
  await page.locator('.thumb-menu').getByRole('button', { name: 'Rotate right' }).click();

  const saveButton = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // PdfView persists the saved bytes (debounced 1.5s): the binary section is
  // PATCHed with fresh base64 that differs from the fixture (the rotation was
  // applied), and a plaintext section is POSTed for iOS/search.
  await expect
    .poll(() => sectionPatches.length, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect(sectionPatches[0].sectionId).toBe('sec-bin');
  const savedBase64 = String(sectionPatches[0].body.body);
  expect(savedBase64).not.toBe(binaryBody);
  // Still a real PDF: base64 of "%PDF-".
  expect(savedBase64.startsWith('JVBER')).toBe(true);

  await expect
    .poll(() => sectionPosts.length, { timeout: 30000 })
    .toBeGreaterThan(0);
  expect(sectionPosts[0].kind).toBe('pdf-viewer/plaintext');
});

test('pdf viewer without artifact stays standalone (no artifact save)', async ({ page }) => {
  const artifactWrites: string[] = [];
  await page.route('**/api/v1/artifacts/**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
      artifactWrites.push(`${method} ${new URL(route.request().url()).pathname}`);
    }
    return route.abort();
  });
  await page.goto('/pdf/missing-artifact');

  // The vendored shell renders its no-document placeholder.
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.pdf-placeholder')).toContainText('No file to open', {
    timeout: 30000,
  });
  // Without a loaded document there is no ribbon, hence no Save button — and
  // no artifact write-back is ever attempted.
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  expect(artifactWrites).toHaveLength(0);
});
