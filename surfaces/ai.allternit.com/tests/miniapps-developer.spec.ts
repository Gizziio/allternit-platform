/**
 * Developer submission end-to-end flows (create → lint → sign → submit →
 * track). NOT RUN in the current workspace: requires a running dev server and
 * a reachable registry (window.__ALLTERNIT_MINIAPP_REGISTRY_URL__).
 * Committed as the executable specification for the authorized test pass.
 *
 * Run (once authorized): npx playwright test tests/miniapps-developer.spec.ts
 */
import { expect, test } from '@playwright/test';

test.describe('developer submission workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText(/mini-?apps/i).first().click();
  });

  test('create a local miniapp and open the publish dialog', async ({ page }) => {
    await page.getByRole('button', { name: /add|create/i }).first().click();
    // Create flow collects name/category/presentation.
    await page.getByLabel(/name/i).fill('E2E Test App');
    await page.getByRole('button', { name: /create|save/i }).click();
    await page.getByText('E2E Test App').first().click();
    await page.getByRole('button', { name: /publish/i }).click();
    await expect(page.getByText(/publisher token/i)).toBeVisible();
  });

  test('lint blocks submission while errors remain', async ({ page }) => {
    await page.getByText('E2E Test App').first().click();
    await page.getByRole('button', { name: /publish/i }).click();
    // A fresh app has lint findings (version/changelog/etc.); the submit
    // button stays disabled while severity=error findings exist.
    const submit = page.getByRole('button', { name: /submit/i });
    await expect(submit).toBeDisabled();
  });

  test('manifest lint surfaces actionable fixes', async ({ page }) => {
    await page.getByText('E2E Test App').first().click();
    await page.getByRole('button', { name: /publish/i }).click();
    await expect(page.getByText(/version/i).first()).toBeVisible();
    await expect(page.getByText(/set "version" to a semver/i)).toBeVisible();
  });

  test('signing key generation produces a verifiable signature', async ({ page }) => {
    await page.getByText('E2E Test App').first().click();
    await page.getByRole('button', { name: /publish/i }).click();
    await page.getByRole('button', { name: /generate/i }).click();
    // A backup download is offered and the fingerprint is shown.
    await expect(page.getByText(/fingerprint/i)).toBeVisible();
    await page.getByRole('button', { name: /sign/i }).click();
    await expect(page.getByText(/signature verified/i)).toBeVisible();
  });

  test('submission reaches the registry and tracks pipeline status', async ({ page }) => {
    await page.getByText('E2E Test App').first().click();
    await page.getByRole('button', { name: /publish/i }).click();
    await page.getByLabel(/publisher token/i).fill(process.env.E2E_PUBLISHER_TOKEN ?? 'e2e-token');
    // After lint passes and the manifest is signed, submit and watch stages.
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText(/schema_validation/i)).toBeVisible({ timeout: 15_000 });
  });
});
