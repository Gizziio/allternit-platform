import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 420, height: 700 } })

  page.on('console', (msg) => console.log('[PAGE]', msg.text()))
  page.on('pageerror', (err) => console.log('[ERROR]', err.message))

  // Load REAL Office.js from Microsoft CDN — no mocks, no stubs
  // Inject only the API config via localStorage
  await page.addInitScript(() => {
    const config = {
      apiKey: 'ollama',
      baseURL: 'http://localhost:11433',
      model: 'qwen2.5:0.5b',
      language: 'en',
      maxSteps: 5,
    }
    localStorage.setItem('allternit-office-config', JSON.stringify(config))
  })

  await page.goto('http://localhost:3000/src/taskpane/index.html')
  await page.waitForTimeout(4000)

  // Check if Office.onReady fired and what context we got
  const officeState = await page.evaluate(() => {
    return {
      hasOffice: typeof Office !== 'undefined',
      hasContext: !!Office?.context,
      host: Office?.context?.host ?? 'none',
      hostType: Office?.context?.host?.name ?? 'none',
      platform: Office?.context?.platform?.id ?? 'none',
    }
  })
  console.log('Office.js state:', officeState)

  // Check if React rendered
  const rootState = await page.evaluate(() => {
    const root = document.getElementById('root')
    return root ? { childCount: root.childNodes.length, hasContent: root.innerHTML.length > 100 } : 'no root'
  })
  console.log('Root state:', rootState)

  await page.screenshot({ path: 'test-results-real/real-officejs.png' })
  console.log('Screenshot saved')

  await browser.close()
}
main().catch(console.error)
