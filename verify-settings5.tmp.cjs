const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  // Close any open full-manager overlay / settings first, then reopen fresh.
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('allternit:close-settings')));
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'connectors' } })));
  await new Promise((r) => setTimeout(r, 4000));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-macbook/665a365f-b1a1-4dd5-9237-8f43dba8f149/scratchpad/06-connectors-loaded.png' });

  const text = await page.evaluate(() => document.body.innerText.slice(0, 800));
  console.log('TEXT:', text);

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
