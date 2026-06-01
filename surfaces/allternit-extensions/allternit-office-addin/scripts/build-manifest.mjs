import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')
const templatePath = resolve(rootDir, 'manifest.template.xml')
const outputPath = resolve(rootDir, 'manifest.xml')
const certDir = resolve(homedir(), '.office-addin-dev-certs')

function resolveDefaultAppBaseUrl() {
  const hasDevCerts =
    existsSync(resolve(certDir, 'localhost.key')) &&
    existsSync(resolve(certDir, 'localhost.crt')) &&
    existsSync(resolve(certDir, 'ca.crt'))

  return hasDevCerts ? 'https://localhost:3000' : 'http://localhost:3000'
}

const defaults = {
  APP_BASE_URL: resolveDefaultAppBaseUrl(),
  PLATFORM_URL: 'http://localhost:3013',
  SUPPORT_URL: 'https://allternit.com',
  DISPLAY_NAME: 'Allternit',
  DESCRIPTION: 'AI-powered task pane for Excel, PowerPoint, and Word',
  PROVIDER_NAME: 'Allternit',
}

function normalizeBaseUrl(raw) {
  const value = (raw || defaults.APP_BASE_URL).trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`ALLTERNIT_OFFICE_APP_BASE_URL must be absolute. Received: ${value}`)
  }
  return value
}

function normalizePlatformUrl(raw) {
  const value = (raw || defaults.PLATFORM_URL).trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(value)) {
    throw new Error(`ALLTERNIT_PLATFORM_URL must be absolute. Received: ${value}`)
  }
  return value
}

const appBaseUrl = normalizeBaseUrl(process.env.ALLTERNIT_OFFICE_APP_BASE_URL)
const platformUrl = normalizePlatformUrl(process.env.ALLTERNIT_PLATFORM_URL)

// GUID: stable per deployment. Use env var for production, generate random for dev.
const appGuid = process.env.ALLTERNIT_OFFICE_APP_GUID || randomUUID()

const replacements = {
  APP_BASE_URL: appBaseUrl,
  APP_GUID: appGuid,
  PLATFORM_URL: platformUrl,
  SUPPORT_URL: (process.env.ALLTERNIT_SUPPORT_URL || defaults.SUPPORT_URL).trim(),
  DISPLAY_NAME: (process.env.ALLTERNIT_OFFICE_DISPLAY_NAME || defaults.DISPLAY_NAME).trim(),
  DESCRIPTION: (process.env.ALLTERNIT_OFFICE_DESCRIPTION || defaults.DESCRIPTION).trim(),
  PROVIDER_NAME: (process.env.ALLTERNIT_OFFICE_PROVIDER_NAME || defaults.PROVIDER_NAME).trim(),
}

const template = readFileSync(templatePath, 'utf8')
const rendered = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
  if (!(key in replacements)) {
    throw new Error(`Missing manifest replacement for ${key}`)
  }
  return replacements[key]
})

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, rendered, 'utf8')

console.log(`[office-manifest] wrote ${outputPath}`)
console.log(`[office-manifest] APP_BASE_URL=${appBaseUrl}`)
console.log(`[office-manifest] PLATFORM_URL=${platformUrl}`)
console.log(`[office-manifest] APP_GUID=${appGuid}`)
