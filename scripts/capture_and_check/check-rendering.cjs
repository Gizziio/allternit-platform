const { chromium } = require('./node_modules/playwright');

async function main() {
  console.log('Launching browser to check console...');
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  const consoleLogs = [];
  
  page.on('console', msg => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });
  
  page.on('pageerror', err => {
    errors.push(`[PAGE ERROR] ${err.message}`);
  });
  
  console.log('Navigating to http://127.0.0.1:5177/...');
  await page.goto('http://127.0.0.1:5177/', { waitUntil: 'networkidle', timeout: 30000 });
  
  console.log('Waiting for 5 seconds...');
  await page.waitForTimeout(5000);
  
  console.log('\n=== CONSOLE LOGS (first 20) ===');
  consoleLogs.slice(0, 20).forEach(log => console.log(log));
  
  console.log('\n=== ERRORS ===');
  if (errors.length === 0) {
    console.log('No errors found');
  } else {
    errors.forEach(err => console.log(err));
  }
  
  // Check if root element has content
  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.substring(0, 500) : 'ROOT NOT FOUND';
  });
  
  console.log('\n=== ROOT ELEMENT CONTENT ===');
  console.log(rootContent || '(empty)');
  
  // Check document body
  const bodyContent = await page.evaluate(() => {
    return document.body.innerHTML.substring(0, 1000);
  });
  
  console.log('\n=== BODY CONTENT (first 1000 chars) ===');
  console.log(bodyContent);
  
  await browser.close();
}

main().catch(console.error);
