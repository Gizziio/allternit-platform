// @ts-nocheck
import {
  getCwdState,
  getSessionId,
  getTotalCostUSD,
  getTotalDuration,
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../bootstrap/state.js'
import { formatDuration, formatTokens } from '../../utils/format.js'
import {
  calculateContextPercentages,
  getContextWindowForModel,
} from '../../utils/context.js'
import { getCurrentUsage } from '../../utils/tokens.js'
import {
  getRuntimeMainLoopModel,
  renderModelName,
} from '../../utils/model/model.js'
import type { LocalCommandCall } from '../../types/command.js'

export const call: LocalCommandCall = async (_args, context) => {
  const messages = context.getAppState().messages ?? []
  const model = getRuntimeMainLoopModel({
    permissionMode: context.getAppState().toolPermissionContext.mode,
    mainLoopModel: context.options.mainLoopModel,
    exceeds200kTokens: false,
  })

  const modelDisplay = renderModelName(model)
  const cwd = getCwdState()
  const sessionId = getSessionId()

  const contextWindowSize = getContextWindowForModel(model, undefined)
  const currentUsage = getCurrentUsage(messages)
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const totalCost = getTotalCostUSD()
  const totalDuration = getTotalDuration()
  const totalInput = getTotalInputTokens()
  const totalOutput = getTotalOutputTokens()

  const lines: string[] = []
  lines.push('')
  lines.push('Live session metrics')
  lines.push(`  Model:     ${modelDisplay}`)
  lines.push(`  Directory: ${cwd}`)
  lines.push(`  Session:   ${sessionId}`)
  lines.push('')
  lines.push('Context window')
  if (contextPercentages.used !== null && currentUsage) {
    const totalInputNow =
      currentUsage.input_tokens +
      currentUsage.cache_creation_input_tokens +
      currentUsage.cache_read_input_tokens
    lines.push(`  ${formatTokens(totalInputNow)} / ${formatTokens(contextWindowSize)} (${contextPercentages.used}%)`)
  } else {
    lines.push('  No context usage data available.')
  }
  lines.push('')
  lines.push('Session totals')
  lines.push(`  Cost:      $${totalCost.toFixed(4)}`)
  lines.push(`  Duration:  ${formatDuration(totalDuration, { mostSignificantOnly: true })}`)
  lines.push(`  Tokens:    ${formatTokens(totalInput + totalOutput)}`)
  lines.push(`             ${formatTokens(totalInput)} in / ${formatTokens(totalOutput)} out`)
  lines.push('')
  lines.push('Tip: run /live again to refresh. Footer badges update automatically.')

  return { type: 'text', value: lines.join('\n') }
}
