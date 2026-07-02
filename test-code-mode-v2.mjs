import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }
});
const page = await context.newPage();

console.log('Opening frontend...');
await page.goto('http://localhost:3013');
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);

// Set mode to 'code' in localStorage and reload
console.log('Switching to Code Mode...');
await page.evaluate(() => {
  localStorage.setItem('allternit-platform-mode', 'code');
});
await page.reload();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);

// Take screenshot
await page.screenshot({ path: '/tmp/code-mode-v2.png', fullPage: true });
console.log('Screenshot saved: /tmp/code-mode-v2.png');

// Check console for errors
const logs = await page.evaluate(() => {
  // We can't read console logs retroactively, but we can check if sessions loaded
  return 'ok';
});

// Try to access the window and check if code sessions exist
const codeSessions = await page.evaluate(async () => {
  // Wait for the store to be available
  await new Promise(r => setTimeout(r, 2000));
  
  // Check if there's a global or if we can access the store
  const keys = Object.keys(window).filter(k => k.toLowerCase().includes('code') || k.toLowerCase().includes('session'));
  
  // Try to find the store via React devtools or global
  return { windowKeys: keys.slice(0, 20) };
});
console.log('Window keys:', codeSessions.windowKeys);

// Make a direct API call from the browser to verify the backend works
const apiResult = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/v1/agent-sessions?surface=code');
    const data = await res.json();
    return { ok: true, count: data.count, firstSession: data.sessions?.[0]?.name };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
console.log('API result from browser:', apiResult);

// Also check localStorage for code sessions store
const storeData = await page.evaluate(() => {
  const raw = localStorage.getItem('allternit-code-sessions');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return { 
      stateKeys: Object.keys(parsed.state || {}),
      sessionCount: parsed.state?.sessions?.length || 0,
      firstSessionName: parsed.state?.sessions?.[0]?.name
    };
  } catch {
    return { parseError: true };
  }
});
console.log('Code sessions store:', storeData);

await browser.close();
console.log('Done');
