/**
 * Model Providers
 */

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama'

export function getAPIProvider(): ModelProvider {
  if (process.env.GIZZI_USE_OLLAMA === '1') return 'ollama'
  return 'anthropic'
}

export function getModelProvider(model: string): ModelProvider {
  if (model.startsWith('ollama/') || model.includes('llama') || model.includes('mistral')) return 'ollama'
  if (model.includes('claude')) return 'anthropic'
  if (model.includes('gpt')) return 'openai'
  return 'anthropic'
}

export function isFirstPartyAnthropicBaseUrl(): boolean {
  const url = process.env.ANTHROPIC_BASE_URL || ''
  return url === '' || url.includes('api.anthropic.com')
}
