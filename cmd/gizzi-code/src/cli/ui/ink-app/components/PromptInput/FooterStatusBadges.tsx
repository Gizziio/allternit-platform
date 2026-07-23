// @ts-nocheck
import * as React from 'react'
import { Box, Text } from '../../ink'
import { getCwdState } from '../../bootstrap/state.js'
import { formatTokens } from '../../utils/format.js'
import { truncateStartToWidth } from '../../utils/truncate.js'
import { useSessionMetrics } from '../../hooks/useSessionMetrics'

const MAX_CWD_WIDTH = 24

export function FooterStatusBadges(): React.ReactNode {
  const metrics = useSessionMetrics()
  const cwd = getCwdState()
  const cwdDisplay = truncateStartToWidth(cwd, MAX_CWD_WIDTH)

  const contextText =
    metrics.contextPercent !== null
      ? `${formatTokens(metrics.contextUsed ?? 0)} / ${formatTokens(metrics.contextTotal)} (${metrics.contextPercent}%)`
      : 'no data'

  return (
    <Box gap={1} flexShrink={0}>
      <Text dimColor wrap="truncate">{cwdDisplay}</Text>
      <Text color="magenta" wrap="truncate">{metrics.model}</Text>
      <Text dimColor wrap="truncate">{contextText}</Text>
    </Box>
  )
}
