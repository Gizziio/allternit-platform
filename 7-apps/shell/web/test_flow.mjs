import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false, args: ['--remote-debugging-port=9225'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

page.on('console', msg => console.log('BROWSER:', msg.text()));

await page.goto('http://localhost:5177');
await page.waitForTimeout(4000);

// Navigate to Agent Hub
await page.click('text=Agent Hub');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/macbook/agent_studio_test.png' });

// Fill out the form quickly
await page.click('text=Get Started');
await page.waitForTimeout(500);

// Identity
await page.fill('input[placeholder*="Code Review"]', 'MyTestAgent');
await page.fill('textarea[placeholder*="owns and delivers"]', 'A test agent');
await page.click('text=Next:');
await page.waitForTimeout(500);

// Personality - just click next
await page.click('text=Next:');
await page.waitForTimeout(500);

// Character - just click next  
await page.click('text=Next:');
await page.waitForTimeout(500);

// Avatar step
await page.screenshot({ path: '/Users/macbook/agent_studio_avatar.png' });
console.log('Avatar step screenshot saved');

await browser.close();
