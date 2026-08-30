import { chromium } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';

const email = process.env.ALLTERNIT_TEST_EMAIL;
const password = process.env.ALLTERNIT_TEST_PASSWORD;
if (!email || !password) {
  console.error('Set ALLTERNIT_TEST_EMAIL and ALLTERNIT_TEST_PASSWORD');
  process.exit(1);
}

// Default to production; override with START_URL for local dev, e.g.
// START_URL='http://localhost:3013/sign-in?redirect_url=http%3A%2F%2Flocalhost%3A3013%2Fshell'
const startUrl = process.env.START_URL || 'https://platform.allternit.com/sign-in?redirect_url=https%3A%2F%2Fremotecontrol.allternit.com%2F';
const outDir = '/tmp/allternit-signin-evidence';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();

const logs = [];
const pushLog = (level, msg) => {
  const line = `[${level}] ${msg}`;
  logs.push(line);
  console.log(line);
};

page.on('console', (msg) => pushLog(msg.type(), msg.text()));
page.on('pageerror', (err) => pushLog('pageerror', err.message));
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = '';
    try { body = await res.text(); } catch {}
    pushLog('network', `${res.status()} ${res.request().method()} ${res.url()} ${body.slice(0, 200)}`);
  }
});
page.on('framenavigated', (frame) => {
  if (frame === page.mainFrame()) pushLog('navigate', `→ ${frame.url()}`);
});

async function screenshot(name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  pushLog('screenshot', file);
}

async function clickByText(text, opts = {}) {
  const loc = page.getByText(text, opts).first();
  await loc.waitFor({ state: 'visible', timeout: 8000 });
  await loc.click();
  pushLog('click', text);
}

async function fillPassword(passwordValue) {
  const passwordInput = page.locator('input[name="password"]').first();
  await passwordInput.waitFor({ state: 'visible', timeout: 10000 });
  await passwordInput.fill(passwordValue);
  await screenshot('05-password-filled');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  pushLog('click', 'Continue after password');
}

try {
  pushLog('start', `Navigating to ${startUrl}`);
  await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  await screenshot('01-landing');

  await page.locator('input[name="identifier"]').first().waitFor({ state: 'visible', timeout: 15000 });
  await screenshot('02-signin-mounted');

  await page.locator('input[name="identifier"]').first().fill(email);
  await screenshot('03-email-filled');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  pushLog('click', 'Continue after email');

  await page.waitForTimeout(2500);
  await screenshot('04-after-email-submit');

  // Prefer password if available, otherwise handle email verification code
  const hasPasswordField = await page.locator('input[name="password"]').first().isVisible().catch(() => false);
  if (hasPasswordField) {
    await fillPassword(password);
  } else {
    pushLog('info', 'No password field; looking for email code input');
    const code = process.env.ALLTERNIT_TEST_EMAIL_CODE;
    const otpInput = page.locator('input[name="code"], input[inputmode="numeric"], [class*="cl-otpCodeFieldInput"]').first();
    const hasCodeInput = await otpInput.isVisible().catch(() => false);
    if (hasCodeInput && code) {
      await page.locator('input[inputmode="numeric"]').first().fill(code);
      pushLog('input', 'filled email code');
      await screenshot('05-code-filled');
      await page.getByRole('button', { name: /^Continue$/i }).click();
      pushLog('click', 'Continue after code');
    } else {
      pushLog('info', 'No code field; looking for "Use another method"');
      const useAnother = page.getByText('Use another method').first();
      if (await useAnother.isVisible().catch(() => false)) {
        await useAnother.click();
        pushLog('click', 'Use another method');
        await page.waitForTimeout(1000);
        await screenshot('04b-alternative-methods');
        const passwordOption = page.getByText('Password').first();
        if (await passwordOption.isVisible().catch(() => false)) {
          await passwordOption.click();
          pushLog('click', 'Password option');
          await page.waitForTimeout(1000);
          await fillPassword(password);
        } else {
          pushLog('warn', 'Password option not visible');
        }
      } else {
        pushLog('warn', 'No alternative methods link visible');
      }
    }
  }

  await page.waitForTimeout(3000);
  await screenshot('06-after-password-submit');

  await page.waitForURL((url) => url.hostname.includes('remotecontrol.allternit.com'), { timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await screenshot('07-redirect-target');

  pushLog('final', `URL: ${page.url()} | Title: ${await page.title()}`);
  const runtimeCards = await page.locator('[data-testid="runtime-card"], .runtime-card').count().catch(() => 0);
  pushLog('check', `runtime cards visible: ${runtimeCards}`);
} catch (err) {
  pushLog('fatal', err.message);
  await screenshot('99-fatal-error');
} finally {
  await screenshot('98-final-state');
  await context.close();
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'logs.txt'), logs.join('\n'), 'utf8');
  console.log(`\nEvidence saved to ${outDir}`);
}
