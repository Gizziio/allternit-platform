import React from 'react'
import { Box, Text } from '../../ink.js'
import type { MonitorMcpTaskState } from '../../tasks/MonitorMcpTask/MonitorMcpTask.js'

type Props = {
  task: MonitorMcpTaskState
  onDone: () => void
}

export function MonitorMcpDetailDialog({ task, onDone }: Props): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Monitor MCP Task: {task.id}</Text>
      <Text>Status: {task.status}</Text>
    </Box>
  )
}
