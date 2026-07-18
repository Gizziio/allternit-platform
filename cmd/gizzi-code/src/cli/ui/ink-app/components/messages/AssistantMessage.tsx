// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../../ink'

export interface AssistantMessageProps {
  /** Assistant response text (already accumulated when streaming). */
  content: string
  /** When true, appends the streaming cursor after the text. */
  streaming?: boolean
}

/**
 * AssistantMessage — renders an assistant response in the output list.
 * Mirrors the 'response' rows of the ink screens.
 */
export function AssistantMessage({ content, streaming = false }: AssistantMessageProps): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1} marginLeft={2}>
      <Text wrap="wrap">{content}</Text>
      {streaming && <Text color="#58a6ff">▌</Text>}
    </Box>
  )
}

export default AssistantMessage
