import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://canvas.instructure.com/login');
  await page.waitForTimeout(5000);
  
  // Get all input fields
  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} input fields:`);
  for (let i = 0; i < Math.min(inputs.length, 20); i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const id = await inputs[i].getAttribute('id');
    const placeholder = await inputs[i].getAttribute('placeholder');
    console.log(`  [${i}] type=${type} name=${name} id=${id} placeholder=${placeholder}`);
  }
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/canvas-login.png' });
  console.log('Screenshot saved to /tmp/canvas-login.png');
  
  await browser.close();
})();
