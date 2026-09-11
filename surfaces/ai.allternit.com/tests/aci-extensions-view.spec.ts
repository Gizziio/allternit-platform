import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Switch the shell to ACI mode and open the ACI Extensions view.
 *  Seeds the platform-mode key so the onboarding portal (a fullscreen overlay
 *  that intercepts all clicks) stays dismissed, then retries the mode switch:
 *  on a cold dev server the first click can land before hydration. */
async function openAciExtensions(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });
  await page.goto('/');
  await expect(async () => {
    await page.getByRole('button', { name: 'ACI', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ACI Extensions' })).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45000 });
  await page.getByRole('button', { name: 'ACI Extensions' }).click();
}

test('ACI Extensions shell view shows only the extensions manager', async ({ page }) => {
  await openAciExtensions(page);

  await expect(page.getByRole('heading', { name: 'ACI Extensions' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Extensions', exact: true })).toBeVisible();

  // The Allternit Office suite moved to its own window — no office cards here.
  await expect(page.getByTestId('office-suite-block')).toHaveCount(0);
  await expect(page.getByTestId('office-card-docs')).toHaveCount(0);
});

test('ACI mode footer swaps the Design button for Allternit Office', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });
  await page.goto('/');

  // Home mode keeps the Design footer button.
  await expect(page.getByRole('button', { name: 'Design' })).toBeVisible({ timeout: 45000 });
  await expect(page.getByTestId('rail-open-office')).toHaveCount(0);

  // ACI mode replaces it with the Allternit Office entry (wordmark + label).
  await expect(async () => {
    await page.getByRole('button', { name: 'ACI', exact: true }).click();
    await expect(page.getByTestId('rail-open-office')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45000 });
  await expect(page.getByTestId('rail-office-wordmark')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Design' })).toHaveCount(0);
});

test('ACI Allternit Office entry opens the office surface', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });
  await page.goto('/');
  await expect(async () => {
    await page.getByRole('button', { name: 'ACI', exact: true }).click();
    await expect(page.getByTestId('rail-open-office')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45000 });

  // Desktop: a new Electron window; browser: a popup tab. Both load /office.
  const popupPromise = page.waitForEvent('popup');
  await page.getByTestId('rail-open-office').click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup.getByTestId('office-wordmark')).toBeVisible({ timeout: 30000 });
  await expect(popup.getByTestId('office-card-docs')).toBeVisible({ timeout: 30000 });
});

test('design mode no longer embeds a Documents launcher tab', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
    window.localStorage.setItem('allternit-design-onboarded', '1');
  });

  const completeAgentChat = async (route: import('@playwright/test').Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: [DONE]\n\n',
    });
  };
  await page.route('**/api/agent-chat', completeAgentChat);
  await page.route('**/api/v1/agent-chat', completeAgentChat);

  // Design Studio runs as its own route/window (openDesignWindow → /design).
  await page.goto('/design');

  // Start a project (the tab bar only exists inside one).
  await page.locator('.ad-composer textarea').fill('Test office project');
  await page.getByLabel('Create project').click();

  // The launcher embed was retired: no Documents tab, no office cards.
  await expect(page.getByRole('button', { name: 'Documents', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('office-card-docs')).toHaveCount(0);
});
