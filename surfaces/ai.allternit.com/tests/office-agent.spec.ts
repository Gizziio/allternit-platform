import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';

const SSE_BODY = [
  'data: {"chunk_type":"text","chunk":"Summary: the document covers "}',
  'data: {"chunk_type":"text","chunk":"the quarterly plan."}',
  'data: [DONE]',
  '',
].join('\n');

test('docs editor shows a single Allternit Office Agent header row (no tab strip)', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });

  const rail = page.locator('.office-ext-rail');
  if (await rail.isVisible().catch(() => false)) await rail.click();

  // The slot renders no tab strip — the panel header is the ONE header row.
  await expect(page.locator('.office-ext-tab')).toHaveCount(0);
  const dock = page.locator('.ai-dock');
  await expect(dock.getByText('Allternit Office Agent', { exact: true })).toHaveCount(1);
  await expect(page.locator('.aos-assistant')).toBeVisible();

  // Brand mark renders in the pane header (pixel-A svg, not a text glyph)…
  await expect(page.locator('.aos-assistant-title svg')).toBeVisible();
  // …and the functional controls live in that same row.
  await expect(page.locator('.aos-assistant-model-picker-trigger')).toBeVisible();
  await expect(page.locator('.aos-assistant-header-actions button[title="Close panel"]')).toBeVisible();
});

test('docs AI Summarize routes through the agent pane with document context', async ({ page }) => {
  let sawDocumentContext = false;
  await page.route('**/api/agent-chat', async (route) => {
    const body = route.request().postDataJSON() as { systemPrompt?: string; message?: string };
    // The agent loop ships the open document's name/excerpt with the message.
    if (body.message?.includes('Quarterly plan: ship the office agent consolidation.')) sawDocumentContext = true;
    expect(body.message).toContain('Summarize the main content and key points of this document');
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/docs');
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });

  // Give the blank document some content so the ribbon AI actions enable.
  await page.locator('.doc-page').click();
  await page.keyboard.type('Quarterly plan: ship the office agent consolidation.');

  // Expand the agent pane via the slot's collapsed rail.
  const rail = page.locator('.office-ext-rail');
  if (await rail.isVisible().catch(() => false)) await rail.click();
  await expect(page.locator('.aos-assistant')).toBeVisible();

  // The ribbon action is enabled with content and submits through the agent pane.
  const summarize = page.getByRole('button', { name: 'AI Summarize' });
  await expect(summarize).toBeEnabled();
  await summarize.click();

  // The preset lands as a user message and the streamed reply renders in the pane.
  await expect(
    page.locator('.aos-assistant-msg-text').getByText('Summarize the main content and key points of this document'),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.locator('.aos-assistant-msg-text').getByText('Summary: the document covers the quarterly plan.'),
  ).toBeVisible({ timeout: 15000 });
  expect(sawDocumentContext).toBe(true);
});

test('pdf agent pane reads the open PDF — chat and presets carry its extracted text', async ({ page }) => {
  test.setTimeout(180_000);
  const postBodies: string[] = [];
  await page.route('**/api/agent-chat', async (route) => {
    postBodies.push(JSON.stringify(route.request().postDataJSON()));
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  // Boot the viewer with a real one-page PDF (extractable text) via the artifact API.
  const NOW = '2026-01-01T00:00:00.000Z';
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
              body: makeHelloPdf().toString('base64'),
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
  await expect(page.locator('.ai-dock')).toBeVisible({ timeout: 60000 });

  // The context banner names the open file.
  await expect(page.locator('.aos-assistant-doc')).toContainText('Fixture_PDF.pdf', {
    timeout: 30000,
  });

  // The ribbon preset enables only after the PDF text has been extracted.
  const summarize = page.getByRole('button', { name: 'Summarize', exact: true });
  await expect(summarize).toBeEnabled({ timeout: 60000 });

  // Typed chat: the POST body carries the extracted PDF text with the message.
  const composer = page.locator('.aos-assistant textarea');
  await composer.fill('What does this PDF say?');
  await composer.press('Enter');
  await expect(
    page.locator('.aos-assistant-msg-text').getByText('Summary: the document covers the quarterly plan.'),
  ).toBeVisible({ timeout: 15000 });
  expect(
    postBodies.some((b) => b.includes('What does this PDF say?') && b.includes('Hello Allternit PDF')),
  ).toBe(true);

  // Preset click: posts through the agent pane with the PDF text as context.
  await summarize.click();
  await expect(
    page.locator('.aos-assistant-msg-text').getByText('Please summarize the main content of this document.'),
  ).toBeVisible({ timeout: 15000 });
  expect(
    postBodies.some(
      (b) => b.includes('Please summarize the main content of this document.') && b.includes('Hello Allternit PDF'),
    ),
  ).toBe(true);
});
