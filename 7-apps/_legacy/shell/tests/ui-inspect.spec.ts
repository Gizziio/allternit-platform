import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test('inspect ui and debug connectivity', async ({ page }) => {
  // Capture console logs from the browser
  page.on('console', msg => console.log(`BROWSER LOG: [${msg.type()}] ${msg.text()}`));
  page.on('pageerror', err => console.log(`BROWSER ERROR: ${err.message}`));

  try {
    console.log('Navigating to http://127.0.0.1:5173...');
    await page.goto('http://127.0.0.1:5173', { timeout: 30000 });
    
    // Wait for the app to mount and fetch data
    await page.waitForTimeout(5000);

    // Check if the main shell container exists
    const shell = page.locator('.ax-shell');
    if (await shell.count() > 0) {
      console.log('SUCCESS: .ax-shell container found.');
    } else {
      console.log('FAILURE: .ax-shell container NOT found.');
    }

    // Check for the "Available Frameworks" section (PR #3)
    const frameworksList = page.locator('.ax-frameworks-list');
    if (await frameworksList.count() > 0) {
      console.log('SUCCESS: .ax-frameworks-list found.');
      const cards = page.locator('.ax-framework-card');
      console.log(`Number of framework cards: ${await cards.count()}`);
    } else {
      console.log('FAILURE: .ax-frameworks-list NOT found.');
    }

    // Take a screenshot to "see" the UI
    await page.screenshot({ path: 'ui-debug-screenshot.png', fullPage: true });
    console.log('Screenshot saved to ui-debug-screenshot.png');

    // Dump HTML content for deeper inspection
    const content = await page.content();
    fs.writeFileSync('ui-content-dump.html', content);
    console.log('HTML content dumped to ui-content-dump.html');

  } catch (error) {
    console.error('Test failed with error:', error.message);
    await page.screenshot({ path: 'ui-error-screenshot.png' });
  }
});
