// @ts-nocheck
import React from 'react'
import { Box, Text } from '@/ink.js'
import type { LocalWorkflowTaskState } from '../../ink-app/tasks/LocalWorkflowTask/LocalWorkflowTask.js'

type Props = {
  task: LocalWorkflowTaskState
  onDone: () => void
}

export function WorkflowDetailDialog({ task, onDone }: Props): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Workflow Task: {task.id}</Text>
      <Text>Status: {task.status}</Text>
    </Box>
  )
}
