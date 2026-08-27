import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
const email = process.env.ALLTERNIT_TEST_EMAIL;
const password = process.env.ALLTERNIT_TEST_PASSWORD;
if (!email || !password) { console.error('Set env'); process.exit(1); }
const startUrl = 'https://platform.allternit.com/sign-in';
const outDir = '/tmp/allternit-signin-evidence-sameorigin';
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: outDir, size: { width: 1280, height: 900 } } });
const page = await context.newPage();
const logs = [];
const pushLog = (level, msg) => { const line = `[${level}] ${msg}`; logs.push(line); console.log(line); };
page.on('console', (msg) => pushLog(msg.type(), msg.text()));
page.on('pageerror', (err) => pushLog('pageerror', err.message));
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) pushLog('navigate', `→ ${frame.url()}`); });
async function screenshot(name) { await page.screenshot({ path: path.join(outDir, `${name}.png`), fullPage: false }); pushLog('screenshot', name); }
try {
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await screenshot('01-landing');
  await page.locator('input[name="identifier"]').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('input[name="identifier"]').first().fill(email);
  await screenshot('02-email-filled');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  await page.waitForTimeout(3000);
  await screenshot('03-after-email');
  const hasPassword = await page.locator('input[name="password"]').first().isVisible().catch(() => false);
  if (hasPassword) {
    await page.locator('input[name="password"]').first().fill(password);
    await page.getByRole('button', { name: /^Continue$/i }).click();
    pushLog('click', 'password continue');
  } else {
    const codeInput = page.locator('input[inputmode="numeric"]').first();
    if (await codeInput.isVisible().catch(() => false)) {
      await codeInput.fill(process.env.ALLTERNIT_TEST_EMAIL_CODE || '');
      await page.getByRole('button', { name: /^Continue$/i }).click();
      pushLog('click', 'code continue');
    }
  }
  await page.waitForTimeout(5000);
  await screenshot('04-after-submit');
  pushLog('final', `URL: ${page.url()} | Title: ${await page.title()}`);
} catch (err) {
  pushLog('fatal', err.message);
  await screenshot('99-error');
} finally {
  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'logs.txt'), logs.join('\n'), 'utf8');
  console.log(`\nEvidence saved to ${outDir}`);
}
