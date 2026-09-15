// @ts-nocheck
import * as React from 'react'
import { useAppState, useSetAppState } from '../../state/AppState'
import type { LocalJSXCommandOnDone } from '../../types/command'
import type { ThinkingConfig } from '../../utils/thinking'

const COMMON_HELP_ARGS = ['help', '-h', '--help']

export type ThinkMode = 'on' | 'off' | 'hard' | 'ultrathink' | 'adaptive' | 'status'

export function parseThinkArg(args: string): ThinkMode | null {
  const normalized = args.trim().toLowerCase()
  if (!normalized || normalized === 'status' || normalized === 'current') {
    return 'status'
  }
  if (normalized === 'on' || normalized === 'enabled' || normalized === 'true' || normalized === 'yes') {
    return 'on'
  }
  if (normalized === 'off' || normalized === 'disabled' || normalized === 'false' || normalized === 'no') {
    return 'off'
  }
  if (normalized === 'hard' || normalized === 'deep' || normalized === 'max') {
    return 'hard'
  }
  if (normalized === 'ultrathink' || normalized === 'ultra') {
    return 'ultrathink'
  }
  if (normalized === 'adaptive') {
    return 'adaptive'
  }
  return null
}

export function getThinkingConfigForMode(mode: Exclude<ThinkMode, 'status'>): ThinkingConfig {
  switch (mode) {
    case 'off':
      return { type: 'disabled' }
    case 'hard':
      return { type: 'enabled', budgetTokens: 31999 }
    case 'ultrathink':
      return { type: 'enabled', budgetTokens: 31999 }
    case 'adaptive':
    case 'on':
    default:
      return { type: 'adaptive' }
  }
}

export function describeThinkingConfig(config: ThinkingConfig | undefined, enabled: boolean | undefined): string {
  if (enabled === false || config?.type === 'disabled') {
    return 'Thinking is disabled'
  }
  if (!config || config.type === 'adaptive') {
    return 'Thinking is on (adaptive)'
  }
  if (config.type === 'enabled' && config.budgetTokens !== undefined) {
    return `Thinking is on with ${config.budgetTokens.toLocaleString()} budget tokens`
  }
  return 'Thinking is on'
}

type ThinkResult = {
  message: string
  enabled: boolean | undefined
  configOverride: ThinkingConfig | undefined
}

export function executeThink(mode: Exclude<ThinkMode, 'status'>): ThinkResult {
  const config = getThinkingConfigForMode(mode)
  const enabled = mode !== 'off'
  const label = mode === 'ultrathink' ? 'Ultra-think' : mode === 'hard' ? 'Think hard' : mode === 'off' ? 'Thinking off' : 'Thinking on'
  return {
    message: `${label}: ${describeThinkingConfig(config, enabled).toLowerCase()}`,
    enabled,
    configOverride: enabled ? config : undefined,
  }
}

function ShowCurrentThink({ onDone }: { onDone: LocalJSXCommandOnDone }) {
  const thinkingEnabled = useAppState(s => s.thinkingEnabled)
  const configOverride = useAppState(s => s.thinkingConfigOverride)
  const message = describeThinkingConfig(configOverride, thinkingEnabled)
  React.useEffect(() => {
    onDone(message)
  }, [onDone, message])
  return null
}

function ApplyThinkAndClose({
  result,
  onDone,
}: {
  result: ThinkResult
  onDone: LocalJSXCommandOnDone
}) {
  const setAppState = useSetAppState()
  React.useEffect(() => {
    setAppState(prev => ({
      ...prev,
      thinkingEnabled: result.enabled,
      thinkingConfigOverride: result.configOverride,
    }))
    onDone(result.message)
  }, [setAppState, result, onDone])
  return null
}

export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  const trimmed = args?.trim() || ''
  if (COMMON_HELP_ARGS.includes(trimmed)) {
    onDone(
      'Usage: /think [on|off|hard|adaptive|status]\n\nThinking modes:\n- on: Enable adaptive thinking\n- hard: Enable maximum thinking budget (31999 tokens)\n- adaptive: Let the model choose its reasoning depth\n- off: Disable thinking\n- status: Show current thinking mode',
    )
    return
  }

  const mode = parseThinkArg(trimmed)
  if (mode === 'status') {
    return <ShowCurrentThink onDone={onDone} />
  }
  if (mode === null) {
    onDone(`Invalid argument: ${args}. Valid options are: on, off, hard, adaptive, status`)
    return
  }

  const result = executeThink(mode)
  return <ApplyThinkAndClose result={result} onDone={onDone} />
}
