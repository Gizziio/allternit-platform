import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false, args: ['--remote-debugging-port=9226'] });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

const errors = [];
page.on('console', msg => {
  const text = msg.text();
  console.log('BROWSER:', text);
  if (text.includes('ERROR') || text.includes('error') || text.includes('Error')) {
    errors.push(text);
  }
});

page.on('pageerror', err => {
  console.log('PAGE ERROR:', err.message);
  errors.push(`PAGE ERROR: ${err.message}`);
});

await page.goto('http://localhost:5177');
await page.waitForTimeout(4000);

// Navigate to Agent Hub
console.log('=== Clicking Agent Hub ===');
await page.click('text=Agent Hub');
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/macbook/test_step1_hub.png' });

// Step 1: Welcome - Click Get Started
console.log('=== Step 1: Welcome - Clicking Get Started ===');
await page.click('text=Get Started');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/test_step2_identity.png' });

// Step 2: Identity - Fill form
console.log('=== Step 2: Identity - Filling form ===');
await page.fill('input#name', 'TestAgent');
await page.fill('textarea#description', 'A test agent for debugging the creation flow');
await page.waitForTimeout(500);

// Click Worker type
console.log('=== Clicking Worker type ===');
const workerCard = await page.locator('button', { hasText: /Worker/ }).first();
await workerCard.click();
await page.waitForTimeout(500);
await page.screenshot({ path: '/Users/macbook/test_step2_filled.png' });

// Click Next
console.log('=== Clicking Next to Personality ===');
await page.click('button:has-text("Next:")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/test_step3_personality.png' });

// Step 3: Personality - adjust sliders
console.log('=== Step 3: Personality - Adjusting sliders ===');
const sliders = await page.locator('[role="slider"]').all();
if (sliders.length > 0) {
  await sliders[0].click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: '/Users/macbook/test_step3_adjusted.png' });

// Click Next
console.log('=== Clicking Next to Character ===');
await page.click('button:has-text("Next:")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/test_step4_character.png' });

// Step 4: Character - Select a setup
console.log('=== Step 4: Character - Selecting Creative setup ===');
const creativeCard = await page.locator('button', { hasText: /Creative/ }).first();
await creativeCard.click();
await page.waitForTimeout(500);

// Select a specialty skill
console.log('=== Selecting specialty skill ===');
const skillBadge = await page.locator('span', { hasText: /story|brand|campaign/i }).first();
if (skillBadge) {
  await skillBadge.click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: '/Users/macbook/test_step4_filled.png' });

// Click Next
console.log('=== Clicking Next to Avatar ===');
await page.click('button:has-text("Next:")');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/Users/macbook/test_step5_avatar.png' });

// Step 5: Avatar - Click through tabs
console.log('=== Step 5: Avatar - Testing tabs ===');

// Try Body tab
const bodyTab = await page.locator('button', { hasText: /Body/i }).first();
if (bodyTab) {
  await bodyTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/Users/macbook/test_step5_body_tab.png' });
}

// Try Eyes tab
const eyesTab = await page.locator('button', { hasText: /Eyes/i }).first();
if (eyesTab) {
  await eyesTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/Users/macbook/test_step5_eyes_tab.png' });
}

// Try Colors tab
const colorsTab = await page.locator('button', { hasText: /Colors/i }).first();
if (colorsTab) {
  await colorsTab.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/Users/macbook/test_step5_colors_tab.png' });
}

// Try Randomize button
console.log('=== Clicking Randomize ===');
const randomizeBtn = await page.locator('button', { hasText: /Randomize/i }).first();
if (randomizeBtn) {
  await randomizeBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/Users/macbook/test_step5_randomized.png' });
}

// Click Next to Runtime
console.log('=== Clicking Next to Runtime ===');
await page.click('button:has-text("Next:")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/test_step6_runtime.png' });

// Step 6: Runtime - Test capabilities
console.log('=== Step 6: Runtime - Testing capabilities ===');
const capabilityBadge = await page.locator('span', { hasText: /planning|code-generation|memory/i }).first();
if (capabilityBadge) {
  await capabilityBadge.click();
  await page.waitForTimeout(300);
}
await page.screenshot({ path: '/Users/macbook/test_step6_capabilities.png' });

// Click Next to Workspace
console.log('=== Clicking Next to Workspace ===');
await page.click('button:has-text("Next:")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/test_step7_workspace.png' });

// Step 7: Workspace
console.log('=== Step 7: Workspace ===');
await page.screenshot({ path: '/Users/macbook/test_step7_workspace_full.png' });

// Click Next to Review
console.log('=== Clicking Next to Review ===');
await page.click('button:has-text("Next:")');
await page.waitForTimeout(1000);
await page.screenshot({ path: '/Users/macbook/test_step8_review.png' });

// Step 8: Review - Try to create agent
console.log('=== Step 8: Review - Clicking Create Agent ===');
const createBtn = await page.locator('button', { hasText: /Create Agent/i }).first();
if (createBtn) {
  await createBtn.click();
  console.log('=== Create Agent button clicked ===');
  await page.waitForTimeout(7000); // Wait for forge animation
  await page.screenshot({ path: '/Users/macbook/test_step8_creating.png' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/Users/macbook/test_step8_complete.png' });
}

console.log('\n=== ERRORS FOUND ===');
errors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
if (errors.length === 0) console.log('No errors found!');

await browser.close();
