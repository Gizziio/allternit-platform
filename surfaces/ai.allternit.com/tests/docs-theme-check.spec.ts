import { test, expect } from '@playwright/test';

test('docs editor uses platform light theme', async ({ page }) => {
  await page.goto('/docs/test');
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });

  const ribbonBg = await page.locator('.ribbon').evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });
  const bodyBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  // Platform light --bg-primary is #FDF8F3 -> rgb(253, 248, 243)
  expect(ribbonBg).toBe('rgb(253, 248, 243)');
  expect(bodyBg).toBe('rgb(253, 248, 243)');
  expect(htmlTheme).toBe('light');
});

test('docs editor uses platform dark theme', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('allternit-theme-storage-v2', JSON.stringify({ state: { theme: 'dark' }, version: 0 }));
  });
  await page.goto('/docs/test');
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });

  const ribbonBg = await page.locator('.ribbon').evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });
  const bodyBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  // Platform dark --bg-primary is #1A1612 -> rgb(26, 22, 18)
  expect(ribbonBg).toBe('rgb(26, 22, 18)');
  expect(bodyBg).toBe('rgb(26, 22, 18)');
  expect(htmlTheme).toBe('dark');
});
