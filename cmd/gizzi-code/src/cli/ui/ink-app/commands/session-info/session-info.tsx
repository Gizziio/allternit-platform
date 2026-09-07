// @ts-nocheck
import * as React from 'react'
import { Box, Text, useInput } from '../../ink'
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import {
  getCwdState,
  getOriginalCwd,
  getSessionId,
} from '../../bootstrap/state.js'
import { setClipboard } from '../../ink/termio/osc.js'
import { getRuntimeMainLoopModel, renderModelName } from '../../utils/model/model.js'
import {
  calculateContextPercentages,
  getContextWindowForModel,
} from '../../utils/context.js'
import { getCurrentUsage } from '../../utils/tokens.js'
import { formatTokens } from '../../utils/format.js'

const PROGRESS_BAR_WIDTH = 24

function renderProgressBar(ratio: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const filled = Math.round(clamped * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function SessionInfoPanel({ onCopy }: { onCopy: () => void }) {
  useInput((input, key) => {
    if (input === 'c' && !key.ctrl && !key.meta) {
      onCopy()
    }
  })
  return null
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  context: LocalJSXCommandContext,
): Promise<React.ReactNode> {
  const messages = context.getAppState().messages ?? []
  const model = getRuntimeMainLoopModel({
    permissionMode: context.getAppState().toolPermissionContext.mode,
    mainLoopModel: context.options.mainLoopModel,
    exceeds200kTokens: false,
  })
  const modelDisplay = renderModelName(model)
  const cwd = getCwdState()
  const projectDir = getOriginalCwd()
  const sessionId = getSessionId()

  const contextWindowSize = getContextWindowForModel(model, undefined)
  const currentUsage = getCurrentUsage(messages)
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const handleCopy = () => {
    void setClipboard(String(sessionId))
    onDone('Session id copied', { display: 'system' })
  }

  const lines: React.ReactNode[] = []
  lines.push(
    <Text key="model">
      {'  '}Model:{'     '}
      {modelDisplay}
    </Text>,
  )
  lines.push(
    <Text key="cwd">
      {'  '}Directory: {cwd}
    </Text>,
  )
  if (projectDir && projectDir !== cwd) {
    lines.push(
      <Text key="project">
        {'  '}Project:{'   '}
        {projectDir}
      </Text>,
    )
  }
  lines.push(
    <Text key="session">
      {'  '}Session:{'   '}
      {String(sessionId)}
    </Text>,
  )

  let usageLine: React.ReactNode = <Text>{'  '}No context usage data available.</Text>
  if (contextPercentages.used !== null && currentUsage) {
    const totalInputNow =
      currentUsage.input_tokens +
      currentUsage.cache_creation_input_tokens +
      currentUsage.cache_read_input_tokens
    const ratio = contextPercentages.used / 100
    const bar = renderProgressBar(ratio, PROGRESS_BAR_WIDTH)
    usageLine = (
      <Text>
        {'  '}
        {bar}  {contextPercentages.used}% ({formatTokens(totalInputNow)} /{' '}
        {formatTokens(contextWindowSize)})
      </Text>
    )
  }

  return (
    <Box flexDirection="column">
      <SessionInfoPanel onCopy={handleCopy} />
      <Text>{'╭────────────────────────────────────────╮'}</Text>
      <Text>{'│  Session info                          │'}</Text>
      <Text>{'╰────────────────────────────────────────╯'}</Text>
      {lines}
      <Text>{''}</Text>
      <Text>{'Context window'}</Text>
      {usageLine}
      <Text>{''}</Text>
      <Text dimColor>
        {'  '}Press c to copy the session id.
      </Text>
    </Box>
  )
}
