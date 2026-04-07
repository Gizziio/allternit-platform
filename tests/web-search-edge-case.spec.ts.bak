/**
 * Web Search Edge Case Test
 * Tests how web search results are displayed
 */

import { chromium } from 'playwright';

async function testWebSearch() {
  console.log('🧪 Web Search Edge Case Test\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--window-size=1280,800', '--disable-gpu']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  
  try {
    console.log('📍 Navigating to chat...');
    await page.goto('http://localhost:5177/?nocache=' + Date.now(), { timeout: 30000 });
    await page.reload({ waitUntil: 'networkidle' });
    
    console.log('⏳ Waiting for chat interface...');
    await page.waitForSelector('textarea', { timeout: 15000 });
    
    const input = page.locator('textarea').first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    
    // Test 1: Simple web search
    console.log('\n🔍 Test 1: Simple web search');
    await input.fill('Search for latest TypeScript 5.0 features');
    await page.waitForTimeout(500);
    await input.press('Enter');
    
    await page.waitForTimeout(15000);
    
    // Capture result
    const messageArea1 = page.locator('[class*="assistant-message-group"]').last();
    const text1 = await messageArea1.textContent().catch(() => '');
    console.log(`   Result 1 length: ${text1.length} chars`);
    console.log(`   Preview: ${text1.slice(0, 150)}...`);
    
    // Test 2: Multiple searches
    console.log('\n🔍 Test 2: Multiple searches in one request');
    await input.fill('Compare React vs Vue performance and search for best practices in 2024');
    await page.waitForTimeout(500);
    await input.press('Enter');
    
    await page.waitForTimeout(20000);
    
    const messageArea2 = page.locator('[class*="assistant-message-group"]').last();
    const text2 = await messageArea2.textContent().catch(() => '');
    console.log(`   Result 2 length: ${text2.length} chars`);
    console.log(`   Preview: ${text2.slice(0, 150)}...`);
    
    // Check for issues
    console.log('\n📊 Analysis:');
    
    // Check for duplicated content
    const hasDuplication = text2.length > 2000 && text2.split(' ').filter(w => w.length > 5).some((w, i, arr) => arr.indexOf(w) !== i);
    if (hasDuplication) {
      console.log('   ⚠️  Potential content duplication detected');
    } else {
      console.log('   ✅ No obvious duplication');
    }
    
    // Check for proper formatting
    const hasPills = text2.includes('Searched:') || text2.includes('Search:');
    if (hasPills) {
      console.log('   ✅ Search pills detected');
    } else {
      console.log('   ⚠️  Search pills not detected');
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/web-search-test.png' });
    console.log('\n📸 Screenshot saved to /tmp/web-search-test.png');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await page.screenshot({ path: '/tmp/web-search-error.png' });
  } finally {
    await browser.close();
  }
}

testWebSearch().catch(console.error);
