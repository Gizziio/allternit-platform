import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const page = browser.contexts()[0]?.pages()[0];
if (!page) { console.error('No page'); process.exit(1); }

await page.goto('http://localhost:3013/shell?view=aci');
await page.waitForTimeout(1500);

const aciTab = page.locator('button', { hasText: 'ACI' }).first();
if (await aciTab.isVisible().catch(() => false)) {
  await aciTab.click();
  await page.waitForTimeout(800);
}

// Open a web tab so the browser chrome renders
const googleShortcut = page.locator('button', { hasText: 'Google' }).first();
if (await googleShortcut.isVisible().catch(() => false)) {
  await googleShortcut.click();
  await page.waitForTimeout(1200);
}

// Inject a fake captured contract
const contractId = await page.evaluate(() => {
  const contract = {
    id: 'test-contract-' + Date.now(),
    domain: 'api.example.com',
    derived_at: new Date().toISOString(),
    endpoints: [
      { id: 'ep-1', method: 'GET', url: 'https://api.example.com/users', host: 'api.example.com', path: '/users', path_template: '/users', summary: 'List users', query_params: [], path_params: [], headers: [], body_params: [], status_code: 200, hit_count: 1 }
    ]
  };
  const key = 'allternit:har-derived-contracts';
  const existing = JSON.parse(localStorage.getItem(key) || '[]');
  localStorage.setItem(key, JSON.stringify([contract, ...existing]));
  return contract.id;
});
console.log('injected_contract:', contractId);

// Reload to pick up the injected contract
await page.goto('http://localhost:3013/shell?view=aci');
await page.waitForTimeout(1500);
if (await aciTab.isVisible().catch(() => false)) {
  await aciTab.click();
  await page.waitForTimeout(800);
}

// Open agent computer pane if not already open
const agentBtn = page.locator('button[title="Allternit Computer Agent — right-click for controls"]').first();
const paneOpen = await page.locator('button', { hasText: 'APIs' }).first().isVisible().catch(() => false);
if (!paneOpen && await agentBtn.isVisible().catch(() => false)) {
  await agentBtn.click();
  await page.waitForTimeout(500);
}

// Switch to Site APIs tab
const apisTab = page.locator('button', { hasText: 'APIs' }).first();
console.log('apis_tab_visible:', await apisTab.isVisible().catch(() => false));
if (await apisTab.isVisible().catch(() => false)) {
  await apisTab.click();
  await page.waitForTimeout(600);
}

// Select the contract
const contractBtn = page.locator('button', { hasText: /1 endpoint/ }).first();
if (await contractBtn.isVisible().catch(() => false)) {
  await contractBtn.click();
  await page.waitForTimeout(400);
}

const publishBtn = page.locator('button', { hasText: 'Publish as skill' }).first();
console.log('publish_btn_visible:', await publishBtn.isVisible().catch(() => false));

if (await publishBtn.isVisible().catch(() => false)) {
  await publishBtn.click();
  await page.waitForTimeout(300);

  const nameInput = page.locator('input[placeholder*="API workflow"]').first();
  const descInput = page.locator('textarea[placeholder*="What this workflow does"]').first();
  console.log('skill_name_input_visible:', await nameInput.isVisible().catch(() => false));
  console.log('skill_description_input_visible:', await descInput.isVisible().catch(() => false));

  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill('Test API Skill');
    await descInput.fill('A captured workflow for testing');
    await page.locator('button', { hasText: 'Publish skill' }).first().click();
    await page.waitForTimeout(500);
    console.log('success_toast_visible:', await page.locator('text=Published').first().isVisible().catch(() => false));
  }
}

// Verify skill persisted in localStorage
const skillPersisted = await page.evaluate(() => {
  const skills = JSON.parse(localStorage.getItem('allternit:api-captured-skills') || '[]');
  return skills.some((s) => s.name === 'Test API Skill');
});
console.log('skill_persisted:', skillPersisted);

await browser.close();
