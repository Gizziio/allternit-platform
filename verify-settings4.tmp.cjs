const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  const connResult = await page.evaluate(async () => {
    try {
      const res = await fetch('allternit-api://localhost/api/v1/connectors');
      const text = await res.text();
      return { status: res.status, len: text.length, sample: text.slice(0, 200) };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('CONNECTORS RAW FETCH:', JSON.stringify(connResult, null, 2));

  const healthResult = await page.evaluate(async () => {
    try {
      const res = await fetch('allternit-api://localhost/health');
      const text = await res.text();
      return { status: res.status, sample: text.slice(0, 200) };
    } catch (e) {
      return { error: String(e) };
    }
  });
  console.log('HEALTH RAW FETCH:', JSON.stringify(healthResult, null, 2));

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
