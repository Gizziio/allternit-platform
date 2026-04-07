/**
 * Browser Test - Chat Streaming
 * Tests actual streaming behavior in the browser UI
 */

import { chromium } from 'playwright';
import { join } from 'path';

async function testChatStreaming() {
  console.log('🧪 Starting Browser Chat Streaming Test\n');
  
  const browser = await chromium.launch({ 
    headless: true, // Use headless for faster tests
    args: ['--window-size=1280,800', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  
  // Enable console logging
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[rust-stream-adapter]') || 
        text.includes('Processing event') ||
        text.includes('throttle') ||
        text.includes('delta')) {
      console.log(`[Browser] ${text}`);
    }
  });

  try {
    // Navigate to chat with cache busting
    console.log('📍 Navigating to chat...');
    await page.goto('http://localhost:5177/?nocache=' + Date.now(), { timeout: 30000 });
    
    // Force reload to ensure fresh code
    await page.reload({ waitUntil: 'networkidle' });
    
    // Wait for chat input
    console.log('⏳ Waiting for chat interface...');
    await page.waitForSelector('textarea, [data-testid="chat-input"], input[placeholder*="message"]', { 
      timeout: 15000 
    });
    
    const input = page.locator('textarea').first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    
    // Clear and send message
    console.log('⌨️  Sending message...');
    await input.fill('');
    await input.fill('Say hello in exactly 5 words');
    await page.waitForTimeout(500);
    await input.press('Enter');
    
    console.log('⏳ Waiting for response (8s)...');
    
    // Monitor the message area for updates
    const startTime = Date.now();
    let lastText = '';
    let updateCount = 0;
    const updates: { time: number; text: string; length: number }[] = [];
    
    while (Date.now() - startTime < 8000) {
      // Try to find the assistant message - check multiple possible selectors
      const selectors = [
        '[class*="assistant-message"]',
        '[class*="message-group"]', 
        '[class*="chat-message"]',
        '.assistant-message-group',
        '[data-testid="message"]',
      ];
      
      let text = '';
      for (const selector of selectors) {
        const messageArea = page.locator(selector).last();
        text = await messageArea.textContent().catch(() => '');
        if (text && text.length > 0) break;
      }
      
      // Fallback: try to find any text in the chat container
      if (!text) {
        const chatContainer = page.locator('[class*="chat"]').last();
        text = await chatContainer.textContent().catch(() => '');
      }
      
      if (text && text !== lastText) {
        const elapsed = Date.now() - startTime;
        updates.push({
          time: elapsed,
          text: text.slice(0, 100),
          length: text.length,
        });
        console.log(`📝 [+${elapsed}ms] ${text.length} chars: "${text.slice(0, 60).replace(/\n/g, '\\n')}..."`);
        lastText = text;
        updateCount++;
      }
      
      await page.waitForTimeout(100);
    }
    
    console.log('\n📊 RESULTS:');
    console.log(`   Total updates: ${updateCount}`);
    console.log(`   Final text length: ${lastText.length} chars`);
    
    if (updates.length > 0) {
      console.log('\n📋 Update Timeline:');
      for (const update of updates.slice(0, 15)) {
        console.log(`   +${update.time}ms: ${update.length} chars`);
      }
      
      // Check for paste behavior (large jumps in text length)
      let pasteDetected = false;
      for (let i = 1; i < updates.length; i++) {
        const delta = updates[i].length - updates[i-1].length;
        if (delta > 20) {
          console.log(`   ⚠️  PASTE at +${updates[i].time}ms: +${delta} chars at once`);
          pasteDetected = true;
        }
      }
      
      if (!pasteDetected && updates.length > 3) {
        console.log('   ✅ Smooth streaming detected!');
      } else if (pasteDetected) {
        console.log('   ❌ PASTE BEHAVIOR DETECTED - not smooth streaming');
      }
    }
    
    // Check if response contains actual text (not just thinking)
    const hasTextResponse = lastText.toLowerCase().includes('hello') || 
                            lastText.toLowerCase().includes('hi') ||
                            lastText.length > 50;
    
    console.log('\n📋 Response Analysis:');
    console.log(`   Contains greeting: ${hasTextResponse}`);
    console.log(`   Final length: ${lastText.length} chars`);
    console.log(`   Preview: "${lastText.slice(0, 100)}..."`);
    
    if (!hasTextResponse) {
      console.log('   ❌ NO TEXT RESPONSE - only thinking or empty!');
    } else {
      console.log('   ✅ Text response present');
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/chat-result.png' });
    console.log('\n📸 Screenshot saved to /tmp/chat-result.png');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/chat-error.png' });
    console.log('📸 Error screenshot saved to /tmp/chat-error.png');
  } finally {
    await browser.close();
  }
}

testChatStreaming().catch(console.error);
