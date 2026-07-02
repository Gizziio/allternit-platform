import { chromium } from 'playwright'

const ADDIN_URL = 'http://localhost:3000/src/taskpane/index.html'

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 420, height: 700 } })

  page.on('console', (msg) => console.log('[PAGE]', msg.text()))
  page.on('pageerror', (err) => console.log('[ERROR]', err.message))

  // Only inject API config — Office.js loads from Microsoft CDN for real
  await page.addInitScript(() => {
    try {
      const config = {
        apiKey: 'ollama',
        baseURL: 'http://localhost:11433',
        model: 'qwen2.5:0.5b',
        language: 'en',
        maxSteps: 5,
      }
      localStorage.setItem('allternit-office-config', JSON.stringify(config))
    } catch (e) {
      console.log('localStorage blocked:', e.message)
    }
  })

  await page.goto(ADDIN_URL)
  await page.waitForTimeout(4000)

  // Screenshot 1: Empty state with real Office.js
  await page.screenshot({ path: 'test-results-real/01-real-officejs-empty.png' })
  console.log('[Real] 01-real-officejs-empty.png')

  // Type task and submit
  const textarea = await page.locator('textarea')
  await textarea.fill('Add a slide titled Q3 Results')
  await textarea.press('Enter')

  // Wait for model response
  await page.waitForTimeout(12000)
  await page.screenshot({ path: 'test-results-real/02-real-officejs-response.png' })
  console.log('[Real] 02-real-officejs-response.png')

  // Wait for tool execution / approval
  await page.waitForTimeout(10000)
  await page.screenshot({ path: 'test-results-real/03-real-officejs-tool.png' })
  console.log('[Real] 03-real-officejs-tool.png')

  // Auto-approve
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
  console.log(`[Real] Auto-approved ${approvalCount} tool(s)`)

  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'test-results-real/04-real-officejs-final.png' })
  console.log('[Real] 04-real-officejs-final.png')

  console.log('[Real] All screenshots in test-results-real/')
  await browser.close()
}
main().catch(console.error)
