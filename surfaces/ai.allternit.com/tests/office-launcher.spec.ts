import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';

test('/office launcher renders all four editor cards', async ({ page }) => {
  await page.goto('/office');
  await expect(page.getByTestId('office-launcher')).toBeVisible();
  await expect(page.getByTestId('office-card-docs')).toBeVisible();
  await expect(page.getByTestId('office-card-sheets')).toBeVisible();
  await expect(page.getByTestId('office-card-slides')).toBeVisible();
  await expect(page.getByTestId('office-card-pdf')).toBeVisible();
});

test('launcher Create new navigates to the editor route', async ({ page }) => {
  await page.goto('/office');
  await page.getByTestId('office-card-docs').getByRole('button', { name: 'Create new' }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
});

test('launcher open-file hands a .pdf off to the pdf viewer', async ({ page }) => {
  // The vendored pdf app's module graph is heavy on a cold dev server.
  test.setTimeout(180_000);
  await page.goto('/office');
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'hello.pdf',
    mimeType: 'application/pdf',
    buffer: makeHelloPdf(),
  });

  await expect(page).toHaveURL(/\/pdf$/, { timeout: 30000 });
  // The vendored PDF app shows the handed-off file's name and renders pages.
  await expect(page.locator('.app')).toBeVisible({ timeout: 90000 });
  await expect(page.getByText('hello.pdf')).toBeVisible({ timeout: 90000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 90000 });
});
