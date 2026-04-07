/**
 * Stream Diagnostic Test
 * 
 * This test diagnoses the "paste" issue by capturing:
 * 1. Network stream timing (when chunks arrive)
 * 2. Client-side parsing timing
 * 3. UI render timing
 * 
 * Run: pnpm playwright test stream-diagnostic.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

// Configuration
const TEST_URL = process.env.TEST_URL || 'http://localhost:3000';
const CHAT_PATH = process.env.CHAT_PATH || '/chat';
const EXPECTED_TEXT = "Hello! I'm A2R. How can I help you today?";

interface StreamEvent {
  type: string;
  timestamp: number;
  size: number;
  data?: any;
}

interface DiagnosticResult {
  events: StreamEvent[];
  chunkTimings: number[];
  renderTimings: number[];
  totalDuration: number;
  eventsPerSecond: number;
  averageChunkSize: number;
  batchingDetected: boolean;
  bufferingDetected: boolean;
}

test.describe('Stream Diagnostic', () => {
  let diagnosticResult: DiagnosticResult;

  test.beforeEach(async ({ page }) => {
    diagnosticResult = {
      events: [],
      chunkTimings: [],
      renderTimings: [],
      totalDuration: 0,
      eventsPerSecond: 0,
      averageChunkSize: 0,
      batchingDetected: false,
      bufferingDetected: false,
    };
  });

  test('analyze stream timing and detect paste cause', async ({ page }) => {
    // Set up network interception to capture stream data
    const streamEvents: StreamEvent[] = [];
    let streamStartTime = 0;
    let firstChunkTime = 0;
    let lastChunkTime = 0;
    let totalBytes = 0;
    const chunkSizes: number[] = [];
    const interChunkGaps: number[] = [];
    let lastChunkArrivalTime = 0;

    await page.route('**/session/*/message', async (route) => {
      const response = await route.fetch();
      streamStartTime = Date.now();
      
      const body = response.body()!;
      const headers = response.headers();
      
      console.log('📡 Stream Response Headers:', {
        'content-type': headers['content-type'],
        'transfer-encoding': headers['transfer-encoding'],
        'cache-control': headers['cache-control'],
        'x-accel-buffering': headers['x-accel-buffering'],
      });

      // Read the stream chunk by chunk
      const reader = body.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunkArrivalTime = Date.now();
          if (firstChunkTime === 0) {
            firstChunkTime = chunkArrivalTime;
          } else {
            interChunkGaps.push(chunkArrivalTime - lastChunkArrivalTime);
          }
          lastChunkArrivalTime = chunkArrivalTime;
          lastChunkTime = chunkArrivalTime;
          
          const chunkText = new TextDecoder().decode(value);
          chunkSizes.push(value.length);
          totalBytes += value.length;
          
          // Parse NDJSON lines
          const lines = chunkText.split('\n').filter(line => line.trim());
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              streamEvents.push({
                type: data.type || 'unknown',
                timestamp: chunkArrivalTime - streamStartTime,
                size: value.length,
                data,
              });
            } catch (e) {
              // Skip malformed JSON
            }
          }
          
          console.log(`📦 Chunk received: ${value.length} bytes at +${chunkArrivalTime - streamStartTime}ms`);
        }
      } finally {
        reader.releaseLock();
      }
      
      // Fulfill with original response
      await route.fulfill({ response });
    });

    // Inject page-side performance monitoring
    await page.addInitScript(() => {
      (window as any).__streamDiagnostic = {
        renderEvents: [],
        deltaEvents: [],
        lastRenderTime: 0,
      };
      
      // Monkey-patch console.log to capture specific messages
      const originalLog = console.log;
      console.log = function(...args: any[]) {
        const msg = args.join(' ');
        
        if (msg.includes('[rust-stream-adapter]')) {
          const now = performance.now();
          
          if (msg.includes('Processing event:')) {
            (window as any).__streamDiagnostic.deltaEvents.push({
              type: 'process',
              time: now,
              message: msg,
            });
          }
          
          if (msg.includes('throttling update by')) {
            (window as any).__streamDiagnostic.renderEvents.push({
              type: 'throttle',
              time: now,
              message: msg,
            });
          }
          
          if (msg.includes('Events arriving <5ms apart')) {
            (window as any).__streamDiagnostic.renderEvents.push({
              type: 'batching-warning',
              time: now,
              message: msg,
            });
          }
        }
        
        originalLog.apply(console, args);
      };
    });

    // Navigate to chat
    await page.goto(`${TEST_URL}${CHAT_PATH}`, { timeout: 30000 });
    
    // Wait for chat interface to load
    await page.waitForSelector('[data-testid="chat-input"], input[placeholder*="message"], textarea', { 
      timeout: 10000 
    });
    
    // Find and use the chat input
    const inputSelector = 'textarea, [data-testid="chat-input"], input[type="text"]';
    const input = page.locator(inputSelector).first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    
    // Send test message
    await input.fill('Say hello in exactly 5 words');
    await input.press('Enter');
    
    console.log('⌨️ Message sent, waiting for stream...');
    
    // Wait for response (with timeout)
    await page.waitForTimeout(15000);
    
    // Collect page-side diagnostics
    const pageDiagnostics = await page.evaluate(() => {
      return (window as any).__streamDiagnostic || { renderEvents: [], deltaEvents: [] };
    });
    
    // Calculate diagnostics
    diagnosticResult.events = streamEvents;
    diagnosticResult.totalDuration = lastChunkTime - firstChunkTime;
    diagnosticResult.chunkTimings = interChunkGaps;
    diagnosticResult.averageChunkSize = totalBytes / (chunkSizes.length || 1);
    diagnosticResult.eventsPerSecond = streamEvents.length / (diagnosticResult.totalDuration / 1000 || 1);
    
    // Detect batching: multiple events in same chunk
    const eventsByChunk = new Map<number, StreamEvent[]>();
    for (const event of streamEvents) {
      const chunkKey = Math.round(event.timestamp / 100); // Group by 100ms windows
      if (!eventsByChunk.has(chunkKey)) {
        eventsByChunk.set(chunkKey, []);
      }
      eventsByChunk.get(chunkKey)!.push(event);
    }
    
    for (const [chunk, events] of eventsByChunk.entries()) {
      if (events.length > 3) {
        diagnosticResult.batchingDetected = true;
        console.log(`⚠️ BATCHING DETECTED: ${events.length} events in 100ms window at ${chunk * 100}ms`);
        console.log('  Events:', events.map(e => e.type).join(', '));
      }
    }
    
    // Detect buffering: large gaps between chunks followed by burst
    const avgGap = interChunkGaps.reduce((a, b) => a + b, 0) / (interChunkGaps.length || 1);
    const largeGaps = interChunkGaps.filter(gap => gap > avgGap * 3);
    if (largeGaps.length > 0) {
      diagnosticResult.bufferingDetected = true;
      console.log(`⚠️ BUFFERING DETECTED: ${largeGaps.length} gaps >3x average (${avgGap.toFixed(0)}ms)`);
    }
    
    // Log results
    console.log('\n📊 === STREAM DIAGNOSTIC RESULTS ===\n');
    console.log(`📈 Total Events: ${streamEvents.length}`);
    console.log(`⏱️  Total Duration: ${diagnosticResult.totalDuration}ms`);
    console.log(`📊 Events/Second: ${diagnosticResult.eventsPerSecond.toFixed(1)}`);
    console.log(`📦 Average Chunk Size: ${diagnosticResult.averageChunkSize.toFixed(0)} bytes`);
    console.log(`🔢 Total Chunks: ${chunkSizes.length}`);
    console.log(`📏 Total Bytes: ${totalBytes}`);
    
    console.log('\n📋 Chunk Timing Analysis:');
    console.log(`  Min gap: ${Math.min(...interChunkGaps, 0)}ms`);
    console.log(`  Max gap: ${Math.max(...interChunkGaps, 0)}ms`);
    console.log(`  Avg gap: ${avgGap.toFixed(1)}ms`);
    
    console.log('\n📋 Event Type Distribution:');
    const eventTypes = new Map<string, number>();
    for (const event of streamEvents) {
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);
    }
    for (const [type, count] of eventTypes.entries()) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('\n📋 First 10 Events Timeline:');
    for (let i = 0; i < Math.min(10, streamEvents.length); i++) {
      const event = streamEvents[i];
      console.log(`  +${event.timestamp.toFixed(0)}ms: ${event.type} (${event.size} bytes)`);
    }
    
    console.log('\n📋 Page-Side Events:');
    console.log(`  Delta events: ${pageDiagnostics.deltaEvents?.length || 0}`);
    console.log(`  Render events: ${pageDiagnostics.renderEvents?.length || 0}`);
    
    if (pageDiagnostics.renderEvents?.length > 0) {
      console.log('\n  Render Timeline:');
      for (const event of pageDiagnostics.renderEvents.slice(0, 10)) {
        console.log(`    +${event.time.toFixed(0)}ms: ${event.type} - ${event.message.slice(0, 80)}`);
      }
    }
    
    console.log('\n🔍 DIAGNOSIS:');
    if (diagnosticResult.batchingDetected) {
      console.log('  ❌ SERVER BATCHING: Multiple events arriving in same chunk window');
      console.log('     → Check server flush() implementation');
    } else if (diagnosticResult.bufferingDetected) {
      console.log('  ❌ TRANSPORT BUFFERING: Irregular chunk arrival pattern');
      console.log('     → Check proxy/nginx/Vite dev server buffering');
    } else if (pageDiagnostics.renderEvents?.some((e: any) => e.type === 'throttle')) {
      console.log('  ⚠️ CLIENT THROTTLING: Updates being delayed for smooth rendering');
      console.log('     → This is intentional but can be reduced');
    } else {
      console.log('  ✅ Stream timing appears normal');
    }
    
    console.log('\n================================\n');
  });

  test('visual paste detection - character by character analysis', async ({ page }) => {
    const renderSnapshots: string[] = [];
    const renderTimes: number[] = [];
    let startTime = 0;

    // Navigate to chat
    await page.goto(`${TEST_URL}${CHAT_PATH}`, { timeout: 30000 });
    
    // Wait for chat interface
    await page.waitForSelector('textarea, [data-testid="chat-input"]', { timeout: 10000 });
    
    // Set up mutation observer to track text changes
    await page.addInitScript(() => {
      (window as any).__textMutations = [];
      
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            const target = mutation.target as HTMLElement;
            if (target.tagName === 'P' || target.tagName === 'DIV' || target.tagName === 'SPAN') {
              (window as any).__textMutations.push({
                time: performance.now(),
                text: target.textContent || '',
                length: (target.textContent || '').length,
              });
            }
          }
        }
      });
      
      // Start observing after page loads
      setTimeout(() => {
        const messageContainer = document.querySelector('[class*="message"], [class*="chat"]');
        if (messageContainer) {
          observer.observe(messageContainer, { 
            childList: true, 
            subtree: true, 
            characterData: true 
          });
        }
      }, 1000);
    });
    
    // Send message
    const input = page.locator('textarea').first();
    await input.fill('Count from 1 to 10, one number per line');
    await input.press('Enter');
    
    startTime = Date.now();
    
    // Poll for text length changes
    let lastLength = 0;
    const maxWait = 20000;
    const pollInterval = 50;
    
    while (Date.now() - startTime < maxWait) {
      const messageArea = page.locator('[class*="message"]:last-child, [class*="assistant"]:last-child').first();
      const text = await messageArea.textContent().catch(() => '');
      const currentLength = text?.length || 0;
      
      if (currentLength !== lastLength && currentLength > 0) {
        renderSnapshots.push(text || '');
        renderTimes.push(Date.now() - startTime);
        lastLength = currentLength;
      }
      
      await page.waitForTimeout(pollInterval);
    }
    
    // Analyze render pattern
    console.log('\n📊 === VISUAL RENDER ANALYSIS ===\n');
    console.log(`📝 Total render updates: ${renderSnapshots.length}`);
    
    if (renderSnapshots.length >= 2) {
      const deltas: number[] = [];
      for (let i = 1; i < renderSnapshots.length; i++) {
        const delta = renderSnapshots[i].length - renderSnapshots[i-1].length;
        deltas.push(delta);
      }
      
      const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      const maxDelta = Math.max(...deltas);
      
      console.log(`📈 Average chars per update: ${avgDelta.toFixed(1)}`);
      console.log(`📈 Max chars in single update: ${maxDelta}`);
      
      if (maxDelta > 20) {
        console.log('\n❌ PASTE DETECTED: Large text blocks appearing at once');
        console.log('   This indicates server-side batching or client-side buffering');
      } else if (avgDelta > 10) {
        console.log('\n⚠️ PARTIAL BATCHING: Moderate chunk sizes');
      } else {
        console.log('\n✅ CHARACTER-BY-CHARACTER: Smooth streaming detected');
      }
      
      console.log('\n📋 Render Timeline (first 10):');
      for (let i = 0; i < Math.min(10, renderSnapshots.length); i++) {
        const delta = i === 0 ? renderSnapshots[i].length : deltas[i-1];
        console.log(`  +${renderTimes[i].toFixed(0)}ms: ${renderSnapshots[i].length} chars (+${delta})`);
        console.log(`     "${renderSnapshots[i].slice(0, 50).replace(/\n/g, '\\n')}..."`);
      }
    }
    
    console.log('\n================================\n');
  });
});
