const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  const clickResult = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const matches = btns.filter(el => el.textContent?.trim() === 'Browse');
    if (matches.length === 0) return { found: 0 };
    matches[0].click();
    return { found: matches.length, clicked: matches[0].outerHTML.slice(0, 200) };
  });
  console.log('CLICK RESULT:', JSON.stringify(clickResult, null, 2));

  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: '/private/tmp/claude-501/-Users-macbook/665a365f-b1a1-4dd5-9237-8f43dba8f149/scratchpad/05-after-browse-click.png' });

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  console.log('BODY TEXT:\n', bodyText);

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
