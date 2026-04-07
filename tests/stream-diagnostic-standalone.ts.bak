/**
 * Stream Diagnostic - Standalone Script
 * 
 * Run directly with: bun tests/stream-diagnostic-standalone.ts
 * 
 * This script tests the terminal server streaming directly.
 */

import { chromium } from 'playwright';

const TERMINAL_SERVER = process.env.TERMINAL_SERVER || 'http://localhost:4096';
const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';

interface StreamEvent {
  type: string;
  timestamp: number;
  data?: any;
}

async function diagnoseStream() {
  console.log('🚀 Starting Stream Diagnostic...\n');
  console.log(`Target: ${TEST_URL}${CHAT_PATH}\n`);

  const browser = await chromium.launch({ 
    headless: false, // Keep headful for debugging
    args: ['--window-size=1280,800']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[rust-stream-adapter]') || 
        text.includes('[stream]') ||
        text.includes('📡') ||
        text.includes('📦') ||
        text.includes('⚠️') ||
        text.includes('❌') ||
        text.includes('✅')) {
      console.log(`[Browser] ${text}`);
    }
  });

  // Track network responses
  const streamEvents: StreamEvent[] = [];
  let streamStartTime = 0;
  const chunkTimings: number[] = [];
  let lastChunkTime = 0;

  await page.route('**/api/v1/session/*/message', async (route) => {
    console.log('📡 Intercepting stream request...');
    const response = await route.fetch();
    streamStartTime = Date.now();
    
    const headers = response.headers();
    console.log('📡 Response Headers:');
    console.log(`   Content-Type: ${headers['content-type']}`);
    console.log(`   Transfer-Encoding: ${headers['transfer-encoding'] || 'NOT SET'}`);
    console.log(`   Cache-Control: ${headers['cache-control']}`);
    console.log(`   X-Accel-Buffering: ${headers['x-accel-buffering'] || 'NOT SET'}`);

    const body = response.body()!;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const arrivalTime = Date.now();
        if (lastChunkTime > 0) {
          chunkTimings.push(arrivalTime - lastChunkTime);
        }
        lastChunkTime = arrivalTime;
        
        const chunkText = decoder.decode(value);
        console.log(`📦 Chunk: ${value.length} bytes at +${arrivalTime - streamStartTime}ms`);
        
        // Parse events
        const lines = chunkText.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            streamEvents.push({
              type: data.type || 'unknown',
              timestamp: arrivalTime - streamStartTime,
              data,
            });
          } catch (e) {
            // Skip malformed
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
    
    await route.fulfill({ response });
  });

  try {
    // Navigate
    console.log(`📍 Navigating to ${TEST_URL}${CHAT_PATH}...`);
    await page.goto(`${TEST_URL}${CHAT_PATH}`, { timeout: 30000, waitUntil: 'networkidle' });
    
    // Wait for input
    console.log('⏳ Waiting for chat input...');
    const input = page.locator('textarea, [data-testid="chat-input"], input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    
    // Inject diagnostic script
    await page.addInitScript(() => {
      (window as any).__diagnostic = {
        events: [],
        throttles: [],
        batches: [],
      };
      
      const origLog = console.log;
      console.log = function(...args: any[]) {
        const msg = args.join(' ');
        const now = performance.now();
        
        if (msg.includes('Processing event:')) {
          (window as any).__diagnostic.events.push({ time: now, type: 'process', msg });
        }
        if (msg.includes('throttling update by')) {
          (window as any).__diagnostic.throttles.push({ time: now, msg });
        }
        if (msg.includes('Events arriving <5ms apart')) {
          (window as any).__diagnostic.batches.push({ time: now, msg });
        }
        
        origLog.apply(console, args);
      };
    });

    // Reload to apply init script
    await page.reload();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    
    // Send test message
    console.log('⌨️  Sending test message...');
    await input.fill('Say hello in exactly 5 words');
    await page.waitForTimeout(500);
    await input.press('Enter');
    
    // Wait for stream
    console.log('⏳ Waiting for stream response (15s)...');
    await page.waitForTimeout(15000);
    
    // Collect diagnostics
    const pageDiagnostic = await page.evaluate(() => (window as any).__diagnostic);
    
    // Analysis
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║         STREAM DIAGNOSTIC RESULTS                      ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
    console.log(`📊 Network Events Captured: ${streamEvents.length}`);
    console.log(`📊 Page Events Captured: ${pageDiagnostic.events?.length || 0}`);
    
    if (chunkTimings.length > 0) {
      const avgGap = chunkTimings.reduce((a, b) => a + b, 0) / chunkTimings.length;
      const minGap = Math.min(...chunkTimings);
      const maxGap = Math.max(...chunkTimings);
      console.log(`\n📦 Chunk Timing:`);
      console.log(`   Count: ${chunkTimings.length}`);
      console.log(`   Avg gap: ${avgGap.toFixed(1)}ms`);
      console.log(`   Min gap: ${minGap}ms`);
      console.log(`   Max gap: ${maxGap}ms`);
    }
    
    console.log('\n📋 Event Timeline (first 15):');
    for (let i = 0; i < Math.min(15, streamEvents.length); i++) {
      const e = streamEvents[i];
      console.log(`   +${e.timestamp.toFixed(0)}ms: ${e.type}`);
    }
    
    console.log('\n📋 Event Type Distribution:');
    const typeCount = new Map<string, number>();
    for (const e of streamEvents) {
      typeCount.set(e.type, (typeCount.get(e.type) || 0) + 1);
    }
    for (const [type, count] of typeCount.entries()) {
      console.log(`   ${type}: ${count}`);
    }
    
    // Detect batching
    console.log('\n🔍 ANALYSIS:');
    
    const eventsIn100msWindows = new Map<number, number>();
    for (const e of streamEvents) {
      const window = Math.floor(e.timestamp / 100);
      eventsIn100msWindows.set(window, (eventsIn100msWindows.get(window) || 0) + 1);
    }
    
    let maxEventsInWindow = 0;
    for (const count of eventsIn100msWindows.values()) {
      maxEventsInWindow = Math.max(maxEventsInWindow, count);
    }
    
    if (maxEventsInWindow > 5) {
      console.log(`   ❌ SERVER BATCHING: ${maxEventsInWindow} events in 100ms window`);
      console.log('      → Server flush() not working or disabled');
    } else if (pageDiagnostic.batches?.length > 0) {
      console.log(`   ⚠️  CLIENT BATCHING: ${pageDiagnostic.batches.length} batch warnings`);
      console.log('      → Events arriving too fast from server');
    } else if (pageDiagnostic.throttles?.length > 0) {
      console.log(`   ⚠️  CLIENT THROTTLING: ${pageDiagnostic.throttles.length} throttled updates`);
      console.log('      → Intentional smoothing (16-32ms delay)');
    } else {
      console.log('   ✅ Stream timing appears normal');
    }
    
    // Check for large text deltas
    const textDeltas = streamEvents.filter(e => e.type === 'content_block_delta');
    let largeDeltas = 0;
    for (const e of textDeltas) {
      const deltaText = e.data?.delta?.text || '';
      if (deltaText.length > 20) {
        largeDeltas++;
      }
    }
    
    if (largeDeltas > 0) {
      console.log(`   ⚠️  LARGE DELTAS: ${largeDeltas} deltas with >20 chars`);
      console.log('      → Server may be accumulating before send');
    }
    
    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║                    END OF REPORT                       ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');
    
  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'stream-diagnostic-error.png' });
    console.log('📸 Screenshot saved to stream-diagnostic-error.png');
  } finally {
    await browser.close();
  }
}

// Run
diagnoseStream().catch(console.error);
