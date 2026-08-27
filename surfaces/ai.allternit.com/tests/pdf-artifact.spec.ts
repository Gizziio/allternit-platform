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

test('pdf viewer loads artifact bytes and stays read-only', async ({ page }) => {
  const binaryBody = makeHelloPdf().toString('base64');
  const artifactWrites: string[] = [];

  await page.route('**/api/v1/artifacts/**', (route) => {
    const method = route.request().method();
    if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
      artifactWrites.push(`${method} ${new URL(route.request().url()).pathname}`);
    }
    return route.fallback();
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

  // Allternit PDF is a viewer: editing actions are disabled and no artifact
  // write-back is attempted. The badge says "View-only" (not "Encrypted").
  const roBadge = page.locator('.tb-readonly');
  await expect(roBadge).toBeVisible({ timeout: 30000 });
  await expect(roBadge).toHaveText('View-only');

  await page.locator('.pdf-thumb').first().click({ button: 'right' });
  const rotateButton = page.locator('.thumb-menu').getByRole('button', { name: 'Rotate right' });
  await expect(rotateButton).toBeDisabled();

  const saveButton = page.getByRole('button', { name: 'Save', exact: true });
  await expect(saveButton).toHaveCount(0);

  expect(artifactWrites).toHaveLength(0);
});

test('pdf viewer selection shows Copy popup in read-only mode', async ({ page }) => {
  const binaryBody = makeHelloPdf().toString('base64');

  await page.route('**/api/v1/artifacts/pdf-123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ artifact: makeArtifact(binaryBody) }),
    });
  });

  await page.goto('/pdf/pdf-123');
  await expect(page.locator('.app')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30000 });
  const roBadge2 = page.locator('.tb-readonly');
  await expect(roBadge2).toBeVisible({ timeout: 30000 });
  await expect(roBadge2).toHaveText('View-only');

  // pdf.js text layer renders selectable spans inside .textLayer.
  const textLayer = page.locator('.textLayer').first();
  await expect(textLayer).toBeVisible({ timeout: 30000 });

  // Select all text in the text layer and dispatch mouseup so the viewer
  // positions its floating popup.
  const selected = await textLayer.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return sel?.toString() ?? '';
  });
  expect(selected).toContain('Hello Allternit PDF');

  await page.locator('.pdf-scroll').dispatchEvent('mouseup');

  const popup = page.locator('.pdf-sel-popup');
  await expect(popup).toBeVisible({ timeout: 3000 });
  await expect(popup.getByRole('button', { name: 'Copy' })).toBeVisible();

  // Markup tools are editing actions and must be hidden in read-only mode.
  await expect(popup.getByRole('button', { name: 'Highlight' })).toHaveCount(0);
  await expect(popup.getByRole('button', { name: 'Underline' })).toHaveCount(0);
  await expect(popup.getByRole('button', { name: 'Strikethrough' })).toHaveCount(0);
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
