import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:9222';
const SHELL_URL = 'http://localhost:3013/shell';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.goto(SHELL_URL);
  await page.waitForTimeout(1500);

  // Click Model Lab in the left rail.
  const modelLabButton = page.locator('button', { hasText: 'Model Lab' }).first();
  if (await modelLabButton.count() > 0) {
    await modelLabButton.click();
    await page.waitForTimeout(1000);
  }

  const results = {};

  // Check top tabs.
  for (const tab of ['Engine', 'Catalog', 'Train', 'Studio', 'Cloud', 'Playground']) {
    const count = await page.locator('button', { hasText: tab }).count();
    results[`tab_${tab}`] = count > 0;
  }

  // Check Engine tab content.
  results.engine_header = await page.locator('text=Telemetry, local cache, runtimes').count() > 0;
  results.engine_add_to_brain = await page.locator('text=Add Engine to Brain').count() > 0;

  // Click Catalog tab.
  const catalogTab = page.locator('button', { hasText: 'Catalog' }).first();
  if (await catalogTab.count() > 0) {
    await catalogTab.click();
    await page.waitForTimeout(500);
  }

  results.catalog_header = await page.locator('text=Discover open-weights recipes').count() > 0;
  results.catalog_chip_filters = await page.locator('button', { hasText: 'Fine-tuning' }).count() > 0;

  // Click Discover sub-tab if exists.
  const discoverSubTab = page.locator('button', { hasText: 'Discover' }).first();
  if (await discoverSubTab.count() > 0) {
    await discoverSubTab.click();
    await page.waitForTimeout(500);
  }

  results.discover_hero = await page.locator('text=Discover open-weights recipes').count() > 0;

  // Click Catalog sub-tab and search.
  const catalogSubTab = page.locator('button', { hasText: 'Catalog' }).nth(1);
  if (await catalogSubTab.count() > 0) {
    await catalogSubTab.click();
    await page.waitForTimeout(500);
  }

  const searchInput = page.locator('input[placeholder*="Hugging Face"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.fill('llama');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
  }

  results.catalog_cards = await page.locator('text=llama').count() > 0;
  results.official_badge = await page.locator('text=Official').count() > 0;

  // Click Studio tab.
  const studioTab = page.locator('button', { hasText: 'Studio' }).first();
  if (await studioTab.count() > 0) {
    await studioTab.click();
    await page.waitForTimeout(500);
  }
  results.studio_header = await page.locator('text=Local Studio').count() > 0;

  console.log(JSON.stringify(results, null, 2));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
