// @ts-nocheck
import React from 'react'
import { MessageResponse } from '../../components/MessageResponse'
import { Text } from '../../ink'
import { jsonStringify } from '../../utils/slowOperations'
import type { Output } from './ListPeersTool'

export function renderToolUseMessage(): React.ReactNode {
  return null
}

export function renderToolResultMessage(
  content: Output | string,
  _progressMessages: unknown,
  { verbose }: { verbose: boolean },
): React.ReactNode {
  const result: Output =
    typeof content === 'string' ? JSON.parse(content) : content
  if (!verbose) {
    return null
  }
  return (
    <MessageResponse>
      <Text dimColor>{jsonStringify(result, null, 2)}</Text>
    </MessageResponse>
  )
}
