const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  const seen = [];
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('files') || url.includes('skills') || url.includes('plugins')) {
      seen.push({ url, status: res.status() });
    }
  });

  // Navigate to Skills tab inside the already-open full manager, click Refresh.
  const clickResult = await page.evaluate(() => {
    const catBtns = Array.from(document.querySelectorAll('button, a, [role="button"], li, div')).filter(el => el.textContent?.trim() === 'Skills' && el.closest('[class*="Categor"], nav') !== null);
    return { found: catBtns.length };
  });
  console.log('nav probe', clickResult);

  // Click the refresh icon button near "Skills" header (small circular arrow button, 2nd button in header).
  await page.evaluate(() => {
    const header = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).find(el => el.textContent?.trim() === 'Skills');
  });

  // Simplest reliable approach: click all buttons with an aria-label or title containing "refresh" (case-insensitive), or the icon-only refresh button.
  const refreshClick = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(b => (b.getAttribute('aria-label') || '').toLowerCase().includes('refresh') || (b.title || '').toLowerCase().includes('refresh'));
    if (target) { target.click(); return 'clicked-aria'; }
    return 'not-found';
  });
  console.log('refresh click result', refreshClick);

  await new Promise((r) => setTimeout(r, 2500));
  console.log('NETWORK SEEN:', JSON.stringify(seen, null, 2));

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
