import { chromium } from 'playwright';

const CDP_URL = 'http://127.0.0.1:9222';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0] || await browser.newContext();
  const page = context.pages()[0] || await context.newPage();

  await page.goto('http://localhost:3013/shell');
  await page.waitForTimeout(2000);

  // Open model picker from chat composer.
  const modelSelector = await page.locator('[data-testid="model-selector"], button:has-text("Select Model"), [title*="Select model"]').first();
  console.log('Model selector trigger count:', await modelSelector.count());

  // Try clicking the composer model selector if present.
  if (await modelSelector.count() > 0) {
    await modelSelector.click();
  } else {
    // Fallback: look for any button that shows the current model in the chat bottom bar.
    const bottomBarButtons = await page.locator('button').filter({ hasText: /gpt|claude|kimi|qwen|local|omlx|Allternit/i }).all();
    console.log('Bottom bar model buttons:', bottomBarButtons.length);
    if (bottomBarButtons.length > 0) {
      await bottomBarButtons[0].click();
    }
  }

  await page.waitForTimeout(800);

  // Check for provider names in the picker dialog.
  const hasOmlx = await page.locator('text=omlx').count() > 0;
  const hasAllternitLocal = await page.locator('text=Allternit Local Engine').count() > 0;
  const hasSelectRuntime = await page.locator('text=Select Runtime').count() > 0;

  console.log('Model picker open (Select Runtime):', hasSelectRuntime);
  console.log('omlx provider visible:', hasOmlx);
  console.log('Allternit Local Engine visible:', hasAllternitLocal);

  // Close picker if open by pressing Escape.
  if (hasSelectRuntime) {
    await page.keyboard.press('Escape');
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
