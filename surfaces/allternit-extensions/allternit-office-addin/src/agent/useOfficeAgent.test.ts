import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveRuntimeConfig, type OfficeAgentConfig } from './useOfficeAgent'
import { DEFAULT_OFFICE_MODEL } from '@/lib/agent-defaults'
import { resetResolvedModelForTests } from '@/lib/model-resolution'

function makeConfig(overrides: Partial<OfficeAgentConfig> = {}): OfficeAgentConfig {
  return { apiKey: '', baseURL: '', model: '', ...overrides }
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('resolveRuntimeConfig model resolution', () => {
  beforeEach(() => {
    resetResolvedModelForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetResolvedModelForTests()
  })

  it('returns null for a null config', async () => {
    expect(await resolveRuntimeConfig(null)).toBeNull()
  })

  it('honors an explicitly chosen model without hitting the backend', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resolved = await resolveRuntimeConfig(
      makeConfig({ model: 'my-provider/my-model' }),
    )

    expect(resolved?.model).toBe('my-provider/my-model')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resolves an empty model from the backend catalog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ data: [{ id: 'subconscious/glm-5.2' }] }),
      ),
    )

    const resolved = await resolveRuntimeConfig(
      makeConfig({ baseURL: 'http://backend.test', apiKey: 'ak-key' }),
    )

    expect(resolved?.model).toBe('subconscious/glm-5.2')
  })

  it('treats the legacy hard-coded default as unset and resolves it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ data: [{ id: 'subconscious/glm-5.2' }] }),
      ),
    )

    const resolved = await resolveRuntimeConfig(
      makeConfig({ baseURL: 'http://backend.test', apiKey: 'ak-key', model: DEFAULT_OFFICE_MODEL }),
    )

    expect(resolved?.model).toBe('subconscious/glm-5.2')
  })

  it('falls back to the hard-coded default when the catalog is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('down')))

    const resolved = await resolveRuntimeConfig(
      makeConfig({ baseURL: 'http://backend.test', apiKey: 'ak-key' }),
    )

    expect(resolved?.model).toBe(DEFAULT_OFFICE_MODEL)
  })
})
