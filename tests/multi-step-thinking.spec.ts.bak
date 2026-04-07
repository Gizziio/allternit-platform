/**
 * Multi-Step Thinking Test
 * Tests how thinking/reasoning appears during complex multi-step tasks
 */

import { chromium } from 'playwright';

async function testMultiStepThinking() {
  console.log('🧪 Multi-Step Thinking Test\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--window-size=1280,800', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  
  // Capture all console messages
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[rust-stream-adapter]') || 
        text.includes('content_block') ||
        text.includes('updateMessageParts') ||
        text.includes('reasoning') ||
        text.includes('thinking')) {
      consoleMessages.push(text);
      console.log(`[Browser] ${text}`);
    }
  });

  try {
    console.log('📍 Navigating to chat...');
    await page.goto('http://localhost:5177/?nocache=' + Date.now(), { timeout: 30000 });
    await page.reload({ waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for chat interface...');
    await page.waitForSelector('textarea', { timeout: 15000 });
    
    const input = page.locator('textarea').first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    
    // Send a multi-step task that will trigger multiple thinking blocks
    console.log('⌨️  Sending multi-step task...');
    await input.fill('Create a simple todo app: 1) Create HTML file with todo list 2) Add CSS styling 3) Add JavaScript for functionality');
    await page.waitForTimeout(500);
    await input.press('Enter');
    
    console.log('⏳ Monitoring thinking blocks (15s)...\n');
    
    const startTime = Date.now();
    let lastText = '';
    const thinkingBlocks: { time: number; text: string; length: number }[] = [];
    const textBlocks: { time: number; text: string; length: number }[] = [];
    
    // Monitor for 15 seconds
    while (Date.now() - startTime < 15000) {
      const messageArea = page.locator('[class*="assistant-message-group"]').last();
      const text = await messageArea.textContent().catch(() => '');
      
      if (text && text !== lastText) {
        const elapsed = Date.now() - startTime;
        const delta = text.length - lastText.length;
        
        // Detect if this is thinking (contains brain emoji or italic)
        const isThinking = text.includes('🧠') || text.includes('Thought');
        
        if (isThinking) {
          thinkingBlocks.push({
            time: elapsed,
            text: text.slice(0, 100),
            length: text.length,
          });
          console.log(`🧠 [+${elapsed}ms] Thinking: ${delta > 0 ? '+' : ''}${delta} chars (${text.length} total)`);
        } else {
          textBlocks.push({
            time: elapsed,
            text: text.slice(0, 100),
            length: text.length,
          });
          console.log(`📝 [+${elapsed}ms] Text: ${delta > 0 ? '+' : ''}${delta} chars (${text.length} total)`);
        }
        
        lastText = text;
      }
      
      await page.waitForTimeout(100);
    }
    
    console.log('\n📊 RESULTS:');
    console.log(`   Thinking updates: ${thinkingBlocks.length}`);
    console.log(`   Text updates: ${textBlocks.length}`);
    
    // Check for compounding (multiple separate thinking blocks)
    const separateThinkingBlocks = thinkingBlocks.filter((b, i) => {
      if (i === 0) return true;
      // If length reset or significantly different, it's a new block
      return b.length < thinkingBlocks[i-1].length * 0.8;
    });
    
    console.log(`\n📋 Analysis:`);
    console.log(`   Separate thinking blocks: ${separateThinkingBlocks.length}`);
    
    if (separateThinkingBlocks.length > 1) {
      console.log(`   ⚠️  COMPOUNDING DETECTED - Multiple thinking blocks shown`);
      console.log('      → This is the issue: each new thought creates a new block instead of replacing');
    } else {
      console.log(`   ✅ Single thinking block (ephemeral, updates in place)`);
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/multi-step-thinking.png' });
    console.log('\n📸 Screenshot saved to /tmp/multi-step-thinking.png');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/multi-step-thinking-error.png' });
  } finally {
    await browser.close();
  }
}

testMultiStepThinking().catch(console.error);
