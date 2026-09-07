import { chromium } from '@playwright/test';
import fs from 'fs';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text()));
page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

try {
  await page.goto('https://platform.allternit.com/sign-in', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/platform-sign-in-state.png', fullPage: true });

  const buttons = await page.locator('button').evaluateAll(els => els.map(e => ({ text: e.textContent.trim().slice(0,80), type: e.type, visible: e.offsetParent !== null, class: e.className.slice(0,80) })));
  const inputs = await page.locator('input').evaluateAll(els => els.map(e => ({ type: e.type, name: e.name, placeholder: e.placeholder, visible: e.offsetParent !== null })));
  console.log('BUTTONS:', JSON.stringify(buttons, null, 2));
  console.log('INPUTS:', JSON.stringify(inputs, null, 2));

  const html = await page.content();
  fs.writeFileSync('/tmp/platform-sign-in.html', html);
} catch (e) {
  console.error('error:', e.message);
} finally {
  await browser.close();
}
