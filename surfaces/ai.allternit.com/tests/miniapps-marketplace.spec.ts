/**
 * Marketplace end-to-end flows (Discover → detail → permissions → install
 * approval → OAuth panel). NOT RUN in the current workspace: these require a
 * running dev server and, for desktop bridges, the Electron shell. They are
 * committed as the executable specification for the authorized test pass.
 *
 * Run (once authorized): npx playwright test tests/miniapps-marketplace.spec.ts
 */
import { expect, test } from '@playwright/test';

test.describe('miniapps marketplace', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('discover view lists catalog entries with source badges', async ({ page }) => {
    // The mini-apps store is a rail item in the browser surface.
    await page.getByText(/mini-?apps/i).first().click();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
    // Catalog entries render as cards with a source badge.
    await expect(page.getByText(/allternit verified|mcp registry|community/i).first()).toBeVisible();
  });

  test('search and category filtering narrow the catalog', async ({ page }) => {
    await page.getByText(/mini-?apps/i).first().click();
    const search = page.getByPlaceholder(/search/i);
    await search.fill('n8n');
    await expect(page.getByText('n8n').first()).toBeVisible();
    await expect(page.getByText('LobeChat')).toHaveCount(0);
  });

  test('detail view shows permissions in plain language', async ({ page }) => {
    await page.getByText(/mini-?apps/i).first().click();
    await page.getByText('n8n').first().click();
    // Permission explanations render for network/filesystem/processes.
    await expect(page.getByText(/network access|connects to/i).first()).toBeVisible();
  });

  test('command-based community apps require approval before running', async ({ page }) => {
    await page.getByText(/mini-?apps/i).first().click();
    await page.getByText('n8n').first().click();
    // Without a desktop approval the runtime cannot start; the approval CTA is shown.
    await expect(page.getByRole('button', { name: /review|approve/i }).first()).toBeVisible();
  });

  test('a killed marketplace listing disappears from discover', async ({ page }) => {
    // Requires a registry with the kill switch enabled for one listing (set up
    // out-of-band via POST /v1/admin/kill-switches). The listing must not appear.
    await page.getByText(/mini-?apps/i).first().click();
    await expect(page.getByText('killed-fixture-app')).toHaveCount(0);
  });
});
