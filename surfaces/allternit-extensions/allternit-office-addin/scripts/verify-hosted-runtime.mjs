const rawBaseUrl = process.argv.slice(2).find((argument) => /^https?:\/\//.test(argument)) || process.env.ALLTERNIT_OFFICE_APP_BASE_URL
if (!rawBaseUrl) {
  console.error('Usage: pnpm test:hosted -- https://host.example/office-addins')
  process.exit(2)
}

const baseUrl = rawBaseUrl.replace(/\/+$/, '')
const products = {
  word: { host: 'Document', forbidden: ['Workbook', 'Presentation'] },
  excel: { host: 'Workbook', forbidden: ['Document', 'Presentation'] },
  powerpoint: { host: 'Presentation', forbidden: ['Document', 'Workbook'] },
}
const failures = []

async function fetchText(path) {
  const url = `${baseUrl}/${path.replace(/^\/+/, '')}`
  const response = await fetch(url, { redirect: 'follow' })
  const text = await response.text()
  if (!response.ok) failures.push(`${url} returned HTTP ${response.status}`)
  return { url, response, text }
}

const taskpane = await fetchText('src/taskpane/index.html?product=word')
const taskpaneType = taskpane.response.headers.get('content-type') || ''
if (!taskpaneType.includes('text/html')) failures.push(`${taskpane.url} must return text/html, received ${taskpaneType || 'no content type'}`)
if (!taskpane.text.includes('appsforoffice.microsoft.com/lib/1/hosted/office.js')) failures.push(`${taskpane.url} is not an Office task pane (Office.js marker missing)`)
if (taskpane.text.includes('/_next/static/')) failures.push(`${taskpane.url} returned the platform SPA fallback instead of the Office runtime`)

const assetPaths = [...taskpane.text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1])
for (const assetPath of assetPaths) {
  const assetUrl = new URL(assetPath, taskpane.url).toString()
  const response = await fetch(assetUrl)
  if (!response.ok) failures.push(`${assetUrl} returned HTTP ${response.status}`)
}

const ids = new Set()
for (const [product, expectation] of Object.entries(products)) {
  const manifest = await fetchText(`manifests/${product}.xml`)
  const contentType = manifest.response.headers.get('content-type') || ''
  if (!contentType.includes('xml') && !contentType.includes('text/plain')) failures.push(`${manifest.url} must return XML, received ${contentType || 'no content type'}`)
  if (!manifest.text.trimStart().startsWith('<?xml')) failures.push(`${manifest.url} is not an XML manifest`)
  if (!manifest.text.includes(`<Host Name="${expectation.host}"`)) failures.push(`${manifest.url} does not declare ${expectation.host}`)
  for (const forbidden of expectation.forbidden) {
    if (manifest.text.includes(`<Host Name="${forbidden}"`)) failures.push(`${manifest.url} incorrectly also declares ${forbidden}`)
  }
  const id = manifest.text.match(/<Id>([^<]+)<\/Id>/)?.[1]
  if (!id) failures.push(`${manifest.url} has no stable ID`)
  else if (ids.has(id)) failures.push(`${manifest.url} reuses another product ID`)
  else ids.add(id)
  if (!manifest.text.includes(`?product=${product}`)) failures.push(`${manifest.url} does not target its product-specific task pane`)
  const resourceUrls = [...manifest.text.matchAll(/(?:IconUrl|HighResolutionIconUrl)[^>]+DefaultValue="([^"]+)"/g)].map((match) => match[1])
  for (const resourceUrl of resourceUrls) {
    const response = await fetch(resourceUrl)
    const resourceType = response.headers.get('content-type') || ''
    if (!response.ok) failures.push(`${resourceUrl} returned HTTP ${response.status}`)
    else if (!resourceType.startsWith('image/')) failures.push(`${resourceUrl} must return an image, received ${resourceType || 'no content type'}`)
  }
}

if (failures.length) {
  console.error(`Hosted Office runtime verification failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Hosted Office runtime verified: ${baseUrl}`)
console.log(`- task pane and ${assetPaths.length} built asset(s) reachable`)
console.log('- three distinct host manifests validated')
