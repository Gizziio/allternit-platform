#!/usr/bin/env node
/**
 * Allternit Chrome Bridge - Connect Allternit Platform to Real Chrome
 * 
 * This script connects the Allternit platform to a real Chrome browser
 * via CDP (Chrome DevTools Protocol) for extension downloads and
 * Chrome Web Store access.
 * 
 * Usage: node chrome-bridge.js
 */

import { chromium } from 'playwright';

const CDP_URL = process.env.Allternit_CHROME_CDP_URL || 'http://127.0.0.1:9222';
const PLATFORM_PORT = process.env.Allternit_CHROME_PLATFORM_PORT || 9223;

let browser = null;
let context = null;
let page = null;

async function startChromeBridge() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           Allternit Chrome Bridge                                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to existing Chrome via CDP
    console.log(`🔌 Connecting to Chrome CDP: ${CDP_URL}`);
    browser = await chromium.connectOverCDP(CDP_URL);
    console.log('✓ Connected to Chrome\n');

    // Get or create context
    context = browser.contexts()[0];
    if (!context) {
      context = await browser.newContext();
    }

    // Get or create page
    page = context.pages()[0];
    if (!page) {
      page = await context.newPage();
    }

    // Get Chrome version info
    const version = await browser.version();
    console.log(`📦 Chrome Version: ${version}\n`);

    // Create simple HTTP server for platform integration
    const http = await import('http');
    
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PLATFORM_PORT}`);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      try {
        // Health check
        if (url.pathname === '/health') {
          res.writeHead(200);
          res.end(JSON.stringify({
            status: 'connected',
            chrome: version,
            cdpUrl: CDP_URL,
          }));
          return;
        }

        // Navigate to URL
        if (url.pathname === '/navigate' && url.searchParams.has('url')) {
          const targetUrl = url.searchParams.get('url');
          console.log(`🌐 Navigating to: ${targetUrl}`);
          await page.goto(targetUrl, { waitUntil: 'networkidle' });
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            url: page.url(),
            title: await page.title(),
          }));
          return;
        }

        // Get current page info
        if (url.pathname === '/page') {
          res.writeHead(200);
          res.end(JSON.stringify({
            url: page.url(),
            title: await page.title(),
            cookies: await context.cookies(),
          }));
          return;
        }

        // Take screenshot
        if (url.pathname === '/screenshot') {
          const screenshot = await page.screenshot({ type: 'png', encoding: 'base64' });
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            screenshot: screenshot,
          }));
          return;
        }

        // Execute JavaScript
        if (url.pathname === '/evaluate' && url.searchParams.has('code')) {
          const code = url.searchParams.get('code');
          const result = await page.evaluate(code);
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            result,
          }));
          return;
        }

        // Click element
        if (url.pathname === '/click' && url.searchParams.has('selector')) {
          const selector = url.searchParams.get('selector');
          await page.click(selector);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Type text
        if (url.pathname === '/type' && url.searchParams.has('selector') && url.searchParams.has('text')) {
          const selector = url.searchParams.get('selector');
          const text = url.searchParams.get('text');
          await page.fill(selector, text);
          res.writeHead(200);
          res.end(JSON.stringify({ success: true }));
          return;
        }

        // Open Chrome Web Store for extension download
        if (url.pathname === '/open-extension-store') {
          const extensionId = url.searchParams.get('id') || 'fcoeoabgfenejglbffodgkkbkcdhcgfn'; // Claude Desktop
          const storeUrl = `https://chromewebstore.google.com/detail/${extensionId}`;
          console.log(`🛒 Opening Chrome Web Store: ${storeUrl}`);
          await page.goto(storeUrl, { waitUntil: 'networkidle' });
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            url: page.url(),
            title: await page.title(),
          }));
          return;
        }

        // 404
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));

      } catch (error) {
        console.error('❌ Error:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    await new Promise((resolve) => server.listen(PLATFORM_PORT, resolve));
    console.log(`🚀 Chrome Bridge Server: http://localhost:${PLATFORM_PORT}`);
    console.log('\n📡 Available Endpoints:');
    console.log('   GET /health              - Check connection status');
    console.log('   GET /navigate?url=...    - Navigate to URL');
    console.log('   GET /page                - Get current page info');
    console.log('   GET /screenshot          - Take screenshot');
    console.log('   GET /evaluate?code=...   - Execute JavaScript');
    console.log('   GET /click?selector=...  - Click element');
    console.log('   GET /type?selector=...   - Type text');
    console.log('   GET /open-extension-store?id=... - Open Chrome Web Store');
    console.log('\n════════════════════════════════════════════════════════════');
    console.log('Chrome Bridge is ready for Allternit platform integration');
    console.log('════════════════════════════════════════════════════════════\n');

    // Handle cleanup
    process.on('SIGINT', async () => {
      console.log('\n🧹 Shutting down...');
      if (browser) await browser.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start Chrome Bridge:', error.message);
    console.log('\nMake sure Chrome is running with CDP enabled:');
    console.log('  ./start-chrome.sh');
    process.exit(1);
  }
}

startChromeBridge();
