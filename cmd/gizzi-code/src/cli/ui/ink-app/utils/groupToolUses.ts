import type { BetaToolUseBlock } from '@allternit/gizzi-sdk/providers/allternit/resources/beta/messages/messages.mjs'
import type { ToolResultBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs'
import type { Tools } from '../Tool.js'
import {
  type ContentBlock,
  type GroupedToolUseMessage,
  type MessageContent,
  type NormalizedAssistantMessage,
  type NormalizedMessage,
  type ProgressMessage,
  type RenderableMessage,
  type UserMessage,
  isContentBlockArray,
  isMessageContentArray,
} from '../types/message.js'

export type MessageWithoutProgress = Exclude<NormalizedMessage, ProgressMessage>

export type GroupingResult = {
  messages: RenderableMessage[]
}

// NestedMessage.content can be a plain string; grouping only operates on
// block arrays (both content element types carry the discriminant `type`).
function asContentBlocks(
  content: string | MessageContent[] | ContentBlock[],
): Array<MessageContent | ContentBlock> {
  return isContentBlockArray(content) || isMessageContentArray(content)
    ? content
    : []
}

// The render pipeline downstream (Messages.tsx and the collapse* utils)
// declares RenderableMessage[] throughout while actually carrying normalized
// API messages; Messages.tsx bridges the same gap with `as unknown as` at
// its own boundary. The pushes below cast into that declared pipeline type.

// Cache the set of tool names that support grouped rendering, keyed by the
// tools array reference. The tools array is stable across renders (only
// replaced on MCP connect/disconnect), so this avoids rebuilding the set on
// every call. WeakMap lets old entries be GC'd when the array is replaced.
const GROUPING_CACHE = new WeakMap<Tools, Set<string>>()

function getToolsWithGrouping(tools: Tools): Set<string> {
  let cached = GROUPING_CACHE.get(tools)
  if (!cached) {
    cached = new Set(tools.filter(t => t.renderGroupedToolUse).map(t => t.name))
    GROUPING_CACHE.set(tools, cached)
  }
  return cached
}

function getToolUseInfo(
  msg: MessageWithoutProgress,
): { messageId: string; toolUseId: string; toolName: string } | null {
  if (msg.type !== 'assistant') return null
  const first = asContentBlocks(msg.message.content)[0]
  // A well-formed tool_use block always carries id + name; skip malformed
  // blocks rather than grouping on undefined ids.
  if (first?.type === 'tool_use' && first.id && first.name) {
    return {
      messageId: msg.message.id ?? '',
      toolUseId: first.id,
      toolName: first.name,
    }
  }
  return null
}

/**
 * Groups tool uses by message.id (same API response) if the tool supports grouped rendering.
 * Only groups 2+ tools of the same type from the same message.
 * Also collects corresponding tool_results and attaches them to the grouped message.
 * When verbose is true, skips grouping so messages render at original positions.
 */
export function applyGrouping(
  messages: MessageWithoutProgress[],
  tools: Tools,
  verbose: boolean = false,
): GroupingResult {
  // In verbose mode, don't group - each message renders at its original position
  if (verbose) {
    return {
      messages: messages as RenderableMessage[],
    }
  }
  const toolsWithGrouping = getToolsWithGrouping(tools)

  // First pass: group tool uses by message.id + tool name
  const groups = new Map<
    string,
    NormalizedAssistantMessage<BetaToolUseBlock>[]
  >()

  for (const msg of messages) {
    const info = getToolUseInfo(msg)
    if (info && toolsWithGrouping.has(info.toolName)) {
      const key = `${info.messageId}:${info.toolName}`
      const group = groups.get(key) ?? []
      group.push(msg as NormalizedAssistantMessage<BetaToolUseBlock>)
      groups.set(key, group)
    }
  }

  // Identify valid groups (2+ items) and collect their tool use IDs
  const validGroups = new Map<
    string,
    NormalizedAssistantMessage<BetaToolUseBlock>[]
  >()
  const groupedToolUseIds = new Set<string>()

  for (const [key, group] of groups) {
    if (group.length >= 2) {
      validGroups.set(key, group)
      for (const msg of group) {
        const info = getToolUseInfo(msg)
        if (info) {
          groupedToolUseIds.add(info.toolUseId)
        }
      }
    }
  }

  // Collect result messages for grouped tool_uses
  // Map from tool_use_id to the user message containing that result
  const resultsByToolUseId = new Map<string, UserMessage>()

  for (const msg of messages) {
    if (msg.type === 'user') {
      for (const content of asContentBlocks(msg.message.content)) {
        if (
          content.type === 'tool_result' &&
          typeof content.tool_use_id === 'string' &&
          groupedToolUseIds.has(content.tool_use_id)
        ) {
          resultsByToolUseId.set(content.tool_use_id, msg)
        }
      }
    }
  }

  // Second pass: build output, emitting each group only once
  const result: RenderableMessage[] = []
  const emittedGroups = new Set<string>()

  for (const msg of messages) {
    const info = getToolUseInfo(msg)

    if (info) {
      const key = `${info.messageId}:${info.toolName}`
      const group = validGroups.get(key)

      if (group) {
        if (!emittedGroups.has(key)) {
          emittedGroups.add(key)
          const firstMsg = group[0]!

          // Collect results for this group
          const results: UserMessage[] = []
          for (const assistantMsg of group) {
            const toolUseId = (
              assistantMsg.message.content[0] as { id: string }
            ).id
            const resultMsg = resultsByToolUseId.get(toolUseId)
            if (resultMsg) {
              results.push(resultMsg)
            }
          }

          const groupedMessage: GroupedToolUseMessage = {
            type: 'grouped_tool_use',
            toolName: info.toolName,
            messages: group,
            results,
            displayMessage: firstMsg,
            uuid: `grouped-${firstMsg.uuid}`,
            timestamp: firstMsg.timestamp,
            messageId: info.messageId,
          }
          result.push(groupedMessage as unknown as RenderableMessage)
        }
        continue
      }
    }

    // Skip user messages whose tool_results are all grouped
    if (msg.type === 'user') {
      const toolResults = asContentBlocks(msg.message.content).filter(
        (c): c is ToolResultBlockParam => c.type === 'tool_result',
      )
      if (toolResults.length > 0) {
        const allGrouped = toolResults.every(tr =>
          groupedToolUseIds.has(tr.tool_use_id),
        )
        if (allGrouped) {
          continue
        }
      }
    }

    result.push(msg as RenderableMessage)
  }

  return { messages: result }
}
