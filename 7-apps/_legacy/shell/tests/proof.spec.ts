import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Shell UI Proof Tests', () => {
  test('window spawning - immediate screenshot', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Capture console
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${text}`);
    });

    page.on('pageerror', error => {
      console.error(`[BROWSER ERROR] ${error.message}`);
    });

    await page.waitForLoadState('networkidle');

    // Screenshot 1: Initial state
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/proof_01_initial.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: proof_01_initial.png');

    // Check for UI elements
    const tabStrip = page.locator('.workspace-tab-strip');
    const dockBar = page.locator('[style*="position: fixed"][style*="bottom"]');
    const launcher = page.locator('button:has-text("Browser")');

    console.log('[PROOF] TabStrip present:', await tabStrip.count() > 0);
    console.log('[PROOF] DockBar present:', await dockBar.count() > 0);
    console.log('[PROOF] Launcher present:', await launcher.count() > 0);

    // Click Browser button
    const browserButton = page.getByRole('button', { name: /browser/i });
    console.log('[PROOF] Clicking Browser button...');
    await browserButton.click();

    // Wait for click to process
    await page.waitForTimeout(100);

    // Wait for windows to appear and stabilize - check for rapid window creation
    await page.waitForTimeout(2000);

    // Immediately take screenshot - no wait
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/proof_02_after_browser_click.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: proof_02_after_browser_click.png');

    // Count windows
    const windows = page.locator('[style*="position: absolute"]');
    const windowCount = await windows.count();
    console.log('[PROOF] Windows found:', windowCount);

    // Screenshot 3: Window state
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/proof_03_window_visible.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: proof_03_window_visible.png');

    // Wait a bit to see if windows update
    await page.waitForTimeout(500);

    // Screenshot 4: After wait
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/proof_04_after_wait.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: proof_04_after_wait.png');

    console.log('[PROOF] Console messages collected:', consoleMessages);
  });
});
