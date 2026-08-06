import { test, expect } from '@playwright/test';

test('/docs/:artifactId renders the real docs editor', async ({ page }) => {
  await page.goto('/docs/test-123');
  // The vendored ribbon + paginated document prove the full GenOffice UI mounted.
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.doc-page').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('.ProseMirror')).toBeVisible();
});
