import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';

const SSE_BODY = [
  'data: {"chunk_type":"text","chunk":"The workbook shows "}',
  'data: {"chunk_type":"text","chunk":"revenue of 42 in B1."}',
  'data: [DONE]',
  '',
].join('\n');

function sseText(text: string): string {
  // Split into two deltas so the panel exercises streaming, not just a one-shot body.
  const mid = Math.ceil(text.length / 2);
  return [
    `data: ${JSON.stringify({ chunk_type: 'text', chunk: text.slice(0, mid) })}`,
    `data: ${JSON.stringify({ chunk_type: 'text', chunk: text.slice(mid) })}`,
    'data: [DONE]',
    '',
  ].join('\n');
}

test('sheets AI panel EXECUTES a workbook tool (set A1 to 5) through the agent loop', async ({ page }) => {
  // The vendored sheets app boots its huge Univer module graph on a cold dev server.
  test.setTimeout(180_000);

  // Turn 1: the model answers with a fenced tool_call block (the wire protocol
  // the office-ai loop teaches in the system prompt) proposing a set_cell op.
  // Turn 2: the follow-up request MUST carry the real tool result produced by
  // the vendored skill's executeTool (proof the tool actually ran client-side).
  let followUpHadToolResult = false;
  await page.route('**/api/agent-chat', async (route) => {
    const body = route.request().postDataJSON() as { message?: string; systemPrompt?: string };
    const message = body.message ?? '';
    if (message.includes('[Tool results]')) {
      // The vendored executeWorkbookTool auto-applies propose_operations and
      // reports the real diff; the loop must feed that output back to the model.
      expect(message).toContain('propose_operations');
      expect(message).toContain('Auto-applied');
      expect(message).toContain('A1');
      followUpHadToolResult = true;
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: sseText('Done — A1 is now 5.'),
      });
      return;
    }
    // First turn: the loop must ship the tool protocol + catalog in the system
    // prompt and the workbook context (active sheet id) in the user message.
    expect(body.systemPrompt ?? '').toContain('Tool calling protocol');
    expect(body.systemPrompt ?? '').toContain('propose_operations');
    const sheetId = /id=([A-Za-z0-9_-]+)/.exec(message)?.[1] ?? 'sheet-1';
    const toolCall = JSON.stringify({
      name: 'propose_operations',
      input: {
        operations: [{ op: 'set_cell', sheetId, address: 'A1', value: 5 }],
        summary: 'Set A1 to 5',
      },
    });
    const reply = `Sure — setting A1 to 5.\n\n\`\`\`tool_call\n${toolCall}\n\`\`\`\n`;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: sseText(reply),
    });
  });

  await page.goto('/sheets');

  // Open the AI copilot from the ribbon (collapsed by default in this build).
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 90000 });
  await page.getByText('Allternit AI').first().click();

  const composer = page.locator('.ai-input-box textarea');
  await expect(composer).toBeVisible({ timeout: 30000 });
  await composer.fill('set A1 to 5');
  await composer.press('Enter');

  // The proposed operations really applied to the Univer workbook: the app
  // patches the assistant message with the inline "Applied N changes [Undo]"
  // chip only after autoApplySafePlan commits the plan to the grid.
  await expect(page.locator('.ai-auto-applied')).toBeVisible({ timeout: 90000 });

  // The raw tool_call DSL must never leak into the rendered chat.
  await expect(page.locator('.ai-markdown').getByText('Done — A1 is now 5.')).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator('.ai-chat')).not.toContainText('```tool_call');
  expect(followUpHadToolResult).toBe(true);
});

test('sheets AI composer streams a real answer through the office-ai transport', async ({ page }) => {
  // Mock the platform agent-chat endpoint with a deterministic SSE stream.
  await page.route('**/api/agent-chat', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    const body = request.postDataJSON() as { chatId?: string; message?: string };
    expect(body.chatId).toBeTruthy();
    expect(body.message).toContain('What is in this workbook?');
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/sheets');

  // Open the AI copilot from the ribbon (collapsed by default in this build).
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 30000 });
  await page.getByText('Allternit AI').first().click();

  // The composer appears; type and send.
  const composer = page.locator('.ai-input-box textarea');
  await expect(composer).toBeVisible({ timeout: 15000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  // The mocked stream renders into the panel as an assistant message.
  await expect(page.locator('.ai-markdown').getByText('The workbook shows revenue of 42 in B1.')).toBeVisible({
    timeout: 15000,
  });
});

test('docs AI panel streams a real answer through the office-ai transport', async ({ page }) => {
  await page.route('**/api/agent-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/docs');

  // The panel starts as a collapsed rail in the vendored app.
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
  const rail = page.locator('.ai-rail');
  if (await rail.isVisible().catch(() => false)) await rail.click();

  const composer = page.locator('.ai-input-box textarea');
  await expect(composer).toBeVisible({ timeout: 15000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  await expect(page.locator('.ai-markdown').getByText('The workbook shows revenue of 42 in B1.')).toBeVisible({
    timeout: 15000,
  });
});

test('slides AI panel streams a real answer through the office-ai transport', async ({ page }) => {
  await page.route('**/api/agent-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: SSE_BODY,
    });
  });

  await page.goto('/slides');
  await expect(page.locator('.app')).toBeVisible({ timeout: 60000 });

  // The slides AI dock defaults to open — use its composer directly.
  const composer = page.locator('.ai-input-box textarea').first();
  await expect(composer).toBeVisible({ timeout: 30000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  await expect(page.getByText('The workbook shows revenue of 42 in B1.').first()).toBeVisible({
    timeout: 15000,
  });
});

test('pdf AI panel streams a real answer through the office-ai transport', async ({ page }) => {
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

  // The pdf AI dock defaults to open — use its composer directly.
  const composer = page.locator('.ai-composer textarea');
  await expect(composer).toBeVisible({ timeout: 30000 });
  await composer.fill('What is in this workbook?');
  await composer.press('Enter');

  await expect(page.locator('.ai-markdown').getByText('The workbook shows revenue of 42 in B1.')).toBeVisible({
    timeout: 15000,
  });
});
