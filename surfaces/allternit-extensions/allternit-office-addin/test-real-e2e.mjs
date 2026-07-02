/**
 * REAL end-to-end test using:
 * - Real Ollama LLM (qwen2.5:0.5b)
 * - Real allternit-api backend (:8013)
 * - Real add-in code (:3000)
 * - Real browser (Playwright)
 *
 * Only mock: Office.js (because we can't open real Microsoft Office in ACI)
 */

import { chromium } from 'playwright'

const ADDIN_URL = 'http://localhost:3000/src/taskpane/index.html'
const OLLAMA_URL = 'http://localhost:11433'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 420, height: 700 } })

  page.on('console', (msg) => console.log('[PAGE]', msg.text()))
  page.on('pageerror', (err) => console.log('[ERROR]', err.message))

  // Block real Office.js CDN
  await page.route('https://appsforoffice.microsoft.com/lib/1/hosted/office.js', (route) => {
    route.fulfill({ status: 200, body: '// mocked office.js', contentType: 'text/javascript' })
  })

  // Inject Office mock + Ollama config BEFORE page scripts run
  await page.addInitScript((ollamaUrl) => {
    window.Office = {
      context: {
        host: 'PowerPoint',
        platform: { id: 'OfficeOnline' },
      },
      HostType: { Excel: 'Excel', Word: 'Word', PowerPoint: 'PowerPoint' },
      onReady: (cb) => {
        if (cb) setTimeout(cb, 0)
        return Promise.resolve()
      },
    }
    window.Excel = { run: async (fn) => fn({ workbook: { worksheets: { getActiveWorksheet: () => ({}) } } }) }
    window.Word = { run: async (fn) => fn({ document: { body: {}, getSelection: () => ({}) } }) }
    window.PowerPoint = {
      run: async (fn) => fn({
        presentation: {
          load: () => {},
          slides: { load: () => {}, items: [] },
        },
      }),
      PlaceholderType: { title: 'title', centeredTitle: 'centeredTitle', body: 'body', object: 'object' },
    }

    const config = {
      apiKey: 'ollama',
      baseURL: ollamaUrl,
      model: 'qwen2.5:0.5b',
      language: 'en',
      maxSteps: 5,
    }
    localStorage.setItem('allternit-office-config', JSON.stringify(config))
  }, OLLAMA_URL)

  await page.goto(ADDIN_URL)
  await page.waitForTimeout(2500)

  // Screenshot 1: Empty state
  await page.screenshot({ path: 'test-results-real/01-empty-state.png' })
  console.log('[RealTest] 01-empty-state.png')

  // Type task and submit
  const textarea = await page.locator('textarea')
  await textarea.fill('Add a slide titled Q3 Results')
  await textarea.press('Enter')

  // Wait for streaming text / tool calls to appear (Ollama can be slow)
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'test-results-real/02-streaming-or-toolcall.png' })
  console.log('[RealTest] 02-streaming-or-toolcall.png')

  // Wait a bit more for tool execution to progress
  await page.waitForTimeout(8000)
  await page.screenshot({ path: 'test-results-real/03-tool-execution.png' })
  console.log('[RealTest] 03-tool-execution.png')

  // Auto-approve any pending tools
  let approvalsRemaining = true
  let approvalCount = 0
  while (approvalsRemaining) {
    const approveBtn = page.locator('button:has-text("Approve")')
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click()
      approvalCount++
      await page.waitForTimeout(500)
    } else {
      approvalsRemaining = false
    }
  }
  console.log(`[RealTest] Auto-approved ${approvalCount} tool(s)`)

  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'test-results-real/04-after-execution.png' })
  console.log('[RealTest] 04-after-execution.png')

  // Wait for final response
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'test-results-real/05-final-result.png' })
  console.log('[RealTest] 05-final-result.png')

  console.log('[RealTest] All screenshots in test-results-real/')

  await browser.close()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
