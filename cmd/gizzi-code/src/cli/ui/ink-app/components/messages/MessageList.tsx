// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../../ink'
import UserMessage from './UserMessage'
import AssistantMessage from './AssistantMessage'
import ToolUseMessage from './ToolUseMessage'
import ToolResultMessage from './ToolResultMessage'

export interface MessageListItem {
  id?: string
  /** Row kind. Accepts the screens' spellings: user/command,
   *  assistant/response, tool/tool_use, tool_result, error, system. */
  type: string
  content: string
  metadata?: {
    toolName?: string
    status?: 'running' | 'success' | 'error'
    isError?: boolean
    [key: string]: unknown
  }
  timestamp?: number
}

export interface MessageListProps {
  items: MessageListItem[]
  /** Optional in-progress assistant text appended after the items. */
  streamingText?: string
}

function Row({ item }: { item: MessageListItem }): React.ReactElement | null {
  switch (item.type) {
    case 'user':
    case 'command':
      return <UserMessage content={item.content} />
    case 'assistant':
    case 'response':
      return <AssistantMessage content={item.content} />
    case 'tool':
    case 'tool_use':
      return (
        <ToolUseMessage
          name={item.metadata?.toolName}
          content={item.content}
          status={item.metadata?.status ?? 'success'}
        />
      )
    case 'tool_result':
      return (
        <ToolResultMessage
          content={item.content}
          isError={item.metadata?.isError ?? item.metadata?.status === 'error'}
        />
      )
    case 'error':
      return (
        <Box marginY={1} marginLeft={2}>
          <Text color="#f85149">Error: {item.content}</Text>
        </Box>
      )
    case 'system':
      return (
        <Box marginY={1} marginLeft={2}>
          <Text color="#8b949e" dimColor>{item.content}</Text>
        </Box>
      )
    default:
      return null
  }
}

/**
 * MessageList — renders the conversation output list by dispatching each
 * item to the matching message component. Compatible with the OutputItem
 * model used by the ink screens (MainScreen/MainScreenEnhanced).
 */
export function MessageList({ items, streamingText }: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
      {items.map((item, index) => (
        <Row key={item.id ?? index} item={item} />
      ))}
      {streamingText ? <AssistantMessage content={streamingText} streaming /> : null}
    </Box>
  )
}

export default MessageList
