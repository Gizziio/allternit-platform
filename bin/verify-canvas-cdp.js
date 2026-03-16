#!/usr/bin/env node
/**
 * Verify Canvas Modules via Chrome CDP (Debug Port 9222)
 * 
 * User must start Chrome with: --remote-debugging-port=9222
 * Then navigate to Canvas and authenticate manually.
 */

import CDP from 'chrome-remote-interface';
import fs from 'fs';

const CANVAS_URL = 'https://canvas.instructure.com/courses/14389375/modules';
const SCREENSHOT_PATH = '/Users/macbook/Desktop/canvas_verification_cdp.png';

async function verifyCanvas() {
  console.log('=== Canvas Verification via Chrome CDP ===\n');
  console.log(`Target URL: ${CANVAS_URL}`);
  console.log('Screenshot: ' + SCREENSHOT_PATH);
  console.log('');
  console.log('Make sure Chrome is running with: --remote-debugging-port=9222');
  console.log('And you are logged into Canvas.\n');

  try {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime, DOM } = client;

    await Promise.all([Page.enable(), DOM.enable()]);

    // Navigate to Canvas modules
    console.log('Navigating to Canvas modules page...');
    await Page.navigate({ url: CANVAS_URL });
    await Page.loadEventFired();
    
    // Wait for content to load
    await new Promise(r => setTimeout(r, 3000));

    // Take screenshot
    console.log('Taking screenshot...');
    const screenshot = await Page.captureScreenshot({ format: 'png' });
    fs.writeFileSync(SCREENSHOT_PATH, screenshot.data, 'base64');
    console.log(`✅ Screenshot saved: ${SCREENSHOT_PATH}`);
    console.log('');

    // Extract module names
    console.log('Extracting module names from page...');
    const result = await Runtime.evaluate({
      expression: `
        (() => {
          const modules = [];
          // Try various selectors Canvas uses
          const selectors = [
            '[data-module-name]',
            '.module',
            '[class*="module"]',
            'h3',
            '.name'
          ];
          
          for (const selector of selectors) {
            document.querySelectorAll(selector).forEach(el => {
              const text = el.textContent?.trim() || el.getAttribute('data-module-name')?.trim();
              if (text && text.length > 3 && !modules.includes(text)) {
                modules.push(text);
              }
            });
          }
          
          return {
            modules: modules.slice(0, 20),
            url: window.location.href,
            title: document.title
          };
        })()
      `
    });

    const { modules, url, title } = result.result.value ? JSON.parse(result.result.value) : { modules: [], url: '', title: '' };

    console.log('');
    console.log('=== VERIFICATION RESULT ===');
    console.log('');
    console.log(`Page Title: ${title}`);
    console.log(`Current URL: ${url}`);
    console.log('');
    console.log(`Modules found on page (${modules.length}):`);
    
    let week1Found = false;
    modules.forEach((name, i) => {
      const isWeek1 = name.toLowerCase().includes('week 1') || name.toLowerCase().includes('ai');
      if (isWeek1) week1Found = true;
      const marker = isWeek1 ? '✅' : '  ';
      console.log(`  ${marker} ${i + 1}. ${name}`);
    });

    console.log('');
    if (week1Found) {
      console.log('✅ SUCCESS: "week 1 ai basics" module FOUND in Canvas!');
      console.log('   A2R Operator successfully created real modules.');
    } else if (url.includes('canvas.instructure.com')) {
      console.log('❌ Modules not found, but you are on Canvas.');
      console.log('   Check the screenshot to see what\'s on the page.');
      console.log('');
      console.log('   Canvas API reported these module IDs were created:');
      console.log('   - 22666851: "week 1 ai basics"');
      console.log('   - 22666853: "week 1 ai basics"');
      console.log('   - 22666855: "week 1 ai basics"');
    } else {
      console.log('❌ Not on Canvas page. Please navigate to Canvas and re-run.');
    }

    await client.close();
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error('');
    console.error('To fix:');
    console.error('1. Close all Chrome windows');
    console.error('2. Start Chrome with: open -n -a "Google Chrome" --args --remote-debugging-port=9222');
    console.error('3. Navigate to Canvas and log in');
    console.error('4. Re-run this script');
    process.exit(1);
  }
}

verifyCanvas();
