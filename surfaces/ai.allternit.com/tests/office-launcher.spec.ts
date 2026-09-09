import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';
import { openOfficeHub } from './helpers/office-hub';

test('/office redirects to the app home (standalone launcher retired)', async ({ page }) => {
  await page.goto('/office');
  await expect(page).toHaveURL(/\/$/, { timeout: 30000 });
});

test('hub renders all four editor cards', async ({ page }) => {
  await openOfficeHub(page);

  await expect(page.getByTestId('office-card-docs')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('office-card-sheets')).toBeVisible();
  await expect(page.getByTestId('office-card-slides')).toBeVisible();
  await expect(page.getByTestId('office-card-pdf')).toBeVisible();

  // PDF is a viewer: its card offers to open a file instead of "Create new".
  await expect(page.getByTestId('office-card-pdf').getByRole('button', { name: 'Open a PDF' })).toBeVisible();
  await expect(page.getByTestId('office-card-pdf').getByRole('button', { name: 'Create new' })).toHaveCount(0);
});

test('hub Create new opens the editor as an in-shell view', async ({ page }) => {
  await openOfficeHub(page);
  await page.getByTestId('office-card-docs').getByRole('button', { name: 'Create new' }).click();

  // In-shell: the editor mounts inside the shell without route navigation.
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
  await expect(page).not.toHaveURL(/\/docs$/);
});

test('hub open-file hands a .pdf off to the pdf viewer', async ({ page }) => {
  // The vendored pdf app's module graph is heavy on a cold dev server.
  test.setTimeout(180_000);
  await openOfficeHub(page);
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'hello.pdf',
    mimeType: 'application/pdf',
    buffer: makeHelloPdf(),
  });

  // In-shell: the handed-off file renders in the pdf viewer without navigation.
  await expect(page.locator('.app')).toBeVisible({ timeout: 90000 });
  await expect(page.getByText('hello.pdf').first()).toBeVisible({ timeout: 90000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 90000 });
});

test('hub PDF card opens the file picker and hands off a .pdf', async ({ page }) => {
  // The vendored pdf app's module graph is heavy on a cold dev server.
  test.setTimeout(180_000);
  await openOfficeHub(page);

  // Clicking the PDF card's "Open a PDF" button triggers the hidden file input.
  await page.getByTestId('office-card-pdf').getByRole('button', { name: 'Open a PDF' }).click();
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'hello.pdf',
    mimeType: 'application/pdf',
    buffer: makeHelloPdf(),
  });

  await expect(page.locator('.app')).toBeVisible({ timeout: 90000 });
  await expect(page.getByText('hello.pdf').first()).toBeVisible({ timeout: 90000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 90000 });
});
