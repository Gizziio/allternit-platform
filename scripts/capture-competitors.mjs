import { chromium } from 'playwright';

async function capture(url, path) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path, fullPage: false });
    console.log('saved', path);
  } catch (e) {
    console.error('error', url, e.message);
    try { await page.screenshot({ path, fullPage: false }); } catch {}
  }
  await browser.close();
}

await capture('https://claude.ai/code', '/tmp/claude-web-code.png');
await capture('https://chatgpt.com/codex', '/tmp/codex-web.png');
