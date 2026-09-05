// @ts-nocheck
/**
 * Leaf module for creating assistant API-error messages.
 *
 * Kept separate from messages.ts so modules that only need to synthesize an
 * error assistant message (e.g. services/api/errors.ts) can import it without
 * pulling in the heavy messages.ts graph and its circular tool imports.
 */

import type { BetaContentBlock } from '@allternit/sdk/providers/allternit/resources/beta/messages/messages.mjs'
import type { BetaUsage as Usage } from '@allternit/sdk/providers/allternit/resources/beta/messages/messages.mjs'
import { randomUUID } from 'crypto'
import { NO_CONTENT_MESSAGE } from '@/constants/messages.js'
import type { AssistantMessage, ContentBlock } from '@/types/message.js'
import type { SDKAssistantMessageError } from '../entrypoints/agentSdkTypes.js'
import { SYNTHETIC_MODEL } from './syntheticMessages.js'

export function baseCreateAssistantMessage({
  content,
  isApiErrorMessage = false,
  apiError,
  error,
  errorDetails,
  isVirtual,
  usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
    service_tier: null,
    cache_creation: {
      ephemeral_1h_input_tokens: 0,
      ephemeral_5m_input_tokens: 0,
    },
    inference_geo: null,
    iterations: null,
    speed: null,
  },
}: {
  content: BetaContentBlock[]
  isApiErrorMessage?: boolean
  apiError?: AssistantMessage['apiError']
  error?: SDKAssistantMessageError
  errorDetails?: string
  isVirtual?: true
  usage?: Usage
}): AssistantMessage {
  return {
    type: 'assistant',
    uuid: randomUUID(),
    timestamp: new Date().toISOString(),
    message: {
      id: randomUUID(),
      container: null,
      model: SYNTHETIC_MODEL,
      role: 'assistant',
      stop_reason: 'stop_sequence',
      stop_sequence: '',
      type: 'message',
      usage,
      content: content as unknown as ContentBlock[] as any,
      context_management: null,
    },
    requestId: undefined,
    apiError,
    error: error as Error | string | undefined,
    errorDetails,
    isApiErrorMessage,
    isVirtual,
  }
}

export function createAssistantAPIErrorMessage({
  content,
  apiError,
  error,
  errorDetails,
}: {
  content: string
  apiError?: AssistantMessage['apiError']
  error?: SDKAssistantMessageError | string
  errorDetails?: string
}): AssistantMessage {
  return baseCreateAssistantMessage({
    content: [
      {
        type: 'text' as const,
        text: content === '' ? NO_CONTENT_MESSAGE : content,
      } as BetaContentBlock,
    ],
    isApiErrorMessage: true,
    apiError,
    error: error as SDKAssistantMessageError,
    errorDetails,
  })
}
