/**
 * Comprehensive Web Surfing Test
 * Tests navigation to multiple websites and analyzes functionality
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5177';

test.describe('Web Surfing Analysis', () => {
  test('test multiple websites', async ({ page }) => {
    const results: any[] = [];
    
    // Navigate to app
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.click('[data-rail-item="browser"]');
    await page.waitForTimeout(3000);
    
    // Test sites to visit
    const testSites = [
      { name: 'Google', url: 'https://www.google.com', expected: ['Google', 'Search'] },
      { name: 'Wikipedia', url: 'https://www.wikipedia.org', expected: ['Wikipedia', 'Free Encyclopedia'] },
      { name: 'GitHub', url: 'https://github.com', expected: ['GitHub', 'Sign in'] },
      { name: 'Hacker News', url: 'https://news.ycombinator.com', expected: ['Hacker News', 'News'] },
    ];
    
    for (const site of testSites) {
      console.log(`\n=== Testing ${site.name}: ${site.url} ===`);
      const result = {
        name: site.name,
        url: site.url,
        navigated: false,
        loaded: false,
        hasContent: false,
        hasErrors: false,
        errors: [] as string[],
        iframeContent: false,
        iframeBodyLength: 0,
      };
      
      // Capture console errors
      const pageErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          pageErrors.push(msg.text());
        }
      });
      
      try {
        // Try to navigate by updating URL in the omnibar
        const urlInput = page.locator('input[type="text"]').first();
        if (await urlInput.count() > 0) {
          await urlInput.fill('');
          await urlInput.type(site.url);
          await page.keyboard.press('Enter');
          result.navigated = true;
          console.log(`✓ Navigated to ${site.name}`);
        } else {
          console.log(`✗ Could not find URL input for ${site.name}`);
          result.errors.push('No URL input found');
        }
        
        // Wait for content to load
        await page.waitForTimeout(8000);
        
        // Check iframe content
        const iframe = page.locator('iframe[data-testid="a2r-iframe-content"]');
        if (await iframe.count() > 0) {
          const iframeStatus = await page.evaluate(() => {
            const iframeEl = document.querySelector('iframe[data-testid="a2r-iframe-content"]') as HTMLIFrameElement;
            if (!iframeEl) return null;
            return {
              readyState: iframeEl.contentDocument?.readyState,
              hasBody: !!iframeEl.contentDocument?.body,
              bodyLength: iframeEl.contentDocument?.body?.innerHTML?.length || 0,
              title: iframeEl.contentDocument?.title || '',
            };
          });
          
          result.iframeContent = true;
          result.iframeBodyLength = iframeStatus?.bodyLength || 0;
          result.loaded = iframeStatus?.readyState === 'complete';
          result.hasContent = (iframeStatus?.bodyLength || 0) > 1000;
          
          console.log(`  Iframe: readyState=${iframeStatus?.readyState}, bodyLength=${iframeStatus?.bodyLength}`);
          
          if (iframeStatus?.bodyLength && iframeStatus.bodyLength > 1000) {
            console.log(`✓ Content loaded for ${site.name}`);
          } else {
            console.log(`✗ Content too small for ${site.name}`);
            result.errors.push('Insufficient content');
          }
        } else {
          result.errors.push('Iframe not found');
          console.log(`✗ Iframe not found for ${site.name}`);
        }
        
        // Check for errors
        if (pageErrors.length > 0) {
          result.hasErrors = true;
          result.errors = [...result.errors, ...pageErrors.slice(0, 5)];
          console.log(`  Errors: ${pageErrors.length}`);
        }
        
        // Take screenshot
        await page.screenshot({ 
          path: `test-results/surf-${site.name.toLowerCase().replace(' ', '-')}.png`,
          fullPage: true 
        });
        
      } catch (error: any) {
        result.hasErrors = true;
        result.errors.push(error.message);
        console.log(`✗ Error testing ${site.name}:`, error.message);
      }
      
      results.push(result);
    }
    
    // Summary
    console.log('\n\n========== WEB SURFING ANALYSIS ==========');
    console.log(`Total sites tested: ${results.length}`);
    console.log(`Successfully loaded: ${results.filter(r => r.hasContent).length}`);
    console.log(`Failed to load: ${results.filter(r => !r.hasContent).length}`);
    
    results.forEach(r => {
      console.log(`\n${r.name} (${r.url}):`);
      console.log(`  Navigated: ${r.navigated}`);
      console.log(`  Loaded: ${r.loaded}`);
      console.log(`  Has Content: ${r.hasContent} (${r.iframeBodyLength} bytes)`);
      console.log(`  Has Errors: ${r.hasErrors}`);
      if (r.errors.length > 0) {
        console.log(`  Errors: ${r.errors.slice(0, 3).join(', ')}`);
      }
    });
    
    // Take final summary screenshot
    await page.screenshot({ 
      path: 'test-results/web-surfing-summary.png',
      fullPage: true 
    });
    
    // Write results to file
    const fs = await import('fs');
    fs.writeFileSync(
      'test-results/web-surfing-results.json',
      JSON.stringify(results, null, 2)
    );
    
    console.log('\nResults saved to test-results/web-surfing-results.json');
    console.log('Screenshots saved to test-results/surf-*.png');
  });
});
