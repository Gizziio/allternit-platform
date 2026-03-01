import { test, expect } from '@playwright/test';

test.describe('A2rchitech Shell E2E', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
    page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));
  });

  test('should load empty state and show frameworks', async ({ page }) => {
    // 1. Visit the shell
    await page.goto('http://localhost:5173');

    // Debugging: Log HTML
    // await page.waitForTimeout(1000);
    // console.log(await page.content());

    // 2. Verify Title
    await expect(page).toHaveTitle('A2rchitech Shell');

    // 3. Verify Empty State
    const emptyState = page.locator('.ax-empty-state');
    await expect(emptyState).toBeVisible({ timeout: 10000 });
    await expect(emptyState.locator('h2')).toHaveText('Ready to Create');

    // 4. Verify Frameworks List (PR #3)
    const frameworksHeader = page.locator('.ax-frameworks-list h3');
    await expect(frameworksHeader).toHaveText('Available Frameworks', { timeout: 10000 });
    
    // Check for specific frameworks
    const searchCard = page.locator('.ax-framework-id', { hasText: 'fwk_search' });
    await expect(searchCard).toBeVisible();
  });

  test('should dispatch intent and open capsule', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 1. Type command (PR #4)
    const input = page.locator('.ax-command-bar input');
    await input.fill('note buy milk');
    await input.press('Enter');

    // 2. Verify Tab Created (PR #1)
    // The default title generator uses framework_id + " Capsule"
    const tab = page.locator('.ax-tab', { hasText: 'fwk_note' });
    await expect(tab).toBeVisible({ timeout: 15000 }); 
    await expect(tab).toHaveClass(/ax-tab-active/);

    // 3. Verify Canvas (PR #2)
    const canvasTitle = page.locator('.canvas-title');
    await expect(canvasTitle).toHaveText('Notes');
  });

  test('should toggle journal and show events', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // 1. Open Journal (PR #2)
    const toggle = page.locator('.ax-journal-toggle');
    await toggle.click();

    const overlay = page.locator('.ax-journal-overlay');
    await expect(overlay).toHaveClass(/ax-journal-overlay-visible/);

    // 2. Dispatch a command to generate an event
    const input = page.locator('.ax-command-bar input');
    await input.fill('search cats');
    await input.press('Enter');

    // 3. Verify Journal Update
    const journalRow = page.locator('.ax-journal-kind', { hasText: 'intent' }).first();
    await expect(journalRow).toBeVisible({ timeout: 15000 });
  });
});