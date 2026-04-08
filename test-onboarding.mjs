#!/usr/bin/env node
/**
 * Test Onboarding Flow - Headless Browser Test
 * Uses Playwright to verify the "Enter backend URL" option works
 */

import { chromium } from 'playwright';

const BASE_URL = 'https://platform.allternit.com';
const BACKEND_URL = 'https://molecules-dsc-specifications-dangerous.trycloudflare.com';
const BACKEND_TOKEN = 'Basic Z2l6emk6YzVkNDY1NmU3ZjM3NTNiYzBkODk5NmQ0ZGJlYmY0OGNlY2JkNzM2MmJlMDZlNjBm';

async function testOnboarding() {
  console.log('🚀 Starting headless browser test...\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: '/tmp/playwright-videos' }
  });
  const page = await context.newPage();
  
  try {
    // Step 1: Navigate to site
    console.log('📍 Step 1: Navigating to', BASE_URL);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/test-01-home.png' });
    console.log('✅ Page loaded\n');
    
    // Step 2: Check if onboarding is shown or if we need to start it
    console.log('📍 Step 2: Checking for onboarding...');
    
    // Look for "Get Started" button or onboarding indicator
    const getStartedBtn = await page.locator('text=Get Started').first();
    const hasGetStarted = await getStartedBtn.isVisible().catch(() => false);
    
    if (hasGetStarted) {
      console.log('  Found "Get Started" button, clicking...');
      await getStartedBtn.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('  No "Get Started" button, checking if already in onboarding...');
    }
    await page.screenshot({ path: '/tmp/test-02-after-start.png' });
    
    // Step 3: Look for infrastructure options
    console.log('📍 Step 3: Looking for infrastructure options...');
    
    // Check for "Enter backend URL" option
    const manualOption = await page.locator('text=Enter backend URL').first();
    const hasManualOption = await manualOption.isVisible().catch(() => false);
    
    if (hasManualOption) {
      console.log('✅ Found "Enter backend URL" option!\n');
      
      // Click on it
      console.log('📍 Step 4: Selecting "Enter backend URL"...');
      await manualOption.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: '/tmp/test-03-manual-selected.png' });
      
      // Step 5: Fill in the form
      console.log('📍 Step 5: Filling in backend URL form...');
      
      // Find and fill the URL input (using placeholder or nearby text)
      const urlInput = await page.locator('input[placeholder*="URL"], input[placeholder*="url"]').first();
      if (await urlInput.isVisible().catch(() => false)) {
        await urlInput.fill(BACKEND_URL);
        console.log('  ✅ Filled backend URL');
      }
      
      // Find and fill the name input
      const nameInput = await page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill('MacBook Test');
        console.log('  ✅ Filled connection name');
      }
      
      // Find and fill the token input (optional)
      const tokenInput = await page.locator('input[placeholder*="token"], input[placeholder*="Token"]').first();
      if (await tokenInput.isVisible().catch(() => false)) {
        await tokenInput.fill(BACKEND_TOKEN);
        console.log('  ✅ Filled auth token');
      }
      
      await page.screenshot({ path: '/tmp/test-04-form-filled.png' });
      
      // Step 6: Click Connect button
      console.log('📍 Step 6: Clicking "Connect to Backend"...');
      const connectBtn = await page.locator('button:has-text("Connect to Backend"), button:has-text("Connect")').first();
      
      if (await connectBtn.isVisible().catch(() => false)) {
        await connectBtn.click();
        console.log('  ✅ Clicked connect button');
        
        // Wait for response
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/test-05-after-connect.png' });
        
        // Check for success message
        const successMsg = await page.locator('text=success, text=connected, text=Backend connected').first();
        const hasSuccess = await successMsg.isVisible().catch(() => false);
        
        if (hasSuccess) {
          console.log('✅✅✅ SUCCESS! Backend connected!\n');
        } else {
          // Check for error
          const errorMsg = await page.locator('text=error, text=failed, text=Error').first();
          const errorText = await errorMsg.textContent().catch(() => 'Unknown error');
          console.log('⚠️ Connection result:', errorText, '\n');
        }
      } else {
        console.log('❌ Connect button not found\n');
      }
      
    } else {
      console.log('❌ "Enter backend URL" option not found!\n');
      
      // List available options for debugging
      const allOptions = await page.locator('button, [role="button"]').allTextContents();
      console.log('Available buttons/options:');
      allOptions.slice(0, 20).forEach((text, i) => {
        if (text.trim()) console.log(`  ${i + 1}. "${text.trim()}"`);
      });
    }
    
    // Final screenshot
    await page.screenshot({ path: '/tmp/test-final.png', fullPage: true });
    console.log('\n📸 Screenshots saved to /tmp/test-*.png');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/test-error.png' });
  } finally {
    await browser.close();
    console.log('\n🏁 Browser closed');
  }
}

// Run the test
testOnboarding().catch(console.error);
