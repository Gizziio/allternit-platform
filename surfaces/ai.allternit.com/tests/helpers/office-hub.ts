import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Switch the shell to ACI mode and open the Office & Extensions hub — the
 *  single office surface since the standalone /office launcher was retired.
 *  Seeds the platform-mode key so the onboarding portal (a fullscreen overlay
 *  that intercepts all clicks) stays dismissed, then retries the mode switch:
 *  on a cold dev server the first click can land before hydration. */
export async function openOfficeHub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });
  await page.goto('/');
  await expect(async () => {
    await page.getByRole('button', { name: 'ACI', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Office & Extensions' })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45000 });
  await page.getByRole('button', { name: 'Office & Extensions' }).click();
}
