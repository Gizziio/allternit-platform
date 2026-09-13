import { test, expect } from '@playwright/test';
import { makeHelloPdf } from './helpers/pdf';
import { openOfficeSurface } from './helpers/office-surface';

test('/office renders the Allternit Office window page', async ({ page }) => {
  await page.goto('/office');

  // The popped-out window's header carries the A://TERNIT OFFICE wordmark.
  await expect(page.getByTestId('office-wordmark')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('office-suite-section')).toBeVisible({ timeout: 30000 });
});

test('office surface renders all four editor cards', async ({ page }) => {
  await openOfficeSurface(page);

  await expect(page.getByTestId('office-card-docs')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('office-card-sheets')).toBeVisible();
  await expect(page.getByTestId('office-card-slides')).toBeVisible();
  await expect(page.getByTestId('office-card-pdf')).toBeVisible();

  // PDF is a viewer: its card offers to open a file instead of "Create new".
  await expect(page.getByTestId('office-card-pdf').getByRole('button', { name: 'Open a PDF' })).toBeVisible();
  await expect(page.getByTestId('office-card-pdf').getByRole('button', { name: 'Create new' })).toHaveCount(0);
});

test('office surface Create new opens the docs editor', async ({ page }) => {
  await openOfficeSurface(page);
  await page.getByTestId('office-card-docs').getByRole('button', { name: 'Create new' }).click();

  // Browser (no desktop bridge): the editor opens as its full-page route.
  // Desktop: openOffice routes it to an in-shell view in the main window.
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(/\/docs$/);
});

test('office surface open-file hands a .pdf off to the pdf viewer', async ({ page }) => {
  // The vendored pdf app's module graph is heavy on a cold dev server.
  test.setTimeout(180_000);
  await openOfficeSurface(page);
  await page.getByTestId('office-launcher-file-input').setInputFiles({
    name: 'hello.pdf',
    mimeType: 'application/pdf',
    buffer: makeHelloPdf(),
  });

  await expect(page.locator('.app')).toBeVisible({ timeout: 90000 });
  await expect(page.getByText('hello.pdf').first()).toBeVisible({ timeout: 90000 });
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 90000 });
});

test('office surface PDF card opens the file picker and hands off a .pdf', async ({ page }) => {
  // The vendored pdf app's module graph is heavy on a cold dev server.
  test.setTimeout(180_000);
  await openOfficeSurface(page);

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
