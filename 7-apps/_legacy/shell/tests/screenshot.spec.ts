import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Shell UI Screenshot Test', () => {
  test('capture shell UI screenshots', async ({ page }) => {
    await page.goto('http://localhost:5173');

    await page.waitForLoadState('networkidle');

    console.log('[PROOF] Console logs:');
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    // Wait for app to fully render
    await page.waitForTimeout(2000);

    // Screenshot 1: Initial state
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/shell_ui_initial.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: shell_ui_initial.png');

    // Click Browser button to spawn window
    const browserButton = page.getByRole('button', { name: /browser/i });
    await browserButton.click();

    // Wait for window to appear
    await page.waitForTimeout(1000);

    // Screenshot 2: Windowed browser
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/windowed_browser.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: windowed_browser.png');

    // Drag window (simulate)
    const windowFrame = page.locator('[style*="position: absolute"]').first();
    const box = await windowFrame.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + 20);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + 20);
      await page.mouse.up();
      await page.waitForTimeout(500);
    }

    // Screenshot 3: After drag
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/windowed_browser_dragged.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: windowed_browser_dragged.png');

    // Click minimize button
    const minimizeButton = page.getByTitle(/minimize/i);
    await minimizeButton.click();
    await page.waitForTimeout(1000);

    // Screenshot 4: After minimize (should be in dock)
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/minimized_to_dock.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: minimized_to_dock.png');

    // Click in dock to restore
    const dock = page.locator('[style*="position: fixed"][style*="bottom"]');
    const dockItem = dock.locator('text=Browser').first();
    await dockItem.click();
    await page.waitForTimeout(1000);

    // Screenshot 5: After restore
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/restored_from_dock.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: restored_from_dock.png');

    // Click Inspector button to spawn inspector window
    const inspectorButton = page.getByRole('button', { name: /inspector/i });
    await inspectorButton.click();
    await page.waitForTimeout(1000);

    // Screenshot 6: Multiple windows
    await page.screenshot({ path: path.join(process.cwd(), '../../docs/screens/multiple_windows.png'), fullPage: true });
    console.log('[PROOF] Screenshot saved: multiple_windows.png');
  });
});
