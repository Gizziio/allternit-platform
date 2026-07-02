import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();

console.log('Opening frontend...');
await page.goto('http://localhost:3013');
await page.waitForLoadState('networkidle');

// Wait a bit for the app to mount
await page.waitForTimeout(2000);

// Set mode to 'code' in localStorage and reload
console.log('Switching to Code Mode...');
await page.evaluate(() => {
  localStorage.setItem('allternit-platform-mode', 'code');
});
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

// Take screenshot of initial state
await page.screenshot({ path: '/tmp/code-mode-initial.png', fullPage: true });
console.log('Screenshot saved: /tmp/code-mode-initial.png');

// Try to find and click "New Session" or "New Thread" button
const newSessionBtn = await page.locator('button:has-text("New Session"), button:has-text("New Thread"), [data-testid="new-session"]').first();
if (await newSessionBtn.isVisible().catch(() => false)) {
  console.log('Clicking New Session...');
  await newSessionBtn.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/tmp/code-mode-after-create.png', fullPage: true });
  console.log('Screenshot saved: /tmp/code-mode-after-create.png');
} else {
  console.log('New Session button not found');
}

// List sessions in the UI
const sessionItems = await page.locator('[data-session-id], [data-testid="session-item"], .session-item').all();
console.log(`Found ${sessionItems.length} session elements in UI`);

// Also check localStorage for persisted sessions
const persisted = await page.evaluate(() => {
  const keys = Object.keys(localStorage).filter(k => k.includes('session') || k.includes('code'));
  return keys.map(k => ({ key: k, length: localStorage.getItem(k)?.length || 0 }));
});
console.log('Persisted stores:', persisted);

await browser.close();
console.log('Done');
