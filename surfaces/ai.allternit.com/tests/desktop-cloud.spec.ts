import { test, expect } from '@playwright/test';

/**
 * Desktop Cloud end-to-end test
 *
 * Runs against the local dev stack:
 *   - Allternit API on http://127.0.0.1:8013
 *   - Platform Vite dev server (Playwright webServer on http://localhost:5177)
 *   - Tart host wrapper on http://127.0.0.1:8020
 *
 * This test expects a bot named "desktop-cloud-e2e-bot" owned by the local
 * dev user. The test provisions a macOS desktop via Tart, verifies it appears
 * in the global sandboxes table, stops it, and deprovisions it.
 */

test.setTimeout(600_000); // 10 minutes — VPS Incus provisioning can be slow
test.use({ video: 'on' });

const templateLabel = process.env.DESKTOP_CLOUD_TEMPLATE_LABEL || 'macOS Desktop (macos)';

test('provisions, stops, and deprovisions a desktop from the platform shell', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]`, msg.text().slice(0, 300));
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => {
    console.log('[BROWSER pageerror]', err.message);
    errors.push(err.message);
  });

  // 1. Open the authenticated platform shell and wait for it to settle.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Dismiss the welcome onboarding wizard if it appears (fresh dev / self-hosted).
  const getStarted = page.getByRole('button', { name: 'Get Started', exact: true });
  if (await getStarted.isVisible().catch(() => false)) {
    await getStarted.click();
    await page.waitForTimeout(500);
    // Walk through the multi-step setup wizard, handling both Continue and Skip variants.
    for (let i = 0; i < 5; i++) {
      const nextButton = page.getByRole('button', { name: /Continue|Skip for now/i }).first();
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
        await page.waitForTimeout(800);
      } else {
        break;
      }
    }
    // Final "done" screen has an "Open Allternit" CTA that closes the portal.
    const openAllternit = page.getByRole('button', { name: 'Open Allternit', exact: true });
    if (await openAllternit.isVisible().catch(() => false)) {
      await openAllternit.click();
      await page.waitForTimeout(500);
    }
  }

  await expect(page.getByText('Desktop Cloud')).toBeVisible({ timeout: 30_000 });

  // 2. Open the Desktop Cloud admin view.
  await page.getByText('Desktop Cloud', { exact: true }).click();
  await expect(page.getByText('Provision and manage bot desktops')).toBeVisible({ timeout: 30_000 });

  // 3. Wait for the provision form selects to populate.
  const botSelect = page.getByRole('combobox', { name: 'Bot', exact: true });
  await botSelect.waitFor({ timeout: 20_000 });
  await expect.poll(async () => botSelect.locator('option').count(), {
    message: 'wait for bot options to populate',
    timeout: 30_000,
  }).toBeGreaterThan(1);
  const botOptions = await botSelect.locator('option').allTextContents();
  console.log('Bot select options:', botOptions);
  if (botOptions.length <= 1) {
    throw new Error(`Bot select has no bots. Options: ${JSON.stringify(botOptions)}`);
  }
  // Select by value so duplicate labels cannot cause the wrong bot to be chosen,
  // and verify the selected value is actually the e2e bot.
  const botOptionsWithValue = await botSelect.locator('option').evaluateAll(
    (opts) => opts.map((o) => ({ value: (o as HTMLOptionElement).value, label: o.textContent?.trim() ?? '' }))
  );
  const e2eBotOption = botOptionsWithValue.find((o) => /desktop-cloud-e2e-bot/i.test(o.label));
  if (!e2eBotOption) {
    throw new Error(`desktop-cloud-e2e-bot not found in options: ${JSON.stringify(botOptionsWithValue)}`);
  }
  await botSelect.selectOption(e2eBotOption.value);
  await expect(botSelect).toHaveValue(e2eBotOption.value);
  await page.waitForTimeout(500);

  const templateSelect = page.getByRole('combobox', { name: 'Template', exact: true });
  await expect.poll(async () => templateSelect.locator('option').count(), {
    message: 'wait for template options to populate',
    timeout: 30_000,
  }).toBeGreaterThan(1);
  await templateSelect.selectOption({ label: templateLabel });
  await expect(templateSelect).toHaveValue(/^.{3,}$/);

  // 4. Clean up any sandboxes left from previous runs so this test is idempotent.
  const sandboxesTable = page.getByTestId('sandboxes-table');
  const existingRows = sandboxesTable.locator('tbody tr');
  let existingCount = await existingRows.count();
  while (existingCount > 0) {
    const row = existingRows.first();
    await row.getByRole('button', { name: 'Deprovision', exact: true }).click();
    await expect(row).toBeHidden({ timeout: 60_000 });
    existingCount = await existingRows.count();
  }

  // 5. Provision the desktop.
  await page.getByRole('button', { name: 'Provision', exact: true }).click();

  // 6. Wait for the sandbox table to populate and reach running state.
  const sandboxRow = page.getByTestId('sandboxes-table').locator('tbody tr').filter({ hasText: /desktop-cloud-e2e-bot/i }).first();
  await expect(sandboxRow).toBeVisible({ timeout: 120_000 });
  await expect(sandboxRow).toContainText(/running/i, { timeout: 120_000 });

  // 6. Stop the desktop.
  const stopButton = sandboxRow.getByRole('button', { name: /Stop/i });
  await stopButton.click();
  await expect(sandboxRow).toContainText(/stopped|paused/i, { timeout: 60_000 });

  // 7. Deprovision the desktop.
  const deprovisionButton = sandboxRow.getByRole('button', { name: /Deprovision/i });
  await deprovisionButton.click();
  await expect(sandboxRow).toBeHidden({ timeout: 60_000 });

  // 8. No React infinite loop or Desktop Cloud errors should have occurred.
  // Ignore pre-existing agent-bootstrap 422s from the platform shell.
  const relevantErrors = errors.filter(
    (msg) => !msg.includes('Gizzi creation failed') && !msg.includes('Attempt 1 failed') && !msg.includes('422')
  );
  expect(relevantErrors).toHaveLength(0);
});
