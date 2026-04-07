/**
 * Model Providers
 */

export type ModelProvider = 'anthropic' | 'openai' | 'google'

export function getAPIProvider(): ModelProvider {
  return 'anthropic'
}

export function getModelProvider(model: string): ModelProvider {
  if (model.includes('claude')) return 'anthropic'
  if (model.includes('gpt')) return 'openai'
  return 'anthropic'
}
