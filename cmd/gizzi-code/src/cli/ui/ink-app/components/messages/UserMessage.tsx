// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../../ink'

export interface UserMessageProps {
  /** Message text as typed by the user. */
  content: string
  /** Optional prompt glyph (defaults to the screens' `$` prompt). */
  prompt?: string
}

/**
 * UserMessage — renders a user-entered command/message in the output list.
 * Mirrors the 'command'/'user' rows of the ink screens.
 */
export function UserMessage({ content, prompt = '$' }: UserMessageProps): React.ReactElement {
  return (
    <Box marginY={1}>
      <Text color="#58a6ff">{prompt}</Text>
      <Text> {content}</Text>
    </Box>
  )
}

export default UserMessage
