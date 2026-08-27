import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Switch the shell to ACI mode and open the Office & Extensions view.
 *  Seeds the platform-mode key so the onboarding portal (a fullscreen overlay
 *  that intercepts all clicks) stays dismissed, then retries the mode switch:
 *  on a cold dev server the first click can land before hydration. */
async function openOfficeExtensions(page: Page) {
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

test('Office & Extensions shell view shows the Allternit Office suite', async ({ page }) => {
  await openOfficeExtensions(page);

  const suite = page.getByTestId('office-suite-block');
  await expect(suite).toBeVisible({ timeout: 15000 });
  await expect(suite.getByTestId('office-card-docs')).toBeVisible();
  await expect(suite.getByTestId('office-card-sheets')).toBeVisible();
  await expect(suite.getByTestId('office-card-slides')).toBeVisible();
  await expect(suite.getByTestId('office-card-pdf')).toBeVisible();
  await expect(suite.getByText('Allternit Docs')).toBeVisible();
  await expect(suite.getByText('Allternit Sheets')).toBeVisible();
  await expect(suite.getByText('Allternit Slides')).toBeVisible();
  await expect(suite.getByText('Allternit PDF')).toBeVisible();

  // Extensions content still lives on the same page, below the suite.
  await expect(page.getByText('Browser Extensions')).toBeVisible();
});

test('Office & Extensions opens an editor as an in-shell view', async ({ page }) => {
  // The vendored sheets app's module graph is heavy on a cold dev server.
  test.setTimeout(180_000);
  await openOfficeExtensions(page);

  await page
    .getByTestId('office-card-sheets')
    .getByRole('button', { name: 'Create new' })
    .click();

  // The sheets editor opens inside the shell (no navigation to /sheets).
  await expect(page.locator('.app-shell')).toBeVisible({ timeout: 90000 });
  await expect(page).not.toHaveURL(/\/sheets$/);
});

test('design mode Documents tab shows the same Allternit Office suite', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-platform-mode', 'chat');
    window.localStorage.setItem('allternit-design-onboarded', '1');
  });

  // Starting a project fires the opener agent-chat stream. The test env has
  // no model backend; if a local gateway happens to be listening it accepts
  // the stream and never finishes, leaving the "Manifesting high-fidelity
  // UI…" streaming overlay (position: absolute, zIndex 10 over the whole tab
  // area) up forever, where it intercepts the Create-new click. Complete the
  // stream deterministically instead. (The client posts to /api/agent-chat
  // same-origin, or <gateway>/api/v1/agent-chat when a gateway origin is
  // configured — cover both.)
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

  // Start a project (the tab bar only exists inside one; setActiveProject
  // fires before any backend call, so this works offline).
  await page.locator('.ad-composer textarea').fill('Test office project');
  await page.getByLabel('Create project').click();
  await page.getByRole('button', { name: 'Documents', exact: true }).click();

  // Same suite, same cards as the Office & Extensions shell view.
  const launcher = page.getByTestId('office-launcher');
  await expect(launcher).toBeVisible({ timeout: 30000 });
  await expect(launcher.getByTestId('office-card-docs')).toBeVisible();
  await expect(launcher.getByTestId('office-card-sheets')).toBeVisible();
  await expect(launcher.getByTestId('office-card-slides')).toBeVisible();
  await expect(launcher.getByTestId('office-card-pdf')).toBeVisible();

  // Standalone route: no shell openView, so Create new navigates to the editor route.
  await launcher.getByTestId('office-card-docs').getByRole('button', { name: 'Create new' }).click();
  await expect(page).toHaveURL(/\/docs$/, { timeout: 15000 });
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
});
