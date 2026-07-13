import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const template = readFileSync(resolve(rootDir, 'manifest.host.template.xml'), 'utf8')
const outputDir = resolve(rootDir, 'manifests')
const certDir = resolve(homedir(), '.office-addin-dev-certs')

const HOSTS = {
  word: {
    label: 'Word',
    officeName: 'Document',
    guid: 'b765c354-dc5c-4b98-9f54-320e110c42d1',
    description: 'Allternit writing, review, and research tools for Microsoft Word',
  },
  excel: {
    label: 'Excel',
    officeName: 'Workbook',
    guid: 'b765c354-dc5c-4b98-9f54-320e110c42d2',
    description: 'Allternit analysis, modeling, and workbook tools for Microsoft Excel',
  },
  powerpoint: {
    label: 'PowerPoint',
    officeName: 'Presentation',
    guid: 'b765c354-dc5c-4b98-9f54-320e110c42d3',
    description: 'Allternit narrative, design, and slide tools for Microsoft PowerPoint',
  },
}

function defaultBaseUrl() {
  const hasCerts = ['localhost.key', 'localhost.crt', 'ca.crt'].every((file) => existsSync(resolve(certDir, file)))
  return hasCerts ? 'https://localhost:3000' : 'http://localhost:3000'
}

function absoluteUrl(value, name) {
  const normalized = value.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(normalized)) throw new Error(`${name} must be an absolute HTTP(S) URL`)
  return normalized
}

const appBaseUrl = absoluteUrl(process.env.ALLTERNIT_OFFICE_APP_BASE_URL || defaultBaseUrl(), 'ALLTERNIT_OFFICE_APP_BASE_URL')
const platformUrl = absoluteUrl(process.env.ALLTERNIT_PLATFORM_URL || 'http://localhost:3013', 'ALLTERNIT_PLATFORM_URL')
const supportUrl = absoluteUrl(process.env.ALLTERNIT_SUPPORT_URL || 'https://allternit.com', 'ALLTERNIT_SUPPORT_URL')
const version = process.env.ALLTERNIT_OFFICE_VERSION || '1.0.0.0'

mkdirSync(outputDir, { recursive: true })

for (const [key, host] of Object.entries(HOSTS)) {
  const replacements = {
    APP_BASE_URL: appBaseUrl,
    APP_GUID: process.env[`ALLTERNIT_OFFICE_${key.toUpperCase()}_GUID`] || host.guid,
    DESCRIPTION: host.description,
    HOST_KEY: key,
    HOST_LABEL: host.label,
    HOST_NAME: host.officeName,
    PLATFORM_URL: platformUrl,
    SUPPORT_URL: supportUrl,
    TASKPANE_URL: `${appBaseUrl}/src/taskpane/index.html?product=${key}`,
    VERSION: version,
  }
  const rendered = template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, token) => {
    if (!(token in replacements)) throw new Error(`Missing manifest replacement for ${token}`)
    return replacements[token]
  })
  writeFileSync(resolve(outputDir, `${key}.xml`), rendered, 'utf8')
}

// Keep the historical path as a Word alias for existing local tooling.
writeFileSync(resolve(rootDir, 'manifest.xml'), readFileSync(resolve(outputDir, 'word.xml')), 'utf8')
console.log(`[office-manifest] wrote separate Word, Excel, and PowerPoint manifests to ${outputDir}`)
