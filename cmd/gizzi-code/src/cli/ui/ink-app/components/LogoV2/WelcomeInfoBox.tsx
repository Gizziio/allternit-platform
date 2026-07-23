// @ts-nocheck
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Box, Text } from '../../ink'
import { useAppState } from '../../state/AppState'
import { BrainService } from '../../../../../runtime/brain/brain.service'
import { detectWorkspace } from '../../../../../runtime/kernel/bridge'
import {
  getCwdState,
  getOriginalCwd,
  getSessionId,
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
import { truncatePath } from '../../utils/logoV2Utils'
import { stringWidth } from '../../ink/stringWidth'

const MAX_LINE_WIDTH = 46

export function WelcomeInfoBox(): React.ReactNode {
  const messages = useAppState(s => s.messages)
  const toolPermissionContext = useAppState(s => s.toolPermissionContext)
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const mcpClients = useAppState(s => s.mcp.clients)

  const [brainStats, setBrainStats] = useState<{ total_memories: number } | null>(null)
  const [workspace, setWorkspace] = useState<{ name?: string; path: string } | null>(null)
  useEffect(() => {
    try {
      const sessionId = getSessionId()
      const stats = BrainService.stats(sessionId || 'default')
      setBrainStats(stats)
    } catch {
      setBrainStats(null)
    }
    void detectWorkspace(cwd)
      .then(ws => {
        if (ws?.identity) {
          setWorkspace({ name: ws.identity.name, path: ws.path })
        }
      })
      .catch(() => setWorkspace(null))
  }, [cwd])

  const model = getRuntimeMainLoopModel({
    permissionMode: toolPermissionContext.mode,
    mainLoopModel,
    exceeds200kTokens: false,
  })

  const modelDisplay = renderModelName(model)
  const cwd = getCwdState()
  const projectDir = getOriginalCwd()
  const sessionId = getSessionId()
  const version =
    (typeof MACRO !== 'undefined' ? MACRO.VERSION : undefined) ?? 'unknown'

  const contextWindowSize = getContextWindowForModel(model, undefined)
  const currentUsage = getCurrentUsage(messages)
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const contextText =
    contextPercentages.used !== null && currentUsage
      ? `${formatTokens(
          currentUsage.input_tokens +
            currentUsage.cache_creation_input_tokens +
            currentUsage.cache_read_input_tokens,
        )} / ${formatTokens(contextWindowSize)} (${contextPercentages.used}%)`
      : 'no data'

  const cwdDisplay = truncatePath(cwd, MAX_LINE_WIDTH - 4)
  const projectDisplay =
    projectDir && projectDir !== cwd
      ? truncatePath(projectDir, MAX_LINE_WIDTH - 10)
      : null

  const mcpText = `${mcpClients.length} connected`

  const brainText =
    brainStats && brainStats.total_memories > 0
      ? `${brainStats.total_memories} memories`
      : 'empty'

  const workspaceText = workspace
    ? `${workspace.name ?? 'workspace'} (${workspace.path})`
    : 'not initialized'

  const lines = [
    `Model:    ${modelDisplay}`,
    `CWD:      ${cwdDisplay}`,
    ...(projectDisplay ? [`Project:  ${projectDisplay}`] : []),
    `Session:  ${sessionId}`,
    `Version:  ${version}`,
    `Context:  ${contextText}`,
    `MCP:      ${mcpText}`,
    `Brain:    ${brainText}`,
    `Workspace: ${workspaceText}`,
  ]

  const maxWidth = Math.min(
    MAX_LINE_WIDTH,
    Math.max(...lines.map(l => stringWidth(l)), 20),
  )

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="inactive"
      paddingX={1}
      paddingY={0}
      width={maxWidth + 4}
    >
      {lines.map((line, i) => (
        <Text key={i} dimColor={!line.startsWith('Model:')} wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  )
}
