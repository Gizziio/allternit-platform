/**
 * API Capture — Background Service Worker Module
 *
 * Provides a browser-extension fallback for capturing network traffic and
 * producing a HAR JSON string that the Allternit backend can ingest.
 *
 * Capture strategy:
 *   1. Primary: chrome.debugger attached to the target tab. Enables the
 *      Chrome DevTools Protocol Network domain and records
 *      requestWillBeSent / responseReceived / loadingFinished events.
 *      Response bodies are fetched via Network.getResponseBody for completed
 *      XHR/Fetch requests.
 *   2. Fallback: chrome.webRequest listeners when debugger is unavailable,
 *      unsupported, or permission is denied.
 */

interface HarHeader {
  name: string
  value: string
}

interface HarCookie {
  name: string
  value: string
}

interface HarQueryString {
  name: string
  value: string
}

interface HarPostData {
  mimeType: string
  text: string
}

interface HarRequest {
  method: string
  url: string
  httpVersion: string
  headers: HarHeader[]
  queryString: HarQueryString[]
  cookies: HarCookie[]
  headersSize: number
  bodySize: number
  postData?: HarPostData
}

interface HarResponse {
  status: number
  statusText: string
  httpVersion: string
  headers: HarHeader[]
  cookies: HarCookie[]
  content: {
    size: number
    mimeType: string
    text?: string
  }
  redirectURL: string
  headersSize: number
  bodySize: number
}

interface HarEntry {
  startedDateTime: string
  time: number
  request: HarRequest
  response: HarResponse
  cache: Record<string, unknown>
  timings: {
    blocked: number
    dns: number
    connect: number
    send: number
    wait: number
    receive: number
    ssl: number
  }
}

interface HarLog {
  version: string
  creator: { name: string; version: string }
  entries: HarEntry[]
}

interface Har {
  log: HarLog
}

interface PendingEntry {
  requestId: string
  entry: Partial<HarEntry>
  request?: chrome.debugger.Request
  response?: chrome.debugger.Response
  resourceType?: string
  hasBody?: boolean
}

type CaptureMode = 'debugger' | 'webRequest'

interface CaptureSession {
  sessionId: string
  tabId: number
  filterUrls?: string[]
  mode: CaptureMode
  entries: HarEntry[]
  pending: Map<string, PendingEntry>
  debuggerDetached?: boolean
  cleanup: () => void
}

const sessions = new Map<string, CaptureSession>()

function isDebuggerAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.debugger
}

function isWebRequestAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.webRequest
}

function parseUrl(url: string): URL | undefined {
  try {
    return new URL(url)
  } catch {
    return undefined
  }
}

function objectToHarHeaders(obj?: Record<string, string>): HarHeader[] {
  if (!obj) return []
  return Object.entries(obj).map(([name, value]) => ({ name, value: String(value ?? '') }))
}

function parseQueryString(url: string): HarQueryString[] {
  const parsed = parseUrl(url)
  if (!parsed) return []
  return Array.from(parsed.searchParams.entries()).map(([name, value]) => ({ name, value }))
}

