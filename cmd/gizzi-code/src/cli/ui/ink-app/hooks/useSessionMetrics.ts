// @ts-nocheck
import { useEffect, useState } from 'react'
import { useAppState } from '../state/AppState'
import {
  getTotalCostUSD,
  getTotalDuration,
  getTotalInputTokens,
  getTotalOutputTokens,
  getTotalCacheReadInputTokens,
  getTotalCacheCreationInputTokens,
} from '../bootstrap/state.js'
import { calculateContextPercentages, getContextWindowForModel } from '../utils/context.js'
import { getCurrentUsage } from '../utils/tokens.js'
import { getRuntimeMainLoopModel, renderModelName } from '../utils/model/model.js'
import { getTokenUsage } from '../utils/tokens.js'

export type SessionMetrics = {
  model: string
  contextUsed: number | null
  contextTotal: number
  contextPercent: number | null
  costUSD: number
  durationMs: number
  requests: number
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheCreation: number
  }
}

export function useSessionMetrics(): SessionMetrics {
  const messages = useAppState(s => s.messages)
  const toolPermissionContext = useAppState(s => s.toolPermissionContext)
  const mainLoopModel = useAppState(s => s.mainLoopModel)
  const [, setTick] = useState(0)

  // Force re-render every 2 seconds to catch streaming updates
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const model = getRuntimeMainLoopModel({
    permissionMode: toolPermissionContext.mode,
    mainLoopModel,
    exceeds200kTokens: false,
  })

  const modelDisplay = renderModelName(model)
  const contextWindowSize = getContextWindowForModel(model, undefined)
  const currentUsage = getCurrentUsage(messages)
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const totalInput = getTotalInputTokens()
  const totalOutput = getTotalOutputTokens()
  const cacheRead = getTotalCacheReadInputTokens()
  const cacheCreation = getTotalCacheCreationInputTokens()
  const requestCount = messages.filter(m => getTokenUsage(m) !== undefined).length

  return {
    model: modelDisplay,
    contextUsed:
      contextPercentages.used !== null && currentUsage
        ? currentUsage.input_tokens +
          currentUsage.cache_creation_input_tokens +
          currentUsage.cache_read_input_tokens
        : null,
    contextTotal: contextWindowSize,
    contextPercent: contextPercentages.used,
    costUSD: getTotalCostUSD(),
    durationMs: getTotalDuration(),
    requests: requestCount,
    tokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead,
      cacheCreation,
    },
  }
}
