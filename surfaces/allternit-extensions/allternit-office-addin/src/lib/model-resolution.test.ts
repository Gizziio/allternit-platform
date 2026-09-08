import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  pickModelFromList,
  resolveBackendModel,
  resetResolvedModelForTests,
} from './model-resolution'

// Fixture: the shape a gateway serving the gizzi-backed catalog returns for
// GET /v1/models. `subconscious/glm-5.2` is the verified-known-good model on
// the local stack (gizzi /v1/provider on 127.0.0.1:4096, catalog fetched
// live during session model-resolve 2026-09-08).
const GLM_CATALOG_FIXTURE = {
  object: 'list',
  data: [
    { id: 'subconscious/glm-5.2', object: 'model', owned_by: 'subconscious' },
    { id: 'subconscious/tim-qwen3.6-27b', object: 'model', owned_by: 'subconscious' },
  ],
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('pickModelFromList', () => {
  it('returns null for a missing or empty list', () => {
    expect(pickModelFromList(undefined)).toBeNull()
    expect(pickModelFromList(null)).toBeNull()
    expect(pickModelFromList('nope')).toBeNull()
    expect(pickModelFromList([])).toBeNull()
    expect(pickModelFromList([{}, { id: '' }, { id: 42 }])).toBeNull()
  })

  it('picks the first model id', () => {
    expect(pickModelFromList(GLM_CATALOG_FIXTURE.data)).toBe('subconscious/glm-5.2')
  })

  it('prefers an entry explicitly flagged default', () => {
    const entries = [
      { id: 'other/model' },
      { id: 'subconscious/glm-5.2', default: true },
    ]
    expect(pickModelFromList(entries)).toBe('subconscious/glm-5.2')
  })
})

describe('resolveBackendModel', () => {
  beforeEach(() => {
    resetResolvedModelForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetResolvedModelForTests()
  })

  it('resolves the first catalog model from the backend /v1/models', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(GLM_CATALOG_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    const model = await resolveBackendModel('http://127.0.0.1:8013/', 'ak-testkey')

    expect(model).toBe('subconscious/glm-5.2')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8013/v1/models')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ak-testkey')
  })

  it('caches the resolution for the session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(GLM_CATALOG_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    await resolveBackendModel('http://backend.test', 'ak-testkey')
    await resolveBackendModel('http://backend.test', 'ak-testkey')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns null and falls through when the backend rejects the key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: 'Unauthorized', message: 'Invalid token' }, 401),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(await resolveBackendModel('http://backend.test', 'ak-badkey')).toBeNull()
  })

  it('returns null and falls through on malformed payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ not: 'a list' })))
    expect(await resolveBackendModel('http://backend.test', 'ak-key')).toBeNull()

    resetResolvedModelForTests()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: [] })))
    expect(await resolveBackendModel('http://backend.test', 'ak-key')).toBeNull()
  })

  it('returns null and falls through on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('connection refused')))
    expect(await resolveBackendModel('http://backend.test', 'ak-key')).toBeNull()
  })

  it('returns null without fetching when baseURL or apiKey is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await resolveBackendModel('', 'ak-key')).toBeNull()
    expect(await resolveBackendModel('http://backend.test', '')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
