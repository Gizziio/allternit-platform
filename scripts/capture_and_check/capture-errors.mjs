#!/usr/bin/env node

/**
 * Standalone Console Error Capture Script
 * Uses playwright-core directly to capture console errors from A2R Platform UI
 * 
 * Usage: node capture-errors.mjs
 */

import { chromium } from './4-services/runtime/browser-runtime/node_modules/playwright-core/index.mjs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5177';

async function main() {
  console.log('='.repeat(60));
  console.log('A2R Platform - Console Error Capture');
  console.log('='.repeat(60));
  console.log('Target URL:', BASE_URL);
  console.log('');

  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Playwright Console Capture Bot'
  });

  const page = await context.newPage();

  const errors = [];
  const warnings = [];
  const allMessages = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    const location = msg.location();
    const timestamp = new Date().toISOString();

    allMessages.push({ timestamp, type, text, location });

    if (type === 'error') {
      errors.push({ timestamp, text, location, args: msg.args().map(a => a.toString()) });
      console.error(`[CONSOLE ERROR] ${text}`);
      if (location?.url) {
        const file = location.url.split('/').pop();
        console.error(`    at ${file}:${location.lineNumber}:${location.columnNumber}`);
      }
    } else if (type === 'warning') {
      warnings.push({ timestamp, text, location });
      console.warn(`[CONSOLE WARN] ${text}`);
    } else {
      // Log other messages at lower verbosity
      // console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });

  // Capture unhandled page errors
  page.on('pageerror', error => {
    errors.push({ 
      timestamp: new Date().toISOString(), 
      type: 'pageerror', 
      text: error.message, 
      stack: error.stack 
    });
    console.error(`[PAGE ERROR] ${error.message}`);
    console.error(error.stack?.split('\n').slice(0, 5).join('\n'));
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    const failure = request.failure();
    console.error(`[REQUEST FAILED] ${request.url()}`);
    console.error(`    Error: ${failure?.errorText}`);
    errors.push({
      timestamp: new Date().toISOString(),
      type: 'requestfailed',
      url: request.url(),
      error: failure?.errorText
    });
  });

  // Navigate to the application
  console.log('\n>>> Navigating to application...\n');
  const startTime = Date.now();
  
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
    const loadTime = Date.now() - startTime;
    console.log(`✓ Page loaded in ${loadTime}ms`);
  } catch (err) {
    console.error('✗ Failed to load page:', err.message);
  }

  // Wait for initial render
  console.log('\n>>> Waiting for page stabilization...\n');
  await page.waitForTimeout(3000);

  // Test navigation through rail items
  console.log('\n>>> Testing navigation rail items...\n');
  const railItems = ['home', 'chat', 'workspace', 'code', 'runner'];
  
  for (const item of railItems) {
    try {
      const selector = `[data-rail-item="${item}"]`;
      const element = page.locator(selector);
      const count = await element.count();

      if (count > 0) {
        console.log(`✓ Found rail item: ${item} (${count} occurrences)`);
        await element.first().click();
        await page.waitForTimeout(1500);
        
        // Check for any new errors after navigation
        console.log(`  Current error count: ${errors.length}`);
      } else {
        console.log(`✗ Rail item not found: ${item}`);
      }
    } catch (err) {
      console.error(`✗ Error interacting with ${item}:`, err.message);
    }
  }

  // Wait for async operations and lazy-loaded components
  console.log('\n>>> Waiting for async operations...\n');
  await page.waitForTimeout(3000);

  // Try scrolling to trigger lazy loading
  console.log('>>> Scrolling page to trigger lazy loading...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('ERROR REPORT');
  console.log('='.repeat(60));
  console.log(`Total console messages: ${allMessages.length}`);
  console.log(`Total ERRORS: ${errors.length}`);
  console.log(`Total WARNINGS: ${warnings.length}`);
  console.log('');

  if (errors.length > 0) {
    console.log('-'.repeat(60));
    console.log('ERRORS FOUND:');
    console.log('-'.repeat(60));
    
    errors.forEach((err, idx) => {
      console.log(`\n[${idx + 1}] ${err.type === 'pageerror' ? '[PAGE ERROR]' : err.type === 'requestfailed' ? '[REQUEST FAILED]' : '[CONSOLE ERROR]'}`);
      console.log(`    Time: ${err.timestamp}`);
      console.log(`    Message: ${err.text}`);
      
      if (err.type === 'requestfailed') {
        console.log(`    URL: ${err.url}`);
        console.log(`    Error: ${err.error}`);
      } else if (err.location?.url) {
        const urlParts = err.location.url.split('/');
        const file = urlParts.pop();
        console.log(`    Location: ${file}:${err.location.lineNumber}:${err.location.columnNumber}`);
      }
      
      if (err.stack) {
        const stackLines = err.stack.split('\n').slice(0, 4);
        console.log(`    Stack:`);
        stackLines.forEach(line => console.log(`      ${line}`));
      }
    });
  }

  if (warnings.length > 0 && process.env.VERBOSE === '1') {
    console.log('\n' + '-'.repeat(60));
    console.log('WARNINGS:');
    console.log('-'.repeat(60));
    
    warnings.forEach((warn, idx) => {
      console.log(`\n[${idx + 1}] ${warn.text}`);
    });
  }

  // Save detailed report to file
  const fs = await import('fs');
  const path = await import('path');
  const reportDir = path.join(process.cwd(), 'tests', 'e2e', 'test-results');
  const reportPath = path.join(reportDir, `console-errors-${Date.now()}.json`);
  
  await fs.promises.mkdir(reportDir, { recursive: true });
  await fs.promises.writeFile(reportPath, JSON.stringify({
    url: BASE_URL,
    capturedAt: new Date().toISOString(),
    summary: {
      totalMessages: allMessages.length,
      totalErrors: errors.length,
      totalWarnings: warnings.length
    },
    errors,
    warnings: process.env.VERBOSE === '1' ? warnings : undefined,
    allMessages: process.env.VERBOSE === '1' ? allMessages : undefined
  }, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`Detailed report saved to: ${reportPath}`);
  console.log('='.repeat(60));

  await browser.close();

  if (errors.length > 0) {
    console.log('\n❌ Console errors detected - see above for details\n');
    process.exit(1);
  } else {
    console.log('\n✅ No console errors found!\n');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
