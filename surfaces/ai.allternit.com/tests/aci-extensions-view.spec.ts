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

test('footer rail shows Allternit Office above Design in every mode', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
  });
  await page.goto('/');

  // Home mode: both entries, office first.
  const office = page.getByTestId('rail-open-office');
  const design = page.getByTestId('rail-open-design');
  await expect(office).toBeVisible({ timeout: 45000 });
  await expect(design).toBeVisible();
  await expect(page.getByTestId('rail-office-wordmark')).toBeVisible();
  expect(await office.boundingBox().then((b) => b?.y ?? -1)).toBeLessThan(
    await design.boundingBox().then((b) => b?.y ?? Infinity),
  );

  // ACI mode: same pair, same order.
  await expect(async () => {
    await page.getByRole('button', { name: 'ACI', exact: true }).click();
    await expect(page.getByTestId('rail-open-office')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 45000 });
  await expect(design).toBeVisible();
  await expect(page.getByTestId('rail-office-wordmark')).toBeVisible();
  expect(await office.boundingBox().then((b) => b?.y ?? -1)).toBeLessThan(
    await design.boundingBox().then((b) => b?.y ?? Infinity),
  );
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
