// @ts-nocheck
import type { ContentBlockParam } from '@allternit/sdk/providers/anthropic/resources/messages.js'
import type { Command } from '../../commands.js'

const API_BASE = process.env.Allternit_API_URL || 'http://127.0.0.1:8013'
const API_V1 = `${API_BASE}/api/v1`

interface Purpose {
  id: string
  name: string
  description?: string
  category?: string
  status?: string
}

interface AgentPurposeBinding {
  agentId: string
  agentName?: string
  purposeId: string
  purposeName?: string
  status?: string
  confidence?: number
}

interface PurposeViolation {
  id: string
  agentName?: string
  purposeName?: string
  violation: string
  severity?: string
  resolvedAt?: string
}

function parseArgs(args: string): { subcommand: string; tokens: string[] } {
  const tokens = args.trim().split(/\s+/).filter(Boolean)
  const subcommand = tokens[0]?.toLowerCase() || 'list'
  return { subcommand, tokens }
}

async function listPurposes(): Promise<string> {
  const res = await fetch(`${API_V1}/purposes?pageSize=20`)
  if (!res.ok) throw new Error(`List purposes failed (${res.status} ${res.statusText})`)
  const data = await res.json()
  const purposes: Purpose[] = data.purposes || []
  if (purposes.length === 0) return 'No purposes defined.'
  const lines = purposes.map((p) => `- **${p.name}** (${p.id}) [${p.category || '—'}] — ${p.status || 'active'}`)
  return `**${purposes.length} purpose(s)**\n\n${lines.join('\n')}`
}

async function listBindings(): Promise<string> {
  const res = await fetch(`${API_V1}/purposes/bindings`)
  if (!res.ok) throw new Error(`List bindings failed (${res.status} ${res.statusText})`)
  const data = await res.json()
  const bindings: AgentPurposeBinding[] = data.bindings || []
  if (bindings.length === 0) return 'No agent-purpose bindings.'
  const lines = bindings.map((b) => `- ${b.agentName || b.agentId} → ${b.purposeName || b.purposeId} (${b.status || 'unknown'}, confidence ${b.confidence ?? '—'})`)
  return `**${bindings.length} binding(s)**\n\n${lines.join('\n')}`
}

async function listViolations(): Promise<string> {
  const res = await fetch(`${API_V1}/purposes/violations?pageSize=20`)
  if (!res.ok) throw new Error(`List violations failed (${res.status} ${res.statusText})`)
  const data = await res.json()
  const violations: PurposeViolation[] = data.violations || []
  if (violations.length === 0) return 'No purpose violations.'
  const lines = violations.map((v) => {
    const state = v.resolvedAt ? 'resolved' : 'open'
    return `- [${v.severity || '—'}] ${v.agentName || 'agent'} / ${v.purposeName || 'purpose'}: ${v.violation} (${state})`
  })
  return `**${violations.length} violation(s)**\n\n${lines.join('\n')}`
}

async function bindAgent(agentId: string, purposeId: string, confidence: number): Promise<string> {
  const res = await fetch(`${API_V1}/purposes/bind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, purposeId, confidence }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bind failed (${res.status} ${res.statusText}): ${text}`)
  }
  return `Agent ${agentId} bound to purpose ${purposeId} (confidence ${confidence}).`
}

async function unbindAgent(agentId: string, purposeId: string): Promise<string> {
  const res = await fetch(`${API_V1}/purposes/unbind`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, purposeId }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Unbind failed (${res.status} ${res.statusText}): ${text}`)
  }
  return `Agent ${agentId} unbound from purpose ${purposeId}.`
}

const purpose: Command = {
  type: 'prompt',
  name: 'purpose',
  aliases: ['purposes'],
  description: 'Manage agent-purpose bindings and monitor purpose violations',
  progressMessage: 'managing purpose bindings',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const { subcommand, tokens } = parseArgs(args)

    try {
      switch (subcommand) {
        case 'list':
          return [{ type: 'text', text: await listPurposes() }]
        case 'bindings':
          return [{ type: 'text', text: await listBindings() }]
        case 'violations':
          return [{ type: 'text', text: await listViolations() }]
        case 'bind': {
          const agentId = tokens[1]
          const purposeId = tokens[2]
          const confidence = Number.parseFloat(tokens[3]) || 1.0
          if (!agentId || !purposeId) {
            return [{ type: 'text', text: 'Usage: /purpose bind <agent-id> <purpose-id> [confidence]' }]
          }
          return [{ type: 'text', text: await bindAgent(agentId, purposeId, confidence) }]
        }
        case 'unbind': {
          const agentId = tokens[1]
          const purposeId = tokens[2]
          if (!agentId || !purposeId) {
            return [{ type: 'text', text: 'Usage: /purpose unbind <agent-id> <purpose-id>' }]
          }
          return [{ type: 'text', text: await unbindAgent(agentId, purposeId) }]
        }
        default:
          return [{ type: 'text', text: 'Usage: /purpose [list|bindings|violations|bind <agent-id> <purpose-id> [confidence]|unbind <agent-id> <purpose-id>]' }]
      }
    } catch (err) {
      return [{ type: 'text', text: `Purpose command failed: ${err instanceof Error ? err.message : String(err)}` }]
    }
  },
}

export default purpose
