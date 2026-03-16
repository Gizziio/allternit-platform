const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  
  try {
    await page.goto('http://127.0.0.1:5177', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    
    // Click Agent Hub
    await page.click('text=Agent Hub');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'agent_hub_after_click.png' });
    console.log('Screenshot saved to agent_hub_after_click.png');
    
    // Look for agent cards and click the first one if exists
    const agentCards = await page.$$('[data-agent-card], .agent-card, [role="button"]:has-text("Big Pickle"), button:has-text("Big Pickle")');
    if (agentCards.length > 0) {
      await agentCards[0].click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'agent_after_click.png' });
      console.log('Agent screenshot saved to agent_after_click.png');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  
  await browser.close();
})();
