/**
 * Console Error Capture Test
 * Run: pnpm exec playwright test tests/e2e/console-capture.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

test.describe('Console Error Capture', () => {
  const consoleErrors: any[] = [];
  const pageErrors: any[] = [];
  const consoleWarnings: any[] = [];

  test.beforeEach(async ({ page }) => {
    // Clear previous errors
    consoleErrors.length = 0;
    pageErrors.length = 0;
    consoleWarnings.length = 0;

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
          args: msg.args()
        });
        console.error('[CONSOLE ERROR]', msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push({
          text: msg.text(),
          location: msg.location()
        });
        console.warn('[CONSOLE WARN]', msg.text());
      } else {
        console.log(`[${msg.type().toUpperCase()}]`, msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
      console.error('[PAGE ERROR]', error.message);
    });

    // Capture request failures
    page.on('requestfailed', request => {
      console.error('[REQUEST FAILED]', request.url(), request.failure()?.errorText);
    });
  });

  test('capture errors on initial load', async ({ page }) => {
    console.log('\n=== Navigating to', BASE_URL, '===\n');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    console.log('\n=== Initial Load Summary ===');
    console.log('Console errors:', consoleErrors.length);
    console.log('Page errors:', pageErrors.length);
    console.log('Console warnings:', consoleWarnings.length);
  });

  test('capture errors when navigating rail items', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    const railItems = ['home', 'chat', 'workspace', 'code', 'runner'];

    console.log('\n=== Testing navigation ===\n');
    for (const item of railItems) {
      try {
        const selector = `[data-rail-item="${item}"]`;
        const element = page.locator(selector);
        const count = await element.count();

        if (count > 0) {
          console.log(`Clicking rail item: ${item}`);
          await element.first().click();
          await page.waitForTimeout(1500);
        } else {
          console.log(`Rail item not found: ${item}`);
        }
      } catch (err: any) {
        console.error(`Error clicking ${item}:`, err.message);
      }
    }

    // Wait for async errors
    await page.waitForTimeout(2000);

    console.log('\n========================================');
    console.log('FINAL SUMMARY');
    console.log('========================================');
    console.log('Total console errors:', consoleErrors.length);
    console.log('Total page errors:', pageErrors.length);
    console.log('Total warnings:', consoleWarnings.length);

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.log('\n--- ALL ERRORS ---');
      
      consoleErrors.forEach((err, idx) => {
        console.log(`\n[CONSOLE ${idx + 1}]`, err.text);
        if (err.location?.url) {
          const urlParts = err.location.url.split('/');
          console.log(`    At: ${urlParts.pop()}:${err.location.lineNumber}`);
        }
      });

      pageErrors.forEach((err, idx) => {
        console.log(`\n[PAGE ${idx + 1}]`, err.message);
        if (err.stack) {
          const stackLines = err.stack.split('\n').slice(0, 3);
          console.log(`    Stack: ${stackLines.join('\n           ')}`);
        }
      });
    }

    if (consoleWarnings.length > 0) {
      console.log('\n--- WARNINGS ---');
      consoleWarnings.forEach((warn, idx) => {
        console.log(`\n[WARN ${idx + 1}]`, warn.text);
      });
    }
  });

  test('verify error count', async ({ page }) => {
    // This test will fail if there are errors - useful for CI
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Navigate to chat to trigger any lazy-loaded components
    const chatItem = page.locator('[data-rail-item="chat"]');
    if (await chatItem.count() > 0) {
      await chatItem.first().click();
      await page.waitForTimeout(2000);
    }

    // Assert no critical errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});
