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
} from '../bootstrap/state.js'
import {
  calculateContextPercentages,
  getContextWindowForModel,
} from './context.js'
import { getCurrentUsage, getTokenUsage } from './tokens.js'
import {
  getRuntimeMainLoopModel,
  renderModelName,
} from './model/model.js'
import { getHarnessMode, shouldUseHarness } from './feature-flags.js'
import { detectWorkspace } from '../../../../runtime/kernel/bridge.js'
import type { LocalJSXCommandContext } from '../types/command.js'

export const STATUS_SCHEMA_VERSION = 1

export type SessionStatus = {
  schemaVersion: number
  model: string
  version: string
  directory: string
  projectDirectory?: string
  sessionId: string
  context: {
    used: number | null
    total: number
    percent: number | null
  }
  costUSD: number
  durationMs: number
  requests: number
  tokens: {
    input: number
    output: number
    cacheRead: number
    cacheCreation: number
  }
  mcp: {
    connected: number
    servers: string[]
  }
  harness: {
    enabled: boolean
    mode: string
  }
  workspace: {
    present: boolean
    path?: string
    name?: string
  }
  errors: string[]
}

export async function buildSessionStatus(
  context: Pick<LocalJSXCommandContext, 'getAppState' | 'options'>,
): Promise<SessionStatus> {
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
  const version =
    (typeof MACRO !== 'undefined' ? MACRO.VERSION : undefined) ?? 'unknown'

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
  const cacheRead = getTotalCacheReadInputTokens()
  const cacheCreation = getTotalCacheCreationInputTokens()
  const requestCount = messages.filter(m => getTokenUsage(m) !== undefined).length

  const mcpClients = context.options.mcpClients ?? []
  const mcpServers = mcpClients
    .map(c => c.name ?? 'unknown')
    .filter((n): n is string => Boolean(n))

  const harnessMode = getHarnessMode()
  const harnessEnabled = shouldUseHarness()

  const workspace = await detectWorkspace(cwd).catch(() => null)

  return {
    schemaVersion: STATUS_SCHEMA_VERSION,
    model: modelDisplay,
    version,
    directory: cwd,
    ...(projectDir && projectDir !== cwd ? { projectDirectory: projectDir } : {}),
    sessionId,
    context: {
      used:
        contextPercentages.used !== null && currentUsage
          ? currentUsage.input_tokens +
            currentUsage.cache_creation_input_tokens +
            currentUsage.cache_read_input_tokens
          : null,
      total: contextWindowSize,
      percent: contextPercentages.used,
    },
    costUSD: totalCost,
    durationMs: totalDuration,
    requests: requestCount,
    tokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead,
      cacheCreation,
    },
    mcp: {
      connected: mcpClients.length,
      servers: mcpServers,
    },
    harness: {
      enabled: harnessEnabled,
      mode: harnessMode,
    },
    workspace: {
      present: workspace !== null,
      ...(workspace?.path ? { path: workspace.path } : {}),
      ...(workspace?.identity?.name ? { name: workspace.identity.name } : {}),
    },
    errors: [],
  }
}
