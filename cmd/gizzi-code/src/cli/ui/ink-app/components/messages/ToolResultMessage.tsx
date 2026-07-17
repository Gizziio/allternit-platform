// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../ink'

export interface ToolResultMessageProps {
  /** Result text (may be multi-line). */
  content: string
  /** Marks the result as an error output (rendered red). */
  isError?: boolean
}

/**
 * ToolResultMessage — renders the result of a completed tool call.
 * Errors render in red, normal results dimmed, mirroring the ink screens.
 */
export function ToolResultMessage({ content, isError = false }: ToolResultMessageProps): React.ReactElement {
  return (
    <Box marginY={1} marginLeft={2}>
      {isError ? (
        <Text color="#f85149">Error: {content}</Text>
      ) : (
        <Text color="#8b949e" dimColor>{content}</Text>
      )}
    </Box>
  )
}

export default ToolResultMessage
