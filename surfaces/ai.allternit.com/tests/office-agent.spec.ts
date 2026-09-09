import { test, expect } from '@playwright/test';

const SSE_BODY = [
  'data: {"chunk_type":"text","chunk":"Summary: the document covers "}',
  'data: {"chunk_type":"text","chunk":"the quarterly plan."}',
  'data: [DONE]',
  '',
].join('\n');

test('docs editor shows a single Allternit Office Agent pane (no Built-in tab)', async ({ page }) => {
  await page.goto('/docs');
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });

  const rail = page.locator('.office-ext-rail');
  if (await rail.isVisible().catch(() => false)) await rail.click();

  // Exactly one chat pane: the Allternit Office Agent tab, no Built-in fallback.
  await expect(page.locator('.office-ext-tab')).toHaveCount(1);
  await expect(page.locator('.office-ext-tab')).toHaveText('Allternit Office Agent');
  await expect(page.getByText('Built-in')).toHaveCount(0);
  await expect(page.locator('.aos-assistant')).toBeVisible();

  // Brand mark renders in the pane header (pixel-A svg, not a text glyph).
  await expect(page.locator('.aos-assistant-title svg')).toBeVisible();
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
