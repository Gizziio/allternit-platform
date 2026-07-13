const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('allternit-api://localhost/api/v1/files/list?path=.allternit/skills');
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 1000) };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('SKILLS DIR LIST:', JSON.stringify(result, null, 2));

  const homeResult = await page.evaluate(async () => {
    try {
      const res = await fetch('allternit-api://localhost/api/v1/files/list?path=.allternit');
      const text = await res.text();
      return { status: res.status, body: text.slice(0, 1500) };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('.allternit DIR LIST:', JSON.stringify(homeResult, null, 2));

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
