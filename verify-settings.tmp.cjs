const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  // Open settings via the same custom event the app itself uses.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'connectors' } }));
  });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-macbook/665a365f-b1a1-4dd5-9237-8f43dba8f149/scratchpad/01-connectors.png' });

  // Navigate to Extensions
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, [role="button"], nav *')).find(el => el.textContent?.trim() === 'Extensions');
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-macbook/665a365f-b1a1-4dd5-9237-8f43dba8f149/scratchpad/02-extensions.png' });

  // Navigate to Allternit Plugins
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button, [role="button"], nav *')).find(el => el.textContent?.trim() === 'Allternit Plugins');
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-macbook/665a365f-b1a1-4dd5-9237-8f43dba8f149/scratchpad/03-plugins.png' });

  // Click Browse in plugins panel to test modal-in-modal
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent?.trim() === 'Browse');
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-macbook/665a365f-b1a1-4dd5-9237-8f43dba8f149/scratchpad/04-full-manager-overlay.png' });

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  console.log('BODY TEXT SNAPSHOT:\n', bodyText);

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
