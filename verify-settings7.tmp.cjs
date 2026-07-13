const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://127.0.0.1:9223/devtools/browser/3004cd4d-46ec-45f3-98e6-154aac759f49',
    defaultViewport: null,
  });
  const pages = await browser.pages();
  const page = pages[0];
  await page.bringToFront();

  const env = await page.evaluate(() => {
    const g = globalThis;
    return {
      hasWindowRequire: typeof g?.window?.require === 'function',
      hasGlobalRequire: typeof g?.require === 'function',
      hasProcessMainModuleRequire: typeof g?.process?.mainModule?.require === 'function',
      hasProcess: typeof g?.process !== 'undefined',
      processType: g?.process?.type,
      hasAllternit: typeof g?.window?.allternit !== 'undefined',
      allternitKeys: g?.window?.allternit ? Object.keys(g.window.allternit) : null,
      contextIsolated: g?.window?.allternit ? true : 'unknown',
    };
  });
  console.log('ENV PROBE:', JSON.stringify(env, null, 2));

  browser.disconnect();
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
