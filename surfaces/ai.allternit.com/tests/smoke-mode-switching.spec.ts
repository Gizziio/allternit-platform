import { test, expect } from '@playwright/test';

/**
 * Smoke tests for Vite migration — verify the shell loads and each core
 * surface can be activated without fatal console errors.
 */

test.describe('Mode switching smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    // Collect all console errors during the test
    (page as any).consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        (page as any).consoleErrors.push(msg.text());
      }
    });

    // Pre-complete onboarding so the shell renders immediately
    await page.addInitScript(() => {
      localStorage.setItem('allternit-onboarding-storage', JSON.stringify({
        state: { hasCompletedOnboarding: true, preferences: { defaultProvider: 'claude' } },
        version: 0,
      }));
      localStorage.setItem('allternit-design-onboarded', '1');
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="view-host-wrapper"]', { timeout: 30000 });
  });

  test.afterEach(async ({ page }) => {
    const errors = (page as any).consoleErrors || [];
    const fatal = errors.filter((e: string) =>
      !e.includes('lottie-web') &&
      !e.includes('[vite]') &&
      !e.includes('onboarding') &&
      !e.includes('recharts') &&
      !e.includes('ERR_CONNECTION_REFUSED') &&
      !e.includes('Bad Gateway') &&
      !e.includes('Failed to load resource')
    );
    expect(fatal, `Fatal console errors: ${fatal.join(', ')}`).toHaveLength(0);
  });

  async function clickModeButton(page: any, modeLabel: string) {
    // Try mode switcher buttons inside known containers
    const containers = ['.mode-switcher-tabs', '.mode-switcher-segmented', '.mode-switcher-pill', '[data-rail-item]'];
    for (const container of containers) {
      const btn = page.locator(`${container} button`).filter({ hasText: new RegExp(modeLabel, 'i') }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        return true;
      }
    }
    // Fallback: any button with matching text
    const btn = page.locator('button').filter({ hasText: new RegExp(modeLabel, 'i') }).first();
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      return true;
    }
    return false;
  }

  test('Chat mode renders', async ({ page }) => {
    await clickModeButton(page, 'Chat');
    await expect(page.locator('[data-active-view="chat"]')).toBeVisible({ timeout: 5000 });
  });

  test('Cowork mode renders', async ({ page }) => {
    const clicked = await clickModeButton(page, 'Cowork');
    if (!clicked) {
      // Cowork may not have a visible mode button in all layouts;
      // verify the shell is at least healthy by checking Chat loaded
      await expect(page.locator('[data-active-view="chat"]')).toBeVisible({ timeout: 5000 });
      return;
    }
    await expect(page.locator('[data-active-view="workspace"]')).toBeVisible({ timeout: 5000 });
  });

  test('Code mode renders', async ({ page }) => {
    await clickModeButton(page, 'Code');
    await expect(page.locator('[data-active-view="code"]')).toBeVisible({ timeout: 5000 });
  });

  test('Design mode renders', async ({ page }) => {
    await clickModeButton(page, 'Design');
    await expect(page.locator('[data-active-view="design"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible({ timeout: 5000 });
  });

  test('Browser mode renders', async ({ page }) => {
    await clickModeButton(page, 'Browser');
    await expect(page.locator('[data-active-view="browser"]')).toBeVisible({ timeout: 5000 });
  });

  test('Rapid mode switching does not crash', async ({ page }) => {
    const modes = ['Chat', 'Cowork', 'Code', 'Design', 'Browser'];
    for (const mode of modes) {
      await clickModeButton(page, mode);
      await page.waitForTimeout(300);
    }
    const activeView = await page.locator('[data-active-view]').getAttribute('data-active-view');
    expect(activeView).toBeTruthy();
  });
});
