import { describe, expect, it } from 'vitest'
import { stripProviderPrefix, resolvePlatformModelId } from './model-selection'

describe('stripProviderPrefix', () => {
  it('removes a leading provider prefix', () => {
    expect(stripProviderPrefix('kimi-cli', 'kimi-cli/kimi-for-coding')).toBe('kimi-for-coding')
  })

  it('keeps an already-short model id', () => {
    expect(stripProviderPrefix('kimi-cli', 'kimi-for-coding')).toBe('kimi-for-coding')
  })

  it('does not strip a different provider that shares the name', () => {
    expect(stripProviderPrefix('kimi', 'kimi-cli/kimi-for-coding')).toBe('kimi-cli/kimi-for-coding')
  })
})

describe('resolvePlatformModelId', () => {
  function withSelection(value: string | null): void {
    const store = new Map<string, string>()
    if (value !== null) store.set('allternit:model-selection', value)
    ;(globalThis as Record<string, unknown>).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    }
  }

  it('composes provider/modelId from a short persisted modelId', () => {
    withSelection(JSON.stringify({ providerId: 'kimi-cli', modelId: 'kimi-for-coding' }))
    expect(resolvePlatformModelId()).toBe('kimi-cli/kimi-for-coding')
  })

  it('does not double the provider prefix when modelId was persisted prefixed', () => {
    // Regression: the platform picker persisted the full runtime id as
    // modelId, and composing providerId/modelId produced
    // kimi-cli/kimi-cli/kimi-for-coding → gateway ProviderModelNotFoundError.
    withSelection(
      JSON.stringify({ providerId: 'kimi-cli', modelId: 'kimi-cli/kimi-for-coding' }),
    )
    expect(resolvePlatformModelId()).toBe('kimi-cli/kimi-for-coding')
  })

  it('returns undefined when nothing is persisted', () => {
    withSelection(null)
    expect(resolvePlatformModelId()).toBeUndefined()
  })
})
