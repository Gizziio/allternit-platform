// @ts-nocheck
import {
  getCwdState,
  getOriginalCwd,
  getSessionId,
  getTotalCostUSD,
  getTotalDuration,
  getTotalInputTokens,
  getTotalOutputTokens,
  getTotalCacheReadInputTokens,
  getTotalCacheCreationInputTokens,
} from '../../bootstrap/state.js'
import { formatDuration, formatNumber, formatTokens } from '../../utils/format.js'
import { getTokenUsage } from '../../utils/tokens.js'
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

const PROGRESS_BAR_WIDTH = 20

function renderProgressBar(ratio: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, ratio))
  const filled = Math.round(clamped * width)
  const empty = width - filled
  return '█'.repeat(filled) + '░'.repeat(empty)
}

function severityColor(ratio: number): string {
  if (ratio >= 0.9) return 'red'
  if (ratio >= 0.75) return 'yellow'
  return 'green'
}

export const call: LocalCommandCall = async (_args, context) => {
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
  const version = (typeof MACRO !== 'undefined' ? MACRO.VERSION : undefined) ?? 'unknown'

  const contextWindowSize = getContextWindowForModel(model, undefined)
  const currentUsage = getCurrentUsage(messages)
  const contextPercentages = calculateContextPercentages(
    currentUsage,
    contextWindowSize,
  )

  const totalCost = getTotalCostUSD()
  const totalDuration = getTotalDuration()
  const totalInputTokens = getTotalInputTokens()
  const totalOutputTokens = getTotalOutputTokens()
  const totalCacheRead = getTotalCacheReadInputTokens()
  const totalCacheCreation = getTotalCacheCreationInputTokens()
  const requestCount = messages.filter(m => getTokenUsage(m) !== undefined).length

  const mcpClients = context.options.mcpClients ?? []

  const lines: string[] = []
  lines.push('')
  lines.push('╭────────────────────────────────────────╮')
  lines.push('│  Welcome to Gizzi Code                 │')
  lines.push('╰────────────────────────────────────────╯')
  lines.push('')
  lines.push(`  Model:     ${modelDisplay}`)
  lines.push(`  Directory: ${cwd}`)
  if (projectDir && projectDir !== cwd) {
    lines.push(`  Project:   ${projectDir}`)
  }
  lines.push(`  Session:   ${sessionId}`)
  lines.push(`  Version:   ${version}`)
  lines.push('')

  lines.push('Context window')
  if (contextPercentages.used !== null && currentUsage) {
    const totalInput =
      currentUsage.input_tokens +
      currentUsage.cache_creation_input_tokens +
      currentUsage.cache_read_input_tokens
    const ratio = contextPercentages.used / 100
    const bar = renderProgressBar(ratio, PROGRESS_BAR_WIDTH)
    lines.push(
      `  ${bar}  ${contextPercentages.used}% (${formatTokens(totalInput)} / ${formatTokens(contextWindowSize)})`,
    )
  } else {
    lines.push('  No context usage data available.')
  }

  lines.push('')
  lines.push('Session usage')
  lines.push(`  Cost:      $${totalCost.toFixed(4)}`)
  lines.push(`  Duration:  ${formatDuration(totalDuration, { mostSignificantOnly: true })}`)
  lines.push(`  Requests:  ${requestCount}`)
  lines.push(`  Tokens:    ${formatTokens(totalInputTokens + totalOutputTokens)} total`)
  lines.push(`             ${formatTokens(totalInputTokens)} in / ${formatTokens(totalOutputTokens)} out`)
  if (totalCacheRead > 0 || totalCacheCreation > 0) {
    lines.push(`             ${formatTokens(totalCacheRead)} cache read / ${formatTokens(totalCacheCreation)} cache write`)
  }

  if (mcpClients.length > 0) {
    lines.push('')
    lines.push(`MCP servers: ${mcpClients.length} connected`)
    for (const client of mcpClients.slice(0, 5)) {
      const name = client.name ?? 'unknown'
      const status = client.status ?? 'unknown'
      lines.push(`  • ${name} (${status})`)
    }
    if (mcpClients.length > 5) {
      lines.push(`  ... and ${mcpClients.length - 5} more`)
    }
  }

  lines.push('')
  lines.push('Run /dash again to refresh.')
  lines.push('')

  return { type: 'text', value: lines.join('\n') }
}
