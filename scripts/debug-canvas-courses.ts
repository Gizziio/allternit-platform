import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Login
  await page.goto('https://canvas.instructure.com/login');
  await page.waitForSelector('input#username', { timeout: 15000 });
  await page.fill('input#username', process.env.CANVAS_EMAIL || '');
  await page.fill('input#password', process.env.CANVAS_PASSWORD || '');
  await page.click('button[type="submit"]');
  await page.waitForURL(/canvas\.instructure\.com/, { timeout: 30000 });
  console.log('Logged in');
  
  // Navigate to courses
  await page.evaluate(() => { window.location.href = 'https://canvas.instructure.com/courses'; });
  await page.waitForTimeout(4000);
  
  // Take screenshot before click
  await page.screenshot({ path: '/tmp/canvas-courses-before.png' });
  console.log('Screenshot before: /tmp/canvas-courses-before.png');
  
  // Click "Start a New Course"
  const startBtn = await page.locator('text=Start a New Course').first();
  console.log('Start button count:', await startBtn.count());
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForTimeout(3000);
    
    // Take screenshot after click
    await page.screenshot({ path: '/tmp/canvas-courses-after.png' });
    console.log('Screenshot after: /tmp/canvas-courses-after.png');
    
    // Dump all inputs
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} inputs after click:`);
    for (let i = 0; i < Math.min(inputs.length, 20); i++) {
      const type = await inputs[i].getAttribute('type');
      const name = await inputs[i].getAttribute('name');
      const id = await inputs[i].getAttribute('id');
      const placeholder = await inputs[i].getAttribute('placeholder');
      console.log(`  [${i}] type=${type} name=${name} id=${id} placeholder=${placeholder}`);
    }
  }
  
  await browser.close();
})();
