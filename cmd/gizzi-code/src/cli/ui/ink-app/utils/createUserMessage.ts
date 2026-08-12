// @ts-nocheck
import type { ContentBlockParam } from '@allternit/sdk/providers/anthropic/resources/index.mjs'
import { randomUUID, type UUID } from 'crypto'
import { NO_CONTENT_MESSAGE } from '../constants/messages.ts'
import type {
  MessageOrigin,
  PartialCompactDirection,
  ToolUseResult,
  UserMessage,
} from './../types/message.ts'
import type { PermissionMode } from './../types/permissions.ts'

export function createUserMessage({
  content,
  isMeta,
  isVisibleInTranscriptOnly,
  isVirtual,
  isCompactSummary,
  summarizeMetadata,
  toolUseResult,
  mcpMeta,
  uuid,
  timestamp,
  imagePasteIds,
  sourceToolAssistantUUID,
  permissionMode,
  origin,
}: {
  content: string | ContentBlockParam[]
  isMeta?: true
  isVisibleInTranscriptOnly?: true
  isVirtual?: true
  isCompactSummary?: true
  toolUseResult?: unknown // Matches tool's `Output` type
  /** MCP protocol metadata to pass through to SDK consumers (never sent to model) */
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  uuid?: UUID | string
  timestamp?: string
  imagePasteIds?: number[]
  // For tool_result messages: the UUID of the assistant message containing the matching tool_use
  sourceToolAssistantUUID?: UUID
  // Permission mode when message was sent (for rewind restoration)
  permissionMode?: PermissionMode
  summarizeMetadata?: {
    messagesSummarized: number
    userContext?: string
    direction?: PartialCompactDirection
  }
  // Provenance of this message. undefined = human (keyboard).
  origin?: MessageOrigin
}): UserMessage {
  const m: UserMessage = {
    type: 'user',
    message: {
      role: 'user',
      content: (content || NO_CONTENT_MESSAGE) as any, // Make sure we don't send empty messages
    },
    isMeta,
    isVisibleInTranscriptOnly,
    isVirtual,
    isCompactSummary,
    summarizeMetadata,
    uuid: (uuid as UUID | undefined) || randomUUID(),
    timestamp: timestamp ?? new Date().toISOString(),
    toolUseResult: toolUseResult as ToolUseResult | undefined as ToolUseResult | undefined,
    mcpMeta: mcpMeta as { _meta?: Record<string, unknown>; structuredContent?: Record<string, unknown> } | undefined,
    imagePasteIds: imagePasteIds as number[] | undefined,
    sourceToolAssistantUUID: sourceToolAssistantUUID as UUID | undefined,
    permissionMode: permissionMode as PermissionMode | undefined,
    origin: origin as MessageOrigin | undefined,
  }
  return m as UserMessage
}
