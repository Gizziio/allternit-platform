import { chromium } from 'playwright'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  page.on('console', (msg) => console.log('[PAGE]', msg.text()))

  await page.route('https://appsforoffice.microsoft.com/lib/1/hosted/office.js', (route) => {
    route.fulfill({ status: 200, body: '// mocked', contentType: 'text/javascript' })
  })

  await page.addInitScript(() => {
    window.Office = {
      context: { host: 'PowerPoint', platform: { id: 'OfficeOnline' } },
      HostType: { Excel: 'Excel', Word: 'Word', PowerPoint: 'PowerPoint' },
      onReady: (cb) => { if (cb) setTimeout(cb, 0); return Promise.resolve() },
    }
    const config = {
      apiKey: 'ollama',
      baseURL: 'http://localhost:11433',
      model: 'qwen2.5:0.5b',
      language: 'en',
      maxSteps: 5,
    }
    localStorage.setItem('allternit-office-config', JSON.stringify(config))

    const origFetch = window.fetch
    window.fetch = async (...args) => {
      console.log('[FETCH] Request:', args[0], 'method:', args[1]?.method)
      try {
        const res = await origFetch(...args)
        console.log('[FETCH] Response:', res.status, 'hasBody:', !!res.body)
        return res
      } catch (e) {
        console.log('[FETCH] Error:', e.message)
        throw e
      }
    }
  })

  await page.goto('http://localhost:3000/src/taskpane/index.html')
  await page.waitForTimeout(1500)

  const textarea = await page.locator('textarea')
  await textarea.fill('Say hello')
  await textarea.press('Enter')

  await page.waitForTimeout(10000)
  await page.screenshot({ path: 'test-results-real/debug-proxy.png' })

  await browser.close()
}
main().catch(console.error)
