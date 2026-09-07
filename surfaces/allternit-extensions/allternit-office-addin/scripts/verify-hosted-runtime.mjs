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

// Office task panes must load from a URL that returns 200 directly: Office on
// the web does not reliably follow redirects (e.g. Cloudflare Pages 308s
// directory-index requests), and a frame-blocking header on the response
// makes the pane refuse to render inside the host application.
async function verifyTaskpane(sourceLocation, product) {
  const response = await fetch(sourceLocation, { redirect: 'manual' })
  if (response.status >= 300 && response.status < 400) {
    failures.push(`${sourceLocation} (${product}) redirects with HTTP ${response.status} — SourceLocation must return 200 directly`)
    return null
  }
  const text = await response.text()
  if (!response.ok) failures.push(`${sourceLocation} (${product}) returned HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/html')) failures.push(`${sourceLocation} (${product}) must return text/html, received ${contentType || 'no content type'}`)
  if (response.headers.get('x-frame-options')?.toUpperCase() === 'DENY') failures.push(`${sourceLocation} (${product}) sends X-Frame-Options: DENY — the pane cannot load inside Office`)
  const csp = response.headers.get('content-security-policy') || ''
  if (/frame-ancestors\s+'none'/i.test(csp)) failures.push(`${sourceLocation} (${product}) CSP frame-ancestors 'none' — the pane cannot load inside Office`)
  if (!text.includes('appsforoffice.microsoft.com/lib/1/hosted/office.js')) failures.push(`${sourceLocation} (${product}) is not an Office task pane (Office.js marker missing)`)
  if (text.includes('/_next/static/')) failures.push(`${sourceLocation} (${product}) returned the platform SPA fallback instead of the Office runtime`)
  return text
}

const ids = new Set()
const taskpaneTexts = {}
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
  const sourceLocation = manifest.text.match(/<SourceLocation[^>]*DefaultValue="([^"]+)"/)?.[1]
  if (!sourceLocation) {
    failures.push(`${manifest.url} has no SourceLocation DefaultValue`)
  } else {
    const text = await verifyTaskpane(sourceLocation, product)
    if (text !== null) taskpaneTexts[product] = text
  }
  const resourceUrls = [...manifest.text.matchAll(/(?:IconUrl|HighResolutionIconUrl)[^>]+DefaultValue="([^"]+)"/g)].map((match) => match[1])
  for (const resourceUrl of resourceUrls) {
    const response = await fetch(resourceUrl)
    const resourceType = response.headers.get('content-type') || ''
    if (!response.ok) failures.push(`${resourceUrl} returned HTTP ${response.status}`)
    else if (!resourceType.startsWith('image/')) failures.push(`${resourceUrl} must return an image, received ${resourceType || 'no content type'}`)
  }
}

const assetPaths = [...new Set(Object.values(taskpaneTexts).flatMap((text) => [...text.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1])))]
for (const assetPath of assetPaths) {
  const assetUrl = new URL(assetPath, `${baseUrl}/src/taskpane/`).toString()
  const response = await fetch(assetUrl)
  if (!response.ok) failures.push(`${assetUrl} returned HTTP ${response.status}`)
}

if (failures.length) {
  console.error(`Hosted Office runtime verification failed (${failures.length}):`)
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

console.log(`Hosted Office runtime verified: ${baseUrl}`)
console.log(`- task pane (direct 200, no frame-blocking headers) and ${assetPaths.length} built asset(s) reachable`)
console.log('- three distinct host manifests validated')
