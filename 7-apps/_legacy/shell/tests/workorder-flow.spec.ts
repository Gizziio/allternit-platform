import { test, expect } from '@playwright/test';

test('test workorder interaction loop', async ({ page }) => {
  page.on('console', msg => console.log(`BROWSER LOG: [${msg.type()}] ${msg.text()}`));
  
  await page.goto('http://127.0.0.1:5173');
  await page.waitForTimeout(2000);

  // 1. Click the workorder card
  console.log('Clicking fwk_workorder card...');
  await page.click('text=fwk_workorder');
  
  // Verify input is filled
  const input = page.locator('.ax-command-bar input');
  await expect(input).toHaveValue('workorder');

  // 2. Submit the command
  console.log('Submitting command...');
  await page.click('button:has-text("Run")');

  // 3. Wait for the table to render
  console.log('Waiting for table...');
  const table = page.locator('table.list-view');
  await expect(table).toBeVisible({ timeout: 10000 });
  
  // Verify columns
  const headers = table.locator('th');
  await expect(headers).toContainText(['ID', 'Site', 'Priority', 'Status', 'Actions']);

  // 4. Click a row to navigate
  console.log('Clicking row WO-101...');
  await page.click('text=WO-101');

  // 5. Verify Form View
  console.log('Waiting for form view...');
  const form = page.locator('form.ax-form');
  await expect(form).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.canvas-title')).toContainText('Work Order WO-101');

  // 6. Test Action (Escalate)
  // Go back to the table or use the action in the form
  console.log('Testing escalate action in form...');
  await page.click('button:has-text("Escalate")');
  
  // Verify Journal update
  console.log('Opening journal...');
  await page.click('button:has-text("Journal")');
  const journalRow = page.locator('.ax-journal-kind', { hasText: 'action_triggered' });
  await expect(journalRow).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: 'workorder-complete-loop.png' });
  console.log('Test complete. Screenshot saved.');
});
