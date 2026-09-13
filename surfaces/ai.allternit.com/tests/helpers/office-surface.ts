import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Open the Allternit Office surface — the popped-out office window's
 *  content route. On the desktop the ACI rail tab opens this in an Electron
 *  window; in these (browser) specs we navigate straight to /office. */
export async function openOfficeSurface(page: Page): Promise<void> {
  await page.goto('/office');
  await expect(page.getByTestId('office-suite-section')).toBeVisible({ timeout: 30000 });
}
