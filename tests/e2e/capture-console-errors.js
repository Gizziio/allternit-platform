/**
 * Standalone script to capture console errors from the A2R Platform UI
 * Run this against your local server at http://127.0.0.1:5177
 */

import { chromium } from 'playwright-core';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

async function captureConsoleErrors() {
  console.log('Starting browser...');
  console.log(`Target URL: ${BASE_URL}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  
  const page = await context.newPage();
  
  // Collect all console messages
  const consoleMessages = [];
  const errors = [];
  
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const timestamp = new Date().toISOString();
    
    consoleMessages.push({
      timestamp,
      type,
      text,
      location: msg.location()
    });
    
    if (type === 'error') {
      errors.push({
        timestamp,
        text,
        location: msg.location()
      });
      console.error(`[CONSOLE ERROR] ${text}`);
    } else if (type === 'warning') {
      console.warn(`[CONSOLE WARN] ${text}`);
    } else {
      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });
  
  page.on('pageerror', error => {
    console.error(`[PAGE ERROR] ${error.message}`);
    console.error(error.stack);
    errors.push({
      timestamp: new Date().toISOString(),
      type: 'pageerror',
      text: error.message,
      stack: error.stack
    });
  });
  
  page.on('requestfailed', request => {
    console.error(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  console.log('\n=== Navigating to application ===\n');
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  
  console.log('\n=== Waiting for page to stabilize ===\n');
  await page.waitForTimeout(3000);
  
  // Try to interact with main navigation
  console.log('\n=== Testing navigation ===\n');
  
  // Look for rail items and click them
  const railItems = ['home', 'chat', 'workspace', 'code', 'runner'];
  
  for (const item of railItems) {
    try {
      const selector = `[data-rail-item="${item}"]`;
      const element = await page.$(selector);
      if (element) {
        console.log(`Clicking rail item: ${item}`);
        await element.click();
        await page.waitForTimeout(1000);
        
        // Capture any new errors
        await page.evaluate(() => {});
      } else {
        console.log(`Rail item not found: ${item}`);
      }
    } catch (err) {
      console.error(`Error clicking ${item}:`, err.message);
    }
  }
  
  // Wait a bit more for any async errors
  console.log('\n=== Waiting for async errors ===\n');
  await page.waitForTimeout(2000);
  
  // Generate summary
  console.log('\n========================================');
  console.log('CONSOLE ERROR SUMMARY');
  console.log('========================================');
  console.log(`Total console messages: ${consoleMessages.length}`);
  console.log(`Total errors: ${errors.length}`);
  console.log(`Total warnings: ${consoleMessages.filter(m => m.type === 'warning').length}`);
  
  if (errors.length > 0) {
    console.log('\n--- ERRORS ---');
    errors.forEach((err, idx) => {
      console.log(`\n[${idx + 1}] ${err.timestamp}`);
      console.log(`    Type: ${err.type || 'console'}`);
      console.log(`    Message: ${err.text}`);
      if (err.location?.url) {
        console.log(`    Location: ${err.location.url}:${err.location.lineNumber}:${err.location.columnNumber}`);
      }
      if (err.stack) {
        console.log(`    Stack: ${err.stack.split('\n').slice(0, 3).join('\n           ')}`);
      }
    });
  }
  
  // Save detailed log to file
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.join(process.cwd(), 'test-results', `console-log-${Date.now()}.json`);
  
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, JSON.stringify({
    url: BASE_URL,
    timestamp: new Date().toISOString(),
    totalMessages: consoleMessages.length,
    totalErrors: errors.length,
    errors,
    allMessages: consoleMessages
  }, null, 2));
  
  console.log(`\nDetailed log saved to: ${outputPath}`);
  
  await browser.close();
  
  // Exit with error code if there were errors
  if (errors.length > 0) {
    console.log('\n❌ Found console errors - check above for details');
    process.exit(1);
  } else {
    console.log('\n✅ No console errors found!');
    process.exit(0);
  }
}

captureConsoleErrors().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
