// @ts-nocheck
import {
  getAllternitApiConfig,
  apiFetchJson,
} from '@/runtime/services/api/allternitApi.js'
import type { LocalCommandCall, LocalCommandResult } from '../../types/command'

interface H5iVibeResponse {
  success: boolean
  result?: {
    aiRatio: number
    aiDirectories: string[]
    riskiestFiles: string[]
    leakedTokens: string[]
    promptInjectionHits: string[]
  }
  raw?: string
  error?: string
}

interface H5iStatusResponse {
  initialized: boolean
  version?: string
  contextExists: boolean
  notesCount: number
  sessionCount: number
}

interface H5iContextEntry {
  timestamp: string
  type: 'OBSERVE' | 'THINK' | 'ACT' | 'NOTE'
  content: string
}

interface H5iContextTraceResponse {
  success: boolean
  trace?: H5iContextEntry[]
  error?: string
}

interface ParsedArgs {
  subcommand: string
  workspace: string
  sessionId?: string
  goal?: string
}

function parseArgs(args: string): ParsedArgs {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0] || 'audit'
  let workspace = process.cwd()
  let sessionId: string | undefined
  let goal: string | undefined

  const wsIndex = parts.indexOf('--workspace')
  if (wsIndex !== -1 && parts[wsIndex + 1]) {
    workspace = parts[wsIndex + 1]
  }

  const sessionIndex = parts.indexOf('--session')
  if (sessionIndex !== -1 && parts[sessionIndex + 1]) {
    sessionId = parts[sessionIndex + 1]
  }

  const goalIndex = parts.indexOf('--goal')
  if (goalIndex !== -1 && parts[goalIndex + 1]) {
    goal = parts[goalIndex + 1]
  }

  return { subcommand, workspace, sessionId, goal }
}

async function fetchH5iStatus(workspacePath: string): Promise<H5iStatusResponse> {
  const config = getAllternitApiConfig()
  return apiFetchJson<H5iStatusResponse>(config, '/api/h5i/status', {
    method: 'POST',
    body: JSON.stringify({ workspacePath }),
  })
}

async function initH5i(workspacePath: string): Promise<{ success: boolean; message: string }> {
  const config = getAllternitApiConfig()
  return apiFetchJson<{ success: boolean; message: string }>(config, '/api/h5i/init', {
    method: 'POST',
    body: JSON.stringify({ workspacePath }),
  })
}

async function fetchH5iVibe(workspacePath: string): Promise<H5iVibeResponse> {
  const config = getAllternitApiConfig()
  return apiFetchJson<H5iVibeResponse>(config, '/api/h5i/vibe', {
    method: 'POST',
    body: JSON.stringify({ workspacePath }),
  })
}

async function startH5iContext(
  workspacePath: string,
  sessionId: string,
  goal: string,
): Promise<{ success: boolean; message: string }> {
  const config = getAllternitApiConfig()
  return apiFetchJson<{ success: boolean; message: string }>(
    config,
    '/api/h5i/context/start',
    {
      method: 'POST',
      body: JSON.stringify({ workspacePath, sessionId, goal }),
    },
  )
}

async function finishH5iContext(
  workspacePath: string,
  sessionId: string,
): Promise<{ success: boolean; message: string }> {
  const config = getAllternitApiConfig()
  return apiFetchJson<{ success: boolean; message: string }>(
    config,
    '/api/h5i/context/finish',
    {
      method: 'POST',
      body: JSON.stringify({ workspacePath, sessionId }),
    },
  )
}

async function fetchH5iContextTrace(
  workspacePath: string,
  sessionId: string,
): Promise<H5iContextTraceResponse> {
  const config = getAllternitApiConfig()
  return apiFetchJson<H5iContextTraceResponse>(
    config,
    '/api/h5i/context/trace',
    {
      method: 'POST',
      body: JSON.stringify({ workspacePath, sessionId }),
    },
  )
}

