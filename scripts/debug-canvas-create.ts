import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Login
  await page.goto('https://canvas.instructure.com/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('input#username', { timeout: 15000 });
  await page.fill('input#username', process.env.CANVAS_EMAIL || '');
  await page.fill('input#password', process.env.CANVAS_PASSWORD || '');
  await page.click('button[type="submit"]');
  await page.waitForURL(/canvas\.instructure\.com/, { timeout: 30000 });
  console.log('Logged in. Current URL:', page.url());
  
  // Navigate to courses
  await page.evaluate(() => { window.location.href = 'https://canvas.instructure.com/courses'; });
  await page.waitForTimeout(6000);
  console.log('On courses page. Current URL:', page.url());
  
  // Dump page text to find the button
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body text contains "Start a New Course":', bodyText.includes('Start a New Course'));
  
  // Try multiple ways to click
  const startBtn = page.locator('text=Start a New Course').first();
  console.log('Locator count:', await startBtn.count());
  
  if (await startBtn.count() > 0) {
    const box = await startBtn.boundingBox();
    console.log('Button bounding box:', box);
    await startBtn.click();
    await page.waitForTimeout(4000);
    
    // Check inputs
    const inputs = await page.locator('input').all();
    console.log(`Found ${inputs.length} inputs after click:`);
    for (let i = 0; i < Math.min(inputs.length, 20); i++) {
      const type = await inputs[i].getAttribute('type');
      const name = await inputs[i].getAttribute('name');
      const id = await inputs[i].getAttribute('id');
      const placeholder = await inputs[i].getAttribute('placeholder');
      console.log(`  [${i}] type=${type} name=${name} id=${id} placeholder=${placeholder}`);
    }
    
    await page.screenshot({ path: '/tmp/canvas-after-click.png' });
    console.log('Screenshot saved: /tmp/canvas-after-click.png');
  } else {
    console.log('Button not found, dumping links:');
    const links = await page.locator('a').all();
    for (const link of links.slice(0, 20)) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      console.log(`  Link: "${text?.trim()}" -> ${href}`);
    }
  }
  
  await browser.close();
})();
