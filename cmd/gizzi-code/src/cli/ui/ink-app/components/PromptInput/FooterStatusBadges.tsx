// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../../ink'
import { useAppState } from '../../state/AppState'
import {
  getCwdState,
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../bootstrap/state.js'
import {
  calculateContextPercentages,
  getContextWindowForModel,
} from '../../utils/context.js'
import { getCurrentUsage } from '../../utils/tokens.js'
import {
  getRuntimeMainLoopModel,
  renderModelName,
} from '../../utils/model/model.js'
import { formatTokens } from '../../utils/format.js'
import { truncateStartToWidth } from '../../utils/truncate.js'

const MAX_CWD_WIDTH = 24

export function FooterStatusBadges(): React.ReactNode {
  const messages = useAppState(s => s.messages)
  const toolPermissionContext = useAppState(s => s.toolPermissionContext)
  const mainLoopModel = useAppState(s => s.mainLoopModel)

  const model = getRuntimeMainLoopModel({
    permissionMode: toolPermissionContext.mode,
    mainLoopModel,
    exceeds200kTokens: false,
  })

  const modelDisplay = renderModelName(model)
  const cwd = getCwdState()
  const cwdDisplay = truncateStartToWidth(cwd, MAX_CWD_WIDTH)

  const contextWindowSize = getContextWindowForModel(model, undefined)
  const currentUsage = getCurrentUsage(messages)
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const totalTokens = getTotalInputTokens() + getTotalOutputTokens()
  const contextText =
    contextPercentages.used !== null && currentUsage
      ? `${formatTokens(totalTokens)} / ${formatTokens(contextWindowSize)} (${contextPercentages.used}%)`
      : 'no data'

  return (
    <Box gap={1} flexShrink={0}>
      <Text dimColor wrap="truncate">{cwdDisplay}</Text>
      <Text color="magenta" wrap="truncate">{modelDisplay}</Text>
      <Text dimColor wrap="truncate">{contextText}</Text>
    </Box>
  )
}
