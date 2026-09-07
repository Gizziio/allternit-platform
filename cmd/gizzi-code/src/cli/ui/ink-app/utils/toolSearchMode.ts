// @ts-nocheck
import { logForDebugging } from './debug.js'
import { isEnvDefinedFalsy, isEnvTruthy } from './envUtils.js'
import { getAPIProvider, isFirstPartyAllternitBaseUrl } from './model/providers.js'

export type ToolSearchMode = 'tst' | 'tst-auto' | 'standard'

const DEFAULT_AUTO_TOOL_SEARCH_PERCENTAGE = 10 // 10%

function parseAutoPercentage(value: string): number | null {
  if (!value.startsWith('auto:')) return null

  const percentStr = value.slice(5)
  const percent = parseInt(percentStr, 10)

  if (isNaN(percent)) {
    logForDebugging(
      `Invalid ENABLE_TOOL_SEARCH value "${value}": expected auto:N where N is a number.`,
    )
    return null
  }

  return Math.max(0, Math.min(100, percent))
}

function isAutoToolSearchMode(value: string | undefined): boolean {
  if (!value) return false
  return value === 'auto' || value.startsWith('auto:')
}

export function getToolSearchMode(): ToolSearchMode {
  if (isEnvTruthy(process.env.GIZZI_CODE_DISABLE_EXPERIMENTAL_BETAS)) {
    return 'standard'
  }

  const value = process.env.ENABLE_TOOL_SEARCH

  const autoPercent = value ? parseAutoPercentage(value) : null
  if (autoPercent === 0) return 'tst'
  if (autoPercent === 100) return 'standard'
  if (isAutoToolSearchMode(value)) {
    return 'tst-auto'
  }

  if (isEnvTruthy(value)) return 'tst'
  if (isEnvDefinedFalsy(process.env.ENABLE_TOOL_SEARCH)) return 'standard'
  return 'tst'
}

let loggedOptimistic = false

export function isToolSearchEnabledOptimistic(): boolean {
  const mode = getToolSearchMode()
  if (mode === 'standard') {
    if (!loggedOptimistic) {
      loggedOptimistic = true
      logForDebugging(
        `[ToolSearch:optimistic] mode=${mode}, ENABLE_TOOL_SEARCH=${process.env.ENABLE_TOOL_SEARCH}, result=false`,
      )
    }
    return false
  }

  if (
    !process.env.ENABLE_TOOL_SEARCH &&
    getAPIProvider() === 'firstParty' &&
    !isFirstPartyAllternitBaseUrl()
  ) {
    if (!loggedOptimistic) {
      loggedOptimistic = true
      logForDebugging(
        `[ToolSearch:optimistic] disabled: ALLTERNIT_BASE_URL=${process.env.ALLTERNIT_BASE_URL} is not a first-party Anthropic host. Set ENABLE_TOOL_SEARCH=true (or auto / auto:N) if your proxy forwards tool_reference blocks.`,
      )
    }
    return false
  }

  if (!loggedOptimistic) {
    loggedOptimistic = true
    logForDebugging(
      `[ToolSearch:optimistic] mode=${mode}, ENABLE_TOOL_SEARCH=${process.env.ENABLE_TOOL_SEARCH}, result=true`,
    )
  }
  return true
}

export function isToolReferenceBlock(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as { type: unknown }).type === 'tool_reference'
  )
}
