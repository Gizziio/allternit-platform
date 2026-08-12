// @ts-nocheck
/**
 * Token Estimation Service
 * Production-quality token counting for various LLM models
 */

import { log } from '../util/log.js'

export type ModelName = 
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-opus'
  | 'claude-3-sonnet'
  | 'claude-3-haiku'
  | 'claude-2'
  | 'gemini-pro'
  | 'gemini-ultra'
  | 'llama-2-70b'
  | 'default'

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface EstimationOptions {
  model?: ModelName
  includeOverhead?: boolean
}

// Token ratios (characters per token) for different models
const MODEL_RATIOS: Record<ModelName, number> = {
  'gpt-4': 3.5,
  'gpt-4-turbo': 3.5,
  'gpt-3.5-turbo': 3.5,
  'claude-3-opus': 3.2,
  'claude-3-sonnet': 3.2,
  'claude-3-haiku': 3.2,
  'claude-2': 3.2,
  'gemini-pro': 3.8,
  'gemini-ultra': 3.8,
  'llama-2-70b': 3.0,
  'default': 3.5,
}

// Context window sizes
const CONTEXT_WINDOWS: Record<ModelName, number> = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 16385,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-2': 100000,
  'gemini-pro': 32768,
  'gemini-ultra': 32768,
  'llama-2-70b': 4096,
  'default': 8192,
}

// Overhead tokens per message
const MESSAGE_OVERHEAD = 4
const SYSTEM_MESSAGE_OVERHEAD = 2

/**
 * Simple heuristic token estimation
 * Uses character count / ratio for approximation
 */
