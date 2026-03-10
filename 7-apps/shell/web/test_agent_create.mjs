import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false, args: ['--remote-debugging-port=9224'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

// Listen to console logs
page.on('console', msg => console.log('BROWSER:', msg.text()));

await page.goto('http://localhost:5177');
await page.waitForTimeout(3000);

// Click Agent Hub
await page.click('text=Agent Hub');
await page.waitForTimeout(2000);

// Take screenshot of initial state
await page.screenshot({ path: '/Users/macbook/create_agent_step1.png' });

// Click Get Started
await page.click('text=Get Started');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/create_agent_step2.png' });

// Fill identity
await page.fill('input[placeholder*="Code Review Sentinel"]', 'TestAgent');
await page.fill('textarea[placeholder*="owns and delivers"]', 'A test agent for debugging');
await page.waitForTimeout(500);
await page.screenshot({ path: '/Users/macbook/create_agent_step3.png' });

// Click Next to go to Personality
await page.click('text=Next:');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/create_agent_step4.png' });

// Click Next to go to Character
await page.click('text=Next:');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/create_agent_step5.png' });

// Click Next to go to Avatar
await page.click('text=Next:');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/create_agent_step6_avatar.png' });

console.log('Testing complete - check screenshots');
await browser.close();
