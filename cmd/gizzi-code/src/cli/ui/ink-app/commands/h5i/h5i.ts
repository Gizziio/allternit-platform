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

function parseArgs(args: string): { subcommand: string; workspace: string } {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = parts[0] || 'audit'
  let workspace = process.cwd()
  const wsIndex = parts.indexOf('--workspace')
  if (wsIndex !== -1 && parts[wsIndex + 1]) {
    workspace = parts[wsIndex + 1]
  }
  return { subcommand, workspace }
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

export const call: LocalCommandCall = async (args: string): Promise<LocalCommandResult> => {
  const { subcommand, workspace } = parseArgs(args)

  if (subcommand !== 'audit') {
    return {
      type: 'text',
      value: `Unknown h5i subcommand: ${subcommand}\nUsage: /h5i audit [--workspace <path>]`,
    }
  }

  return runAudit(workspace)
}
