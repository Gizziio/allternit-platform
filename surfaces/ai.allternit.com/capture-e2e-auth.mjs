import { chromium } from '@playwright/test';

const email = 'cartlidge.joseph@proton.me';
const password = 'ceccor-nycnih-jiVgu0';
const otp = '845294';

async function signIn(page, label) {
  page.on('console', msg => console.log(`${label}:`, msg.type(), msg.text()));
  page.on('pageerror', err => console.log(`${label} ERROR:`, err.message));

  await page.goto('https://platform.allternit.com/sign-in', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/${label}-sign-in-start.png`, fullPage: true });

  // Email
  await page.locator('input[name="identifier"]').fill(email);
  await page.screenshot({ path: `/tmp/${label}-email-filled.png`, fullPage: true });

  await page.locator('button.cl-formButtonPrimary').filter({ hasText: 'Continue' }).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `/tmp/${label}-after-continue.png`, fullPage: true });

  // If email-code screen appears, try "Use another method" to use password
  const useAnotherMethod = page.locator('button:has-text("Use another method")').first();
  if (await useAnotherMethod.isVisible().catch(() => false)) {
    await useAnotherMethod.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/${label}-another-method.png`, fullPage: true });

    // Try to select password
    const passwordOption = page.locator('button:has-text("Password"), div:has-text("Password")').first();
    if (await passwordOption.isVisible().catch(() => false)) {
      await passwordOption.click();
      await page.waitForTimeout(2000);
    }
  }

  // Password
  const passwordInput = page.locator('input[type="password"]').first();
  if (await passwordInput.isVisible().catch(() => false)) {
    await passwordInput.fill(password);
    await page.screenshot({ path: `/tmp/${label}-password-filled.png`, fullPage: true });
    await page.locator('button.cl-formButtonPrimary').filter({ hasText: 'Continue' }).click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `/tmp/${label}-after-password.png`, fullPage: true });
  }

  // MFA / TOTP
  const otpBoxes = page.locator('input[inputmode="numeric"], input[type="tel"]').first();
  if (await otpBoxes.isVisible().catch(() => false)) {
    const allOtpInputs = page.locator('input[inputmode="numeric"], input[type="tel"]');
    const count = await allOtpInputs.count();
    if (count === 1) {
      await allOtpInputs.first().fill(otp);
    } else {
      for (let i = 0; i < otp.length && i < count; i++) {
        await allOtpInputs.nth(i).fill(otp[i]);
      }
    }
    await page.screenshot({ path: `/tmp/${label}-otp-filled.png`, fullPage: true });
    await page.locator('button.cl-formButtonPrimary').filter({ hasText: 'Continue' }).click();
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `/tmp/${label}-after-otp.png`, fullPage: true });
  }

  const url = page.url();
  console.log(`${label} post-sign-in URL:`, url);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/${label}-signed-in.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const platformPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await signIn(platformPage, 'platform');

  // Navigate to Dispatch / Remote Control
  try {
    const dispatchLink = platformPage.locator('a[href*="/dispatch"]').first();
    if (await dispatchLink.isVisible().catch(() => false)) {
      await dispatchLink.click();
      await platformPage.waitForTimeout(3000);
      await platformPage.screenshot({ path: '/tmp/platform-dispatch.png', fullPage: true });
    }

    const activeTab = platformPage.locator('text=Active sessions').first();
    if (await activeTab.isVisible().catch(() => false)) {
      await activeTab.click();
      await platformPage.waitForTimeout(3000);
      await platformPage.screenshot({ path: '/tmp/platform-active-sessions.png', fullPage: true });
    }
  } catch (e) {
    console.log('dispatch navigation error:', e.message);
  }

  // Open remotecontrol dashboard
  const dashboardPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  dashboardPage.on('console', msg => console.log('DASHBOARD:', msg.type(), msg.text()));
  dashboardPage.on('pageerror', err => console.log('DASHBOARD ERROR:', err.message));

  await dashboardPage.goto('https://remotecontrol.allternit.com', { waitUntil: 'networkidle', timeout: 30000 });
  await dashboardPage.waitForTimeout(5000);
  const signInButton = await dashboardPage.locator('text=Sign in with Allternit').count();
  const loading = await dashboardPage.locator('text=Loading account').count();
  const userMenu = await dashboardPage.locator('[data-testid="user-button"], button:has-text("Account")').count();
  console.log('dashboard sign-in button:', signInButton, 'loading:', loading, 'userMenu:', userMenu);
  await dashboardPage.screenshot({ path: '/tmp/remotecontrol-e2e.png', fullPage: true });

  await browser.close();
}

main().catch(e => {
  console.error('e2e script failed:', e);
  process.exit(1);
});
