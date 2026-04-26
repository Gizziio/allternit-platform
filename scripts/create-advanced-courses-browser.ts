#!/usr/bin/env npx tsx
/**
 * Create Advanced A://Labs courses in Canvas via browser automation.
 */

import { chromium } from 'playwright';

const CANVAS_EMAIL = process.env.CANVAS_EMAIL || '';
const CANVAS_PASSWORD = process.env.CANVAS_PASSWORD || '';

const ADVANCED_COURSES = [
  {
    code: 'ALABS-ADV-PLUGINSDK',
    name: 'A://Labs ADV — Build Plugins for Allternit',
    description: 'Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, and publishing cross-platform plugins.',
  },
  {
    code: 'ALABS-ADV-WORKFLOW',
    name: 'A://Labs ADV — The Allternit Workflow Engine',
    description: 'Visual DAG orchestration, node execution, state management, and building custom workflow nodes.',
  },
  {
    code: 'ALABS-ADV-ADAPTERS',
    name: 'A://Labs ADV — Provider Adapters & Unified APIs',
    description: 'Abstraction layers, rate limiting, failover patterns, and integrating external APIs into Allternit.',
  },
];

async function main() {
  if (!CANVAS_EMAIL || !CANVAS_PASSWORD) {
    console.error('Please set CANVAS_EMAIL and CANVAS_PASSWORD environment variables.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Disable service workers
  await page.context().addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
      });
    }
  });

  console.log('Logging into Canvas...');
  await page.goto('https://canvas.instructure.com/login', { waitUntil: 'networkidle' });
  await page.waitForSelector('input#username', { timeout: 15000 });
  await page.fill('input#username', CANVAS_EMAIL);
  await page.fill('input#password', CANVAS_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/canvas\.instructure\.com/, { timeout: 30000 });
  console.log('Logged in.');

  const createdCourses: Array<{ code: string; id: string; url: string }> = [];

  for (const course of ADVANCED_COURSES) {
    console.log(`Creating ${course.code}...`);

    // Navigate to dashboard (where "Start a New Course" button lives)
    await page.evaluate(() => { window.location.href = 'https://canvas.instructure.com/'; });
    await page.waitForTimeout(6000);
    
    // Click "Start a New Course" button
    const startBtn = page.locator('text=Start a New Course').first();
    try {
      await startBtn.click({ timeout: 10000 });
    } catch {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('a, button')).find(el => el.textContent?.includes('Start a New Course'));
        (btn as HTMLElement)?.click();
      });
    }
    await page.waitForTimeout(5000);

    // Find all inputs and fill the first text one (course name)
    const inputs = await page.locator('input').all();
    console.log(`  Found ${inputs.length} inputs`);
    
    const textInputs = inputs.filter(async (input) => {
      const type = await input.getAttribute('type');
      return type === 'text';
    });
    
    if (inputs.length === 0) {
      console.error(`  ❌ No form appeared for ${course.code}`);
      continue;
    }
    
    // Fill course name (first text input)
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      if (type === 'text') {
        await input.fill(course.name);
        break;
      }
    }
    
    // Look for a second text input for course code
    let filledCode = false;
    for (const input of inputs) {
      const type = await input.getAttribute('type');
      const placeholder = await input.getAttribute('placeholder');
      if (type === 'text' && !filledCode && placeholder?.toLowerCase().includes('code')) {
        await input.fill(course.code);
        filledCode = true;
      }
    }

    // Submit - look for Create button
    const submitBtn = page.locator('button:has-text("Create")').first();
    await submitBtn.click();
    await page.waitForTimeout(6000);

    // Extract course ID from URL
    const url = page.url();
    const match = url.match(/\/courses\/(\d+)/);
    if (match) {
      const courseId = match[1];
      createdCourses.push({ code: course.code, id: courseId, url });
      console.log(`  ✅ Created ${course.code}: ${courseId}`);

      // Update public description
      await page.goto(`https://canvas.instructure.com/courses/${courseId}/settings`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
      
      const descInput = page.locator('textarea[name*="public_description"]').first();
      if (await descInput.count() > 0) {
        await descInput.fill(course.description);
      }
      
      const publicCheckbox = page.locator('input[name*="is_public"]').first();
      if (await publicCheckbox.count() > 0) {
        await publicCheckbox.check();
      }
      
      const updateBtn = page.locator('button:has-text("Update")').first();
      await updateBtn.click();
      await page.waitForTimeout(3000);
      console.log(`  ✅ Updated settings for ${course.code}`);
    } else {
      console.error(`  ❌ Could not extract course ID for ${course.code}. URL: ${url}`);
    }
  }

  await browser.close();

  console.log('\n📚 Created Courses:');
  for (const c of createdCourses) {
    console.log(`  ${c.code}: ${c.url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