function matchesFilter(url: string, filterUrls?: string[]): boolean {
  if (!filterUrls || filterUrls.length === 0) return true
  return filterUrls.some((pattern) => {
    if (pattern.includes('*') || pattern.includes('?')) {
      const regex = new RegExp('^' + pattern.split(/\*+/).map(escapeRegex).join('.*') + '$')
      return regex.test(url)
    }
    return url.includes(pattern)
  })
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildHar(entries: HarEntry[]): Har {
  const manifest = chrome.runtime.getManifest()
  return {
    log: {
      version: '1.2',
      creator: {
        name: 'Allternit Extension API Capture',
        version: manifest.version ?? '1.0.0',
      },
      entries,
    },
  }
}

function makeBaseTimings(): HarEntry['timings'] {
  return {
    blocked: -1,
    dns: -1,
    connect: -1,
    send: -1,
    wait: -1,
    receive: -1,
    ssl: -1,
  }
}

/**
 * Start a capture session on the given tab.
 *
 * Tries chrome.debugger first, then falls back to chrome.webRequest if
 * debugger is unavailable. Returns a session id that must be passed to
 * stopCaptureSession.
 */
export async function startCaptureSession(
  tabId: number,
  filterUrls?: string[],
): Promise<string> {
  if (isDebuggerAvailable()) {
    try {
      return await startDebuggerCapture(tabId, filterUrls)
    } catch (err) {
      console.warn('[API Capture] debugger attach failed, falling back to webRequest', err)
    }
  }

  if (!isWebRequestAvailable()) {
    throw new Error('No capture backend available: chrome.debugger and chrome.webRequest are both unavailable')
  }

  return startWebRequestCapture(tabId, filterUrls)
}

/**
 * Stop the capture session, detach listeners, and return a HAR JSON string.
 */
export async function stopCaptureSession(sessionId: string): Promise<string> {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Capture session not found: ${sessionId}`)
  }

  session.cleanup()
  sessions.delete(sessionId)

  // Give in-flight response-body fetches a brief moment to finish.
  if (session.mode === 'debugger') {
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  return JSON.stringify(buildHar(session.entries))
}

/**
 * Returns true when a capture backend is available.
 */
export function isCaptureAvailable(): boolean {
  return isDebuggerAvailable() || isWebRequestAvailable()
}

// ─────────────────────────────────────────────────────────────────────────────
// chrome.debugger capture implementation
// ─────────────────────────────────────────────────────────────────────────────

async function startDebuggerCapture(tabId: number, filterUrls?: string[]): Promise<string> {
  const sessionId = crypto.randomUUID()
  const target = { tabId }

  await chrome.debugger.attach(target, '1.3')
  await chrome.debugger.sendCommand(target, 'Network.enable')

  const session: CaptureSession = {
    sessionId,
    tabId,
    filterUrls,
    mode: 'debugger',
    entries: [],
    pending: new Map(),
    cleanup: () => {
      removeDebuggerListeners()
      chrome.debugger.detach(target).catch(() => {})
    },
  }

  const requestWillBeSentHandler = (
    source: chrome.debugger.Debuggee,
    method: string,
    params?: Record<string, unknown>,
  ) => {
    if (source.tabId !== tabId) return
    if (method === 'Network.requestWillBeSent') {
      handleDebuggerRequestWillBeSent(session, params as chrome.debugger.RequestParams)
    } else if (method === 'Network.responseReceived') {
      handleDebuggerResponseReceived(session, params as chrome.debugger.ResponseParams)
    } else if (method === 'Network.loadingFinished') {
      void handleDebuggerLoadingFinished(session, params as chrome.debugger.LoadingFinishedParams)
    } else if (method === 'Network.loadingFailed') {
      handleDebuggerLoadingFailed(session, params as chrome.debugger.LoadingFailedParams)
    }
  }

  const detachHandler = (source: chrome.debugger.Debuggee) => {
    if (source.tabId !== tabId) return
    session.debuggerDetached = true
    sessions.delete(sessionId)
  }

  function removeDebuggerListeners() {
    chrome.debugger.onEvent.removeListener(requestWillBeSentHandler)
    chrome.debugger.onDetach.removeListener(detachHandler)
  }

  chrome.debugger.onEvent.addListener(requestWillBeSentHandler)
  chrome.debugger.onDetach.addListener(detachHandler)

  sessions.set(sessionId, session)
  return sessionId
}

function handleDebuggerRequestWillBeSent(
  session: CaptureSession,
  params: chrome.debugger.RequestParams,
): void {
  const request = params.request
  if (!matchesFilter(request.url, session.filterUrls)) return

  const parsed = parseUrl(request.url)
  const postData = request.hasPostData && request.postData
    ? { mimeType: request.headers?.['content-type']?.split(';')[0] ?? 'application/octet-stream', text: request.postData }
    : undefined

  const entry: Partial<HarEntry> = {
    startedDateTime: new Date((params.wallTime ?? Date.now() / 1000) * 1000).toISOString(),
    time: 0,
    request: {
      method: request.method,
      url: request.url,
      httpVersion: 'HTTP/1.1',
      headers: objectToHarHeaders(request.headers),
      queryString: parseQueryString(request.url),
      cookies: [],
      headersSize: -1,
      bodySize: postData ? new TextEncoder().encode(postData.text).length : 0,
      postData,
    },
    response: undefined,
    cache: {},
    timings: makeBaseTimings(),
  }

  session.pending.set(params.requestId, {
    requestId: params.requestId,
    entry,
    request,
    resourceType: (params as unknown as { type?: string }).type,
  })
}

function handleDebuggerResponseReceived(
  session: CaptureSession,
  params: chrome.debugger.ResponseParams,
): void {
  const pending = session.pending.get(params.requestId)
  if (!pending) return

  const response = params.response
  pending.response = response

  pending.entry.response = {
    status: response.status,
    statusText: response.statusText ?? '',
    httpVersion: response.protocol ?? 'HTTP/1.1',
    headers: objectToHarHeaders(response.headers),
    cookies: [],
    content: {
      size: 0,
      mimeType: response.mimeType ?? 'application/octet-stream',
    },
    redirectURL: response.redirectURL ?? '',
    headersSize: -1,
    bodySize: -1,
  }
}

async function handleDebuggerLoadingFinished(
  session: CaptureSession,
  params: chrome.debugger.LoadingFinishedParams,
): Promise<void> {
  const pending = session.pending.get(params.requestId)
  if (!pending || !pending.entry.request) return

  const isApiCall = pending.resourceType === 'XHR' || pending.resourceType === 'Fetch'

  if (isApiCall && pending.response && pending.response.mimeType) {
    try {
      const bodyResult = (await chrome.debugger.sendCommand(
        { tabId: session.tabId },
        'Network.getResponseBody',
        { requestId: params.requestId },
      )) as { body: string; base64Encoded: boolean }

      if (bodyResult?.body != null) {
        const text = bodyResult.base64Encoded ? atob(bodyResult.body) : bodyResult.body
        pending.entry.response!.content.text = text
        pending.entry.response!.content.size = new TextEncoder().encode(text).length
        pending.entry.response!.bodySize = pending.entry.response!.content.size
      }
    } catch (err) {
      console.warn('[API Capture] failed to fetch response body', err)
    }
  }

  finalizeDebuggerEntry(session, params.requestId)
}

function handleDebuggerLoadingFailed(
  session: CaptureSession,
  params: chrome.debugger.LoadingFailedParams,
): void {
  finalizeDebuggerEntry(session, params.requestId)
}

function finalizeDebuggerEntry(session: CaptureSession, requestId: string): void {
  const pending = session.pending.get(requestId)
  if (!pending) return

  if (pending.entry.request && pending.entry.response) {
    session.entries.push(pending.entry as HarEntry)
  }

  session.pending.delete(requestId)
}

// ─────────────────────────────────────────────────────────────────────────────
// chrome.webRequest fallback implementation
// ─────────────────────────────────────────────────────────────────────────────

function startWebRequestCapture(tabId: number, filterUrls?: string[]): string {
  const sessionId = crypto.randomUUID()

  const requestDetails = new Map<string, chrome.webRequest.WebRequestBodyDetails>()
  const requestHeaders = new Map<string, chrome.webRequest.WebRequestHeadersDetails>()
  const responseHeaders = new Map<string, chrome.webRequest.WebResponseHeadersDetails>()

  const filter: chrome.webRequest.RequestFilter = filterUrls?.length
    ? { urls: filterUrls, tabId }
    : { urls: ['<all_urls>'], tabId }

  const options = ['requestHeaders', 'responseHeaders'] as const

  const onBeforeRequest = (details: chrome.webRequest.WebRequestBodyDetails) => {
    requestDetails.set(details.requestId, details)
  }

  const onBeforeSendHeaders = (details: chrome.webRequest.WebRequestHeadersDetails) => {
    requestHeaders.set(details.requestId, details)
  }

  const onResponseStarted = (details: chrome.webRequest.WebResponseHeadersDetails) => {
    responseHeaders.set(details.requestId, details)
  }

  const onCompleted = (details: chrome.webRequest.WebResponseCacheDetails) => {
    const entry = buildWebRequestEntry(
      details,
      requestDetails.get(details.requestId),
      requestHeaders.get(details.requestId),
      responseHeaders.get(details.requestId),
    )
    if (entry) {
      session.entries.push(entry)
    }
    cleanupRequest(details.requestId)
  }

  const onErrorOccurred = (details: chrome.webRequest.WebResponseErrorDetails) => {
    cleanupRequest(details.requestId)
  }

  function cleanupRequest(requestId: string) {
    requestDetails.delete(requestId)
    requestHeaders.delete(requestId)
    responseHeaders.delete(requestId)
  }

  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, filter)
  chrome.webRequest.onBeforeSendHeaders.addListener(onBeforeSendHeaders, filter, ['requestHeaders'])
  chrome.webRequest.onResponseStarted.addListener(onResponseStarted, filter, ['responseHeaders'])
  chrome.webRequest.onCompleted.addListener(onCompleted, filter, ['responseHeaders'])
  chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, filter)

  const session: CaptureSession = {
    sessionId,
    tabId,
    filterUrls,
    mode: 'webRequest',
    entries: [],
    pending: new Map(),
    cleanup: () => {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
      chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders)
      chrome.webRequest.onResponseStarted.removeListener(onResponseStarted)
      chrome.webRequest.onCompleted.removeListener(onCompleted)
      chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred)
    },
  }

  sessions.set(sessionId, session)
  return sessionId
}

function buildWebRequestEntry(
  completed: chrome.webRequest.WebResponseCacheDetails,
  details?: chrome.webRequest.WebRequestBodyDetails,
  sendHeaders?: chrome.webRequest.WebRequestHeadersDetails,
  responseHeaders?: chrome.webRequest.WebResponseHeadersDetails,
): HarEntry | undefined {
  if (!matchesFilter(completed.url, undefined)) return undefined

  const url = completed.url
  const parsed = parseUrl(url)
  if (!parsed) return undefined

  const method = completed.method
  const requestHeadersList = sendHeaders?.requestHeaders
    ? sendHeaders.requestHeaders.map((h) => ({ name: h.name, value: h.value ?? '' }))
    : []

  const responseHeadersList = responseHeaders?.responseHeaders
    ? responseHeaders.responseHeaders.map((h) => ({ name: h.name, value: h.value ?? '' }))
    : []

  const statusLine = completed.statusLine ?? ''
  const status = completed.statusCode ?? 0
  const statusText = statusLine.split(' ').slice(2).join(' ') ?? ''

  const postDataText = details?.requestBody?.raw
    ?.map((part) => {
      if (part.bytes) {
        const decoder = new TextDecoder('utf-8')
        return decoder.decode(part.bytes)
      }
      return ''
    })
    .join('')

  const request: HarRequest = {
    method,
    url,
    httpVersion: statusLine.split(' ')[0] || 'HTTP/1.1',
    headers: requestHeadersList,
    queryString: parseQueryString(url),
    cookies: [],
    headersSize: -1,
    bodySize: postDataText ? new TextEncoder().encode(postDataText).length : 0,
    postData: postDataText
      ? { mimeType: 'application/octet-stream', text: postDataText }
      : undefined,
  }

  const mimeType =
    responseHeaders?.responseHeaders?.find((h) => h.name.toLowerCase() === 'content-type')?.value ??
    'application/octet-stream'

  const response: HarResponse = {
    status,
    statusText,
    httpVersion: request.httpVersion,
    headers: responseHeadersList,
    cookies: [],
    content: {
      size: completed.fromCache ? 0 : -1,
      mimeType,
    },
    redirectURL: '',
    headersSize: -1,
    bodySize: -1,
  }

  return {
    startedDateTime: new Date(details?.timeStamp ?? Date.now()).toISOString(),
    time: -1,
    request,
    response,
    cache: {},
    timings: makeBaseTimings(),
  }
}
