import { test, expect } from '@playwright/test'

test('mounts the real editor: ribbon and a paginated blank document', async ({ page }) => {
  await page.goto('/')

  // the vendored ribbon (rebranded entry point proves the Allternit skin)
  await expect(page.locator('.ribbon')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.ribbon-tab-file')).toBeVisible()
  await expect(page.locator('text=Allternit AI').first()).toBeVisible()

  // the app boots straight into a blank, paginated document
  await expect(page.locator('.doc-page').first()).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.ProseMirror')).toBeVisible()
})

test('typing + Ctrl+S exports a .docx as a blob download', async ({ page }) => {
  await page.goto('/')

  const editor = page.locator('.ProseMirror')
  await expect(editor).toBeVisible({ timeout: 30000 })
  await editor.click()
  await page.keyboard.type('Hello from Allternit Docs')

  const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
  await page.keyboard.press('Control+s')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/\.docx$/)
})