function formatAudit(result: H5iVibeResponse['result'], raw: string | undefined): string {
  if (!result) {
    return raw ? `Raw output:\n${raw}` : 'Audit returned no result.'
  }

  const lines: string[] = []
  lines.push('H5I Workspace Audit')
  lines.push('')

  const risk =
    result.aiRatio > 0.7 ? 'high' : result.aiRatio > 0.4 ? 'medium' : 'low'
  lines.push(`AI footprint: ${result.aiRatio.toFixed(1)}% (${risk} risk)`)
  lines.push('')

  if (result.riskiestFiles.length > 0) {
    lines.push('Riskiest files:')
    for (const f of result.riskiestFiles) {
      lines.push(`  • ${f}`)
    }
    lines.push('')
  }

  if (result.leakedTokens.length > 0) {
    lines.push('Leaked tokens detected:')
    for (const t of result.leakedTokens) {
      lines.push(`  • ${t}`)
    }
    lines.push('')
  }

  if (result.promptInjectionHits.length > 0) {
    lines.push('Prompt injection hits:')
    for (const h of result.promptInjectionHits) {
      lines.push(`  • ${h}`)
    }
    lines.push('')
  }

  if (result.aiDirectories.length > 0) {
    lines.push('AI-written directories:')
    for (const d of result.aiDirectories) {
      lines.push(`  • ${d}`)
    }
    lines.push('')
  }

  if (raw) {
    lines.push('--- Raw h5i output ---')
    lines.push(raw)
  }

  return lines.join('\n')
}

async function runAudit(workspacePath: string): Promise<LocalCommandResult> {
  try {
    const status = await fetchH5iStatus(workspacePath)
    if (!status.initialized) {
      await initH5i(workspacePath)
    }

    const data = await fetchH5iVibe(workspacePath)
    if (!data.success) {
      return {
        type: 'text',
        value: `Audit failed: ${data.error || 'unknown error'}`,
      }
    }

    return {
      type: 'text',
      value: formatAudit(data.result, data.raw),
    }
  } catch (err) {
    return {
      type: 'text',
      value: `Audit error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

function formatContext(trace: H5iContextEntry[] | undefined): string {
  if (!trace || trace.length === 0) {
    return 'No context trace entries yet.'
  }

  const lines: string[] = []
  lines.push(`H5I Context Trace (${trace.length} entries)`)
  lines.push('')

  for (const entry of trace) {
    lines.push(`[${entry.timestamp}] ${entry.type}`)
    lines.push(entry.content)
    lines.push('')
  }

  return lines.join('\n')
}

async function runContext(
  workspacePath: string,
  sessionId: string | undefined,
  goal: string | undefined,
): Promise<LocalCommandResult> {
  if (!sessionId) {
    return {
      type: 'text',
      value:
        'Usage: /h5i context --session <sessionId> [--goal <goal>] [--workspace <path>]\n\nSubcommands:\n  /h5i context --session <id>                 show trace\n  /h5i context --session <id> --goal <text>   start context\n  /h5i context --session <id> --finish        finish context',
    }
  }

  try {
    if (goal) {
      const data = await startH5iContext(workspacePath, sessionId, goal)
      return {
        type: 'text',
        value: data.success
          ? `Context started: ${data.message}`
          : `Failed to start context: ${data.message}`,
      }
    }

    if (process.argv.includes('--finish')) {
      const data = await finishH5iContext(workspacePath, sessionId)
      return {
        type: 'text',
        value: data.success
          ? `Context finished: ${data.message}`
          : `Failed to finish context: ${data.message}`,
      }
    }

    const data = await fetchH5iContextTrace(workspacePath, sessionId)
    if (!data.success) {
      return {
        type: 'text',
        value: `Context trace failed: ${data.error || 'unknown error'}`,
      }
    }

    return {
      type: 'text',
      value: formatContext(data.trace),
    }
  } catch (err) {
    return {
      type: 'text',
      value: `Context error: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

export const call: LocalCommandCall = async (args: string): Promise<LocalCommandResult> => {
  const { subcommand, workspace, sessionId, goal } = parseArgs(args)

  switch (subcommand) {
    case 'audit':
      return runAudit(workspace)
    case 'context':
      return runContext(workspace, sessionId, goal)
    default:
      return {
        type: 'text',
        value: `Unknown h5i subcommand: ${subcommand}\nUsage: /h5i audit [--workspace <path>]\n       /h5i context --session <sessionId> [--goal <goal>] [--workspace <path>]`,
      }
  }
}
