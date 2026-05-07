import { test, expect } from '@playwright/test';

test('check if web content loads', async ({ page }) => {
  await page.goto('http://127.0.0.1:5177');
  await page.waitForLoadState('networkidle');
  await page.click('[data-rail-item="browser"]');
  await page.waitForTimeout(5000);  // Wait for content to load
  
  // Take screenshot
  await page.screenshot({ path: 'test-results/web-content-check.png', fullPage: true });
  
  // Find iframe
  const iframe = page.locator('iframe[data-testid="allternit-iframe-content"]');
  const isVisible = await iframe.isVisible();
  console.log('Iframe visible:', isVisible);
  
  // Get iframe bounding box
  const box = await iframe.boundingBox();
  console.log('Iframe box:', box);
  
  // Try to access iframe content
  try {
    const frame = await iframe.contentFrame();
    if (frame) {
      console.log('Got iframe content frame');
      
      // Wait for iframe to load
      await frame.waitForLoadState('domcontentloaded', { timeout: 10000 });
      
      // Get iframe title
      const title = await frame.title();
      console.log('Iframe page title:', title);
      
      // Get iframe URL
      const url = frame.url();
      console.log('Iframe URL:', url);
      
      // Check if there's any content
      const body = await frame.locator('body').first();
      const bodyText = await body.textContent();
      console.log('Body text length:', bodyText?.length);
      
      // Take screenshot of iframe content
      await body.screenshot({ path: 'test-results/iframe-content.png' });
      
      // Check for common Google elements
      const searchBox = frame.locator('input[name="q"], input[type="text"]').first();
      const searchBoxVisible = await searchBox.isVisible();
      console.log('Google search box visible:', searchBoxVisible);
      
    } else {
      console.log('Could not get iframe content frame');
    }
  } catch (error: any) {
    console.log('Error accessing iframe:', error.message);
  }
  
  // Check web-proxy directly
  const response = await page.goto('http://127.0.0.1:5177/web-proxy?url=https://www.google.com');
  console.log('Web-proxy status:', response?.status());
  if (response?.status() === 200) {
    const html = await response.text();
    console.log('Web-proxy response length:', html.length);
    console.log('Contains "Google":', html.includes('Google'));
  }
});
