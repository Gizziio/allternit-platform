// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../../ink'
import { useAppStateMaybeOutsideOfProvider } from '../../state/AppState'
import type { ToolUseBlockParam } from '@allternit/sdk/providers/allternit/resources/index.mjs'

type Props = {
  param: ToolUseBlockParam
  toolName: string
  isQueued: boolean
  isResolved: boolean
  isError: boolean
  children: React.ReactNode
}

export function ToolUseCard({
  param,
  toolName,
  isQueued,
  isResolved,
  isError,
  children,
}: Props): React.ReactNode {
  const tasks = useAppStateMaybeOutsideOfProvider(s => s.tasks) ?? {}
  const backgroundTask = Object.values(tasks).find(
    t =>
      t &&
      typeof t === 'object' &&
      'parentToolUseID' in t &&
      (t as { parentToolUseID?: string }).parentToolUseID === param.id,
  ) as { id?: string; status?: string } | undefined

  let stateLabel: string
  let stateColor: string
  if (isError) {
    stateLabel = 'error'
    stateColor = 'red'
  } else if (isResolved) {
    stateLabel = 'done'
    stateColor = 'green'
  } else if (isQueued) {
    stateLabel = 'queued'
    stateColor = 'yellow'
  } else {
    stateLabel = 'running'
    stateColor = 'claude'
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isError ? 'red' : isResolved ? 'inactive' : 'claude'}
      paddingX={1}
      paddingY={0}
      width="100%"
    >
      <Box flexDirection="row" justifyContent="space-between" gap={1}>
        <Text bold={true} wrap="truncate">
          {toolName}
        </Text>
        <Text color={stateColor}>{stateLabel}</Text>
      </Box>
      {backgroundTask && (
        <Text dimColor wrap="truncate">
          ↳ background task: {backgroundTask.id?.slice(0, 8) ?? 'unknown'} (
          {backgroundTask.status ?? 'running'})
        </Text>
      )}
      {children}
    </Box>
  )
}