export function estimateTokens(text: string, options: EstimationOptions = {}): number {
  const model = options.model || 'default'
  const ratio = MODEL_RATIOS[model]
  
  if (!text) return 0
  
  // Count characters (excluding excessive whitespace)
  const normalizedText = text.replace(/\s+/g, ' ').trim()
  const charCount = normalizedText.length
  
  // Estimate tokens
  const tokens = Math.ceil(charCount / ratio)
  
  // Add overhead for special characters
  const specialChars = (normalizedText.match(/[\n\t!@#$%^&*()_+={}\[\]|\\:;"'<>,.?/~`]/g) || []).length
  const overhead = Math.ceil(specialChars / 5)
  
  return tokens + overhead
}

/**
 * Estimate tokens for a conversation message
 * Includes overhead for message formatting
 */
export function estimateMessageTokens(message: Message, options: EstimationOptions = {}): number {
  const contentTokens = estimateTokens(message.content, options)
  const overhead = message.role === 'system' 
    ? SYSTEM_MESSAGE_OVERHEAD 
    : MESSAGE_OVERHEAD
  
  return contentTokens + overhead
}

/**
 * Estimate tokens for multiple messages
 */
export function estimateTokensForMessages(
  messages: Message[], 
  options: EstimationOptions = {}
): number {
  let total = 0
  
  for (const message of messages) {
    total += estimateMessageTokens(message, options)
  }
  
  // Add conversation overhead
  total += 3 // Priming tokens
  
  return total
}

/**
 * Rough token count estimation (alias for backwards compatibility)
 */
export function roughTokenCountEstimation(
  input: string | Message[],
  model?: ModelName
): number {
  const options: EstimationOptions = { model: model || 'default' }
  
  if (typeof input === 'string') {
    return estimateTokens(input, options)
  }
  
  return estimateTokensForMessages(input, options)
}

/**
 * Get context window size for a model
 */
export function getModelContextWindow(model: ModelName = 'default'): number {
  return CONTEXT_WINDOWS[model] || CONTEXT_WINDOWS.default
}

/**
 * Check if messages fit within context window
 */
export function checkTokenLimit(
  messages: Message[],
  model: ModelName = 'default',
  maxTokens?: number
): { fits: boolean; used: number; remaining: number } {
  const used = estimateTokensForMessages(messages, { model })
  const limit = maxTokens || getModelContextWindow(model)
  const remaining = limit - used
  
  return {
    fits: used <= limit,
    used,
    remaining,
  }
}

/**
 * Truncate messages to fit within token limit
 * Keeps most recent messages
 */
export function truncateToTokenLimit(
  messages: Message[],
  model: ModelName = 'default',
  maxTokens?: number
): Message[] {
  const limit = maxTokens || getModelContextWindow(model)
  
  // Always keep system messages
  const systemMessages = messages.filter(m => m.role === 'system')
  const otherMessages = messages.filter(m => m.role !== 'system')
  
  let currentTokens = estimateTokensForMessages(systemMessages, { model })
  const result: Message[] = [...systemMessages]
  
  // Add messages from most recent until limit
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const message = otherMessages[i]
    const messageTokens = estimateMessageTokens(message, { model })
    
    if (currentTokens + messageTokens <= limit) {
      result.unshift(message) // Add to front to maintain order
      currentTokens += messageTokens
    } else {
      break
    }
  }
  
  return result
}

/**
 * Estimate tokens for file content based on file type
 */
export function estimateTokensForFileType(
  content: string,
  fileType: string,
  options: EstimationOptions = {}
): number {
  // Different file types have different token densities
  const typeMultipliers: Record<string, number> = {
    'json': 0.8,
    'yaml': 0.9,
    'yml': 0.9,
    'md': 1.1,
    'txt': 1.0,
    'js': 1.2,
    'ts': 1.2,
    'tsx': 1.2,
    'jsx': 1.2,
    'py': 1.1,
    'rs': 1.0,
    'go': 1.0,
    'java': 1.2,
  }
  
  const ext = fileType.toLowerCase().replace(/^\./, '')
  const multiplier = typeMultipliers[ext] || 1.0
  
  const baseTokens = estimateTokens(content, options)
  return Math.ceil(baseTokens * multiplier)
}

/**
 * Detailed token breakdown
 */
export function getTokenBreakdown(
  messages: Message[],
  options: EstimationOptions = {}
): {
  total: number
  byRole: Record<string, number>
  byMessage: Array<{ index: number; role: string; tokens: number }>
} {
  const byRole: Record<string, number> = {}
  const byMessage: Array<{ index: number; role: string; tokens: number }> = []
  
  let total = 3 // Priming tokens
  
  messages.forEach((message, index) => {
    const tokens = estimateMessageTokens(message, options)
    total += tokens
    
    byRole[message.role] = (byRole[message.role] || 0) + tokens
    byMessage.push({ index, role: message.role, tokens })
  })
  
  return { total, byRole, byMessage }
}

// Default export
export default {
  estimateTokens,
  estimateMessageTokens,
  estimateTokensForMessages,
  roughTokenCountEstimation,
  getModelContextWindow,
  checkTokenLimit,
  truncateToTokenLimit,
  estimateTokensForFileType,
  getTokenBreakdown,
  MODEL_RATIOS,
  CONTEXT_WINDOWS,
}

// NOTE: The ink-app token-estimation module used to be statically re-exported
// here. That created a circular ESM dependency that made Bun emit a
// synchronous __esm wrapper containing `await init_messages()`. The async
// wrappers below dynamically import the ink-app implementations at call time,
// which avoids the static cycle. The synchronous helpers are re-implemented
// locally with the same heuristics so callers can keep using them synchronously.

// Async wrappers — these keep the heavy ink-app graph out of the runtime module
// initialization path.

export async function countTokensWithAPI(
  content: string,
): Promise<number | null> {
  const mod = await import('../../cli/ui/ink-app/services/tokenEstimation.js')
  return mod.countTokensWithAPI(content)
}

export async function countMessagesTokensWithAPI(
  messages: any[],
  tools: any[],
): Promise<number | null> {
  const mod = await import('../../cli/ui/ink-app/services/tokenEstimation.js')
  return mod.countMessagesTokensWithAPI(messages, tools)
}

export async function countTokensViaHaikuFallback(
  messages: any[],
  tools: any[],
): Promise<number | null> {
  const mod = await import('../../cli/ui/ink-app/services/tokenEstimation.js')
  return mod.countTokensViaHaikuFallback(messages, tools)
}

// Synchronous helpers — kept local to avoid pulling the ink-app message graph
// into the runtime module initialization cycle.

export function bytesPerTokenForFileType(fileExtension: string): number {
  switch (fileExtension) {
    case 'json':
    case 'jsonl':
    case 'jsonc':
      return 2
    default:
      return 4
  }
}

export function roughTokenCountEstimationForFileType(
  content: string,
  fileExtension: string,
): number {
  return roughTokenCountEstimation(content, bytesPerTokenForFileType(fileExtension))
}

export function roughTokenCountEstimationForMessage(message: {
  type: string
  message?: { content?: unknown }
  attachment?: unknown
}): number {
  if (
    (message.type === 'assistant' || message.type === 'user') &&
    message.message?.content
  ) {
    return roughTokenCountEstimationForContent(message.message.content)
  }
  // Attachment normalization requires the full ink-app messages module; runtime
  // callers do not use this path.
  return 0
}

function roughTokenCountEstimationForContent(
  content: unknown,
): number {
  if (!content) return 0
  if (typeof content === 'string') {
    return roughTokenCountEstimation(content)
  }
  if (Array.isArray(content)) {
    return content.reduce((sum, block) => sum + roughTokenCountEstimationForBlock(block), 0)
  }
  return roughTokenCountEstimation(String(content))
}

function roughTokenCountEstimationForBlock(
  block: unknown,
): number {
  if (typeof block === 'string') {
    return roughTokenCountEstimation(block)
  }
  if (block && typeof block === 'object') {
    const b = block as Record<string, unknown>
    if (b.type === 'text' && typeof b.text === 'string') {
      return roughTokenCountEstimation(b.text)
    }
    if (b.type === 'image' || b.type === 'document') {
      return 2000
    }
    if (b.type === 'tool_result') {
      return roughTokenCountEstimationForContent(b.content)
    }
    if (b.type === 'tool_use') {
      return roughTokenCountEstimation(
        String(b.name ?? '') + JSON.stringify(b.input ?? {}),
      )
    }
    if (b.type === 'thinking' && typeof b.thinking === 'string') {
      return roughTokenCountEstimation(b.thinking)
    }
    if (b.type === 'redacted_thinking' && typeof b.data === 'string') {
      return roughTokenCountEstimation(b.data)
    }
    return roughTokenCountEstimation(JSON.stringify(block))
  }
  return 0
}

export function roughTokenCountEstimationForMessages(
  messages: readonly {
    type: string
    message?: { content?: unknown }
    attachment?: unknown
  }[],
): number {
  let total = 0
  for (const message of messages) {
    total += roughTokenCountEstimationForMessage(message)
  }
  return total
}

export function getEstimatedCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  let costPerMillionInput = 0
  let costPerMillionOutput = 0

  if (model.includes('sonnet')) {
    costPerMillionInput = 3
    costPerMillionOutput = 15
  } else if (model.includes('opus')) {
    costPerMillionInput = 15
    costPerMillionOutput = 75
  }

  const inputCost = (inputTokens / 1_000_000) * costPerMillionInput
  const outputCost = (outputTokens / 1_000_000) * costPerMillionOutput
  return inputCost + outputCost
}
