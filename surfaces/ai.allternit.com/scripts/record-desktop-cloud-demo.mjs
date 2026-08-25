import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/Users/joe/Desktop/allternit-workspace/allternit-session-desktop-cloud-mvp/docs/desktop-cloud-mvp';
const OUT_PATH = path.join(OUT_DIR, 'phase27-platform-integration-demo.webm');

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

try {
  await page.goto('http://127.0.0.1:3020/desktop-cloud-demo.html', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Scroll through the view to show all sections
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  // Hover over and click Refresh to show interactivity
  await page.click('button:has-text("Refresh")');
  await page.waitForTimeout(2000);

  // Scroll down to show templates, capacity, usage
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(2000);

  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(2000);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
} catch (err) {
  console.error('Recording error:', err.message);
} finally {
  await context.close();
  await browser.close();
}

// Find the video file Playwright created and rename it
const files = fs.readdirSync(OUT_DIR);
const video = files.find((f) => f.endsWith('.webm') && f !== 'phase27-platform-integration-demo.webm');
if (video) {
  fs.renameSync(path.join(OUT_DIR, video), OUT_PATH);
  console.log('Video saved to', OUT_PATH);
} else {
  console.log('No video file found');
}
