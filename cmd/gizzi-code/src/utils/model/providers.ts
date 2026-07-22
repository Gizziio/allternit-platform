/**
 * Model Providers
 */

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama'

export function getAPIProvider(): ModelProvider {
  return 'firstParty'
}

export function getModelProvider(model: string): ModelProvider {
  if (model.startsWith('ollama/') || model.includes('llama') || model.includes('mistral') || model.includes('bonsai')) return 'ollama'
  if (model.includes('claude')) return 'anthropic'
  if (model.includes('gpt')) return 'openai'
  return 'anthropic'
}

export function isFirstPartyAnthropicBaseUrl(): boolean {
  const url = process.env.ANTHROPIC_BASE_URL || ''
  if (!url) return true
  try {
    const host = new URL(url).host
    return host.includes('anthropic.com') || host.includes('allternit.com') || host === 'localhost' || host === '127.0.0.1'
  } catch {
    return false
  }
}

/** Provider name string for telemetry/statsig tagging. */
export function getAPIProviderForStatsig(): ModelProvider {
  return getAPIProvider()
}
