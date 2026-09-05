// @ts-nocheck
import type { ContentBlockParam } from '@allternit/sdk/providers/allternit/resources/messages.js'
import type { Command } from '../../commands.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'

const API_BASE = process.env.Allternit_API_URL || ALLTERNIT_GATEWAY_BASE
const API_V1 = `${API_BASE}/api/v1`

type SecurityEventSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical'
type SecurityEventType =
  | 'authentication'
  | 'authorization'
  | 'policy_violation'
  | 'anomaly'
  | 'threat'
  | 'compliance'
  | 'system'
  | string

interface SecurityEvent {
  id: string
  type: SecurityEventType
  subtype?: string
  severity: SecurityEventSeverity
  title: string
  description?: string
  createdAt?: string
  acknowledgedAt?: string
  resolvedAt?: string
}

interface SecurityOverview {
  threatLevel?: string
  activeAlerts?: number
  unresolvedViolations?: number
  pendingApprovals?: number
  complianceStatus?: {
    overall?: string
    score?: number
  }
  metrics?: {
    totalViolations24h?: number
    blockedActions24h?: number
  }
}

interface EventsResponse {
  events: SecurityEvent[]
}

function parseArgs(args: string): { subcommand: string; id?: string; reason?: string; type?: string; severity?: string } {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const result: ReturnType<typeof parseArgs> = { subcommand: 'overview' }

  if (tokens.length === 0) return result

  const first = tokens[0].toLowerCase()
  if (['overview', 'events', 'compliance', 'assess', 'ack', 'resolve'].includes(first)) {
    result.subcommand = first
  }

  if (result.subcommand === 'ack') {
    result.id = tokens[1]
    return result
  }

  if (result.subcommand === 'resolve') {
    result.id = tokens[1]
    result.reason = tokens.slice(2).join(' ') || 'Resolved by user'
    return result
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '--type' || token === '-t') {
      result.type = tokens[++i]
    } else if (token === '--severity' || token === '-s') {
      result.severity = tokens[++i]
    }
  }

  return result
}

async function getOverview(): Promise<string> {
  const res = await fetch(`${API_V1}/security/overview`)
  if (!res.ok) throw new Error(`Overview failed (${res.status} ${res.statusText})`)
  const data = (await res.json()) as SecurityOverview
  return `**Security Overview**\n- threat level: ${data.threatLevel || 'unknown'}\n- active alerts: ${data.activeAlerts ?? 0}\n- unresolved violations: ${data.unresolvedViolations ?? 0}\n- pending approvals: ${data.pendingApprovals ?? 0}\n- compliance: ${data.complianceStatus?.overall || 'unknown'} (score ${data.complianceStatus?.score ?? '—'})\n- violations 24h: ${data.metrics?.totalViolations24h ?? 0}, blocked 24h: ${data.metrics?.blockedActions24h ?? 0}`
}

async function listEvents(type?: string, severity?: string): Promise<string> {
  const params = new URLSearchParams()
  if (type) params.append('type', type)
  if (severity) params.append('severity', severity)
  params.append('pageSize', '20')
  const query = params.toString()
  const res = await fetch(`${API_V1}/security/events${query ? `?${query}` : ''}`)
  if (!res.ok) throw new Error(`Events query failed (${res.status} ${res.statusText})`)
  const data = (await res.json()) as EventsResponse
  const events = data.events || []
  if (events.length === 0) return 'No security events matched the filters.'
  const lines = events.map((e) => {
    const state = e.resolvedAt ? 'resolved' : e.acknowledgedAt ? 'acknowledged' : 'open'
    return `- [${e.severity}] **${e.type}** ${e.title} (${state}) — ${e.id}`
  })
  return `**${events.length} event(s)**\n\n${lines.join('\n')}`
}

async function getCompliance(): Promise<string> {
  const res = await fetch(`${API_V1}/security/compliance`)
  if (!res.ok) throw new Error(`Compliance failed (${res.status} ${res.statusText})`)
  const data = await res.json()
  const frameworks = (data.frameworks || []).map((f: any) => `- ${f.name}: ${f.status} (${f.passedControls}/${f.totalControls})`)
  return `**Compliance Status: ${data.overall || 'unknown'}** (score ${data.score ?? '—'}, last assessed ${data.lastAssessmentAt || '—'})\n\nFrameworks:\n${frameworks.length ? frameworks.join('\n') : 'None reported.'}`
}

async function runAssessment(): Promise<string> {
  const res = await fetch(`${API_V1}/security/compliance/assess`, { method: 'POST' })
  if (!res.ok) throw new Error(`Assessment failed (${res.status} ${res.statusText})`)
  const data = await res.json()
  return `Compliance assessment complete: ${data.overall || 'unknown'} (score ${data.score ?? '—'})`
}

async function acknowledgeEvent(id: string): Promise<string> {
  const res = await fetch(`${API_V1}/security/events/${encodeURIComponent(id)}/acknowledge`, { method: 'POST' })
  if (!res.ok) throw new Error(`Acknowledge failed (${res.status} ${res.statusText})`)
  return `Event ${id} acknowledged.`
}

async function resolveEvent(id: string, reason: string): Promise<string> {
  const res = await fetch(`${API_V1}/security/events/${encodeURIComponent(id)}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution: reason }),
  })
  if (!res.ok) throw new Error(`Resolve failed (${res.status} ${res.statusText})`)
  return `Event ${id} resolved: ${reason}`
}

const security: Command = {
  type: 'prompt',
  name: 'security',
  aliases: ['sec'],
  description: 'Security dashboard: overview, events, compliance, and event actions',
  progressMessage: 'querying security dashboard',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const { subcommand, id, reason, type, severity } = parseArgs(args)

    try {
      switch (subcommand) {
        case 'overview':
          return [{ type: 'text', text: await getOverview() }]
        case 'events':
          return [{ type: 'text', text: await listEvents(type, severity) }]
        case 'compliance':
          return [{ type: 'text', text: await getCompliance() }]
        case 'assess':
          return [{ type: 'text', text: await runAssessment() }]
        case 'ack':
          if (!id) return [{ type: 'text', text: 'Usage: /security ack <event-id>' }]
          return [{ type: 'text', text: await acknowledgeEvent(id) }]
        case 'resolve':
          if (!id) return [{ type: 'text', text: 'Usage: /security resolve <event-id> [reason]' }]
          return [{ type: 'text', text: await resolveEvent(id, reason || 'Resolved by user') }]
        default:
          return [{ type: 'text', text: 'Usage: /security [overview|events|compliance|assess|ack <id>|resolve <id> [reason]]' }]
      }
    } catch (err) {
      return [{ type: 'text', text: `Security command failed: ${err instanceof Error ? err.message : String(err)}` }]
    }
  },
}

export default security
