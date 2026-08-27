import { test, expect } from '@playwright/test';
import { buildBlankDocx, parseDocx, saveDocx } from '@allternit/office-docx-engine';

const NOW = '2026-01-01T00:00:00.000Z';

/**
 * The office engine serves POST /markdown (anydoc), but the gateway build on
 * :8013 predates the /api/office/markdown proxy route — so the spec proxies
 * that one path straight to the engine via route.fetch (same pattern as
 * sheets-route.spec.ts: fetch in Node, fulfill same-origin).
 *
 * OFFICE_ENGINE_URL overrides the engine target: the long-running :8099
 * process may predate the /markdown route (check `curl localhost:8099/health`
 * for an `anydoc` engine entry), in which case run a scratch engine on another
 * port, e.g. `OFFICE_ENGINE_PORT=8109 pnpm dev` in services/office-engine.
 */
const ENGINE_URL = process.env.OFFICE_ENGINE_URL ?? 'http://127.0.0.1:8099';

async function proxyMarkdownToEngine(page: import('@playwright/test').Page) {
  await page.route('**/api/office/markdown', async (route) => {
    const response = await route.fetch({
      url: `${ENGINE_URL}/markdown`,
      method: 'POST',
      headers: route.request().headers(),
      data: route.request().postDataBuffer() ?? undefined,
    });
    await route.fulfill({ response, body: await response.body() });
  });
}

/** Minimal RTF fixture: anydoc converts it without a signature sniff issue. */
function makeSampleRtf(): Buffer {
  return Buffer.from(
    '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Helvetica;}} \\f0\\fs28 Hello anydoc preview. Second line of prose.}',
  );
}

async function makeSampleDocx(): Promise<Buffer> {
  const blank = await buildBlankDocx();
  const doc = await parseDocx(blank);
  const bytes = await saveDocx(doc, [
    { kind: 'generated', block: { type: 'heading', level: 1, runs: [{ text: 'Docs Routing Fixture' }] } },
    { kind: 'generated', block: { type: 'paragraph', runs: [{ text: 'This must open in Allternit Docs.' }] } },
  ]);
  return Buffer.from(bytes);
}

test('launcher hands a .rtf to the markdown preview', async ({ page }) => {
  // Cold dev server + lazy chunks: budget generously (see sheets-route.spec.ts).
  test.setTimeout(180_000);
  await proxyMarkdownToEngine(page);

  await page.goto('/office');
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'memo.rtf',
    mimeType: 'application/rtf',
    buffer: makeSampleRtf(),
  });

  await expect(page).toHaveURL(/\/markdown-preview$/, { timeout: 30000 });
  await expect(page.getByTestId('markdown-preview')).toBeVisible({ timeout: 60000 });
  await expect(page.getByTestId('markdown-preview-filename')).toHaveText('memo.rtf', { timeout: 60000 });
  await expect(page.getByTestId('markdown-preview-format')).toHaveText('rtf');
  const content = page.getByTestId('markdown-preview-content');
  await expect(content).toBeVisible({ timeout: 60000 });
  await expect(content).toContainText('Hello anydoc preview', { timeout: 60000 });
});

test('a .docx still opens in Allternit Docs (routing not hijacked)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/office');
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer: await makeSampleDocx(),
  });

  await expect(page).toHaveURL(/\/docs$/, { timeout: 90000 });
  await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('.ProseMirror')).toContainText('Docs Routing Fixture', { timeout: 30000 });
});

test('save-as-artifact posts the converted markdown as a section', async ({ page }) => {
  test.setTimeout(180_000);
  await proxyMarkdownToEngine(page);

  const artifactPosts: Record<string, unknown>[] = [];
  await page.route('**/api/v1/artifacts', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, unknown>;
      artifactPosts.push(body);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          artifact: {
            id: 'art-md-1',
            workspaceId: body.workspaceId ?? 'default',
            title: body.title ?? 'memo.rtf',
            type: body.type ?? 'document',
            status: 'draft',
            tags: [],
            createdAt: NOW,
            updatedAt: NOW,
            revisions: [],
            sections: [],
          },
        }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto('/office');
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'memo.rtf',
    mimeType: 'application/rtf',
    buffer: makeSampleRtf(),
  });

  await expect(page).toHaveURL(/\/markdown-preview$/, { timeout: 30000 });
  await expect(page.getByTestId('markdown-preview-content')).toContainText('Hello anydoc preview', {
    timeout: 90000,
  });

  await page.getByTestId('markdown-preview-save-artifact').click();

  await expect.poll(() => artifactPosts.length, { timeout: 15000 }).toBe(1);
  const payload = artifactPosts[0];
  expect(payload.type).toBe('document');
  // The gateway's CreateBody is snake_case — the client must send workspace_id.
  expect(payload.workspace_id).toBeTruthy();
  const sections = payload.sections as { kind?: string; body?: string }[];
  expect(sections).toHaveLength(1);
  expect(sections[0].kind).toBe('markdown-preview/markdown');
  expect(String(sections[0].body)).toContain('Hello anydoc preview');

  await expect(page.getByTestId('markdown-preview-save-status')).toContainText('Saved', { timeout: 15000 });
});

test('open URL as Markdown posts the url and renders the converted page', async ({ page }) => {
  test.setTimeout(180_000);

  const urlPosts: Record<string, unknown>[] = [];
  await page.route('**/api/office/markdown-url', async (route) => {
    urlPosts.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'conv-url-1',
        type: 'markdown-conversion',
        title: 'Example Article',
        sourceUrl: 'https://example.com/article',
        mimeType: 'text/markdown',
        markdown: '# Example Article\n\nThe **converted** page body.\n',
        format: 'html',
        stats: { textLength: 48 },
        engine: { name: 'readability+turndown', phase: 'prototype' },
        createdAt: NOW,
      }),
    });
  });

  await page.goto('/office');
  await page.getByTestId('office-launcher-open-url').click();

  await expect(page).toHaveURL(/\/markdown-preview$/, { timeout: 30000 });
  await expect(page.getByTestId('markdown-preview-url-input')).toBeVisible({ timeout: 60000 });
  await page.getByTestId('markdown-preview-url-input').fill('https://example.com/article');
  await page.getByTestId('markdown-preview-url-open').click();

  await expect.poll(() => urlPosts.length, { timeout: 15000 }).toBe(1);
  expect(urlPosts[0].url).toBe('https://example.com/article');

  const content = page.getByTestId('markdown-preview-content');
  await expect(content).toBeVisible({ timeout: 60000 });
  await expect(content).toContainText('Example Article', { timeout: 60000 });
  await expect(content).toContainText('converted');
  await expect(page.getByTestId('markdown-preview-format')).toHaveText('html');
});
