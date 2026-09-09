import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';

const SSE_BODY = [
  'data: {"chunk_type":"text","chunk":"The workbook shows "}',
  'data: {"chunk_type":"text","chunk":"revenue of 42 in B1."}',
  'data: [DONE]',
  '',
].join('\n');

// NOTE: the vendored apps' built-in AI panels (office-ai genspark-derived,
// incl. the sheets propose_operations tool execution) are no longer mounted on
// hosts that register the Allternit Office Agent extension — the agent pane is
// the single chat surface. These specs exercise the agent pane end-to-end
// through the same /api/agent-chat SSE transport.

test('sheets agent pane streams a real answer through the office-ai transport', async ({ page }) => {
  // Mock the platform agent-chat endpoint with a deterministic SSE stream.
  await page.route('**/api/agent-chat', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const body = request.postDataJSON() as { message?: string };
    expect(body.message).toContain('What is in this workbook?');
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/sheets');

  // Open the agent pane from the ribbon (collapsed by default in this build).
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 30000 });
  await page.getByText('Allternit Office Agent').first().click();

  // The composer appears; type and send.
  const composer = page.locator('.aos-assistant textarea');
  await expect(composer).toBeVisible({ timeout: 15000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  // The mocked stream renders into the agent pane as an assistant message.
  await expect(page.locator('.aos-assistant-msg-text').getByText('The workbook shows revenue of 42 in B1.')).toBeVisible({
    timeout: 15000,
  });
});

test('docs agent pane streams a real answer through the office-ai transport', async ({ page }) => {
  await page.route('**/api/agent-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/docs');

  // The dock starts as the slot's branded collapsed rail in the vendored app.
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
  const rail = page.locator('.office-ext-rail');
  if (await rail.isVisible().catch(() => false)) await rail.click();

  const composer = page.locator('.aos-assistant textarea');
  await expect(composer).toBeVisible({ timeout: 15000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  await expect(page.locator('.aos-assistant-msg-text').getByText('The workbook shows revenue of 42 in B1.')).toBeVisible({
    timeout: 15000,
  });
});

test('slides agent pane streams a real answer through the office-ai transport', async ({ page }) => {
  await page.route('**/api/agent-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/slides');
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });

  // The slides AI dock defaults to open — use the agent composer directly.
  const composer = page.locator('.aos-assistant textarea').first();
  await expect(composer).toBeVisible({ timeout: 30000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  await expect(page.getByText('The workbook shows revenue of 42 in B1.').first()).toBeVisible({
    timeout: 15000,
  });
});

test('pdf agent pane streams a real answer through the office-ai transport', async ({ page }) => {
  await page.route('**/api/agent-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  // The pdf editor needs a document to boot — inject one via the artifact API.
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

  // The pdf AI dock defaults to open — use the agent composer directly.
  const composer = page.locator('.aos-assistant textarea');
  await expect(composer).toBeVisible({ timeout: 30000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  await expect(page.locator('.aos-assistant-msg-text').getByText('The workbook shows revenue of 42 in B1.')).toBeVisible({
    timeout: 15000,
  });
});
