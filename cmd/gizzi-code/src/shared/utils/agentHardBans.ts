/**
 * Dispatch-time hard-ban guard for agent tool calls.
 *
 * The platform character layer (`surfaces/ai.allternit.com/src/lib/agents/character.service.ts`)
 * attaches `hardBans` to an agent's role card and checks them PRE-RUN against the
 * run input text (`detectBanViolation`). That check never sees mid-run tool calls —
 * a banned agent could still call `gmail.send_email` via the connectors MCP. This
 * module is the runtime-side counterpart: tool dispatchers consult it before
 * executing a tool call and turn a banned call into a structured denial.
 *
 * How the ban config reaches the runtime (contract with the bot runner /
 * allternit-api, same env-var path that already carries ALLTERNIT_USER_ID etc.):
 *
 *   ALLTERNIT_AGENT_ID         platform agent id for this session (also the
 *                              default sender identity for the send_agent_email tool)
 *   ALLTERNIT_AGENT_HARD_BANS  JSON array of the agent's hard bans. Entries are
 *                              either plain category strings ("email_send") or
 *                              RoleHardBan-shaped objects
 *                              ({ category, enforcement?, label? }). Object entries
 *                              are enforced only when enforcement is "tool-block"
 *                              (or absent — safe default), matching
 *                              detectBanViolation semantics.
 *
 * The check is data-driven: CATEGORY_POLICIES maps a ban category to the native
 * tool names, (qualified) MCP tool-name patterns, and execute_action action-id
 * globs it blocks. Categories without a policy entry are not enforced here.
 */

/** A single hard ban as seen by the runtime. `enforcement` defaults to
 * "tool-block" when omitted (a bare category string means "block it"). */
export interface AgentHardBan {
  category: string
  enforcement?: string
  label?: string
}

export interface HardBanViolation {
  category: string
  label?: string
  /** What matched: the tool name or the execute_action actionId. */
  matched: string
  reason: string
}

interface CategoryPolicy {
  /** Native (built-in registry) tool ids blocked by this category. */
  nativeToolNames: string[]
  /** Patterns tested against the fully-qualified tool name, e.g.
   * "mcp__allternit-connectors__gmail_send_email" (MCP names are normalized:
   * dots in the upstream tool name become underscores). */
  toolNamePatterns: RegExp[]
  /** Globs ("*" = any run of non-dot chars) tested against the `actionId`
   * argument of execute_action-style MCP dispatcher tools. */
  actionIdPatterns: string[]
}

const EMAIL_SEND_POLICY: CategoryPolicy = {
  nativeToolNames: ["send_agent_email", "SendAgentEmail"],
  toolNamePatterns: [
    // Internal MCP allternit_mail.send → mcp__<server>__allternit_mail_send
    /allternit_mail[._]send/,
    // Connector apps that expose send/reply email as a direct MCP tool,
    // e.g. mcp__allternit-connectors__gmail_send_email
    /(?:^|[._])(?:send_email|reply_email)$/,
  ],
  actionIdPatterns: ["gmail.send_email", "*.send_email", "*.reply_email"],
}

/**
 * Banned tool/action patterns per hard-ban category. `email_send` and
 * `external_communication` share the same email-sending surface; other
 * categories (publishing, deploy, …) have no tool mapping yet and are
 * intentionally untouched.
 */
const CATEGORY_POLICIES: Record<string, CategoryPolicy> = {
  email_send: EMAIL_SEND_POLICY,
  external_communication: EMAIL_SEND_POLICY,
}

/** Platform agent id for this runtime, when launched as a bot/agent session. */
export function getRuntimeAgentId(): string | undefined {
  return process.env.ALLTERNIT_AGENT_ID?.trim() || undefined
}

/** Parse ALLTERNIT_AGENT_HARD_BANS. Unknown/malformed content degrades to "no
 * bans" rather than breaking tool dispatch for sessions without the contract. */
export function getAgentHardBans(): AgentHardBan[] {
  const raw = process.env.ALLTERNIT_AGENT_HARD_BANS?.trim()
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const bans: AgentHardBan[] = []
  for (const entry of parsed) {
    if (typeof entry === "string" && entry) {
      bans.push({ category: entry })
    } else if (entry && typeof entry === "object" && typeof (entry as any).category === "string") {
      const e = entry as Record<string, unknown>
      bans.push({
        category: e.category as string,
        enforcement: typeof e.enforcement === "string" ? e.enforcement : undefined,
        label: typeof e.label === "string" ? e.label : undefined,
      })
    }
  }
  return bans
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.*+?^${}()|[\]\\]/g, (ch) => (ch === "*" ? "\0" : `\\${ch}`))
  return new RegExp(`^${escaped.replace(/\0/g, "[^.]*")}$`)
}

/** execute_action-style dispatcher tools carry the real action id in their
 * `actionId` argument (services/open-connector/src/mcp.ts schema). */
function extractActionId(toolName: string, args: unknown): string | undefined {
  if (!toolName.includes("execute_action")) return undefined
  if (args && typeof args === "object" && typeof (args as any).actionId === "string") {
    return (args as any).actionId
  }
  return undefined
}

/**
 * Check a tool call against the active agent's tool-block hard bans.
 * Returns null when the call is allowed (no bans configured, category not
 * mapped, or nothing matched).
 */
export function checkToolHardBan(toolName: string, args: unknown): HardBanViolation | null {
  const bans = getAgentHardBans().filter((ban) => (ban.enforcement ?? "tool-block") === "tool-block")
  if (bans.length === 0) return null

  for (const ban of bans) {
    const policy = CATEGORY_POLICIES[ban.category]
    if (!policy) continue

    if (policy.nativeToolNames.includes(toolName) || policy.toolNamePatterns.some((p) => p.test(toolName))) {
      return {
        category: ban.category,
        label: ban.label,
        matched: toolName,
        reason: `Tool "${toolName}" is blocked by the agent's hard ban on ${ban.category}.`,
      }
    }

    const actionId = extractActionId(toolName, args)
    if (actionId && policy.actionIdPatterns.some((glob) => globToRegex(glob).test(actionId))) {
      return {
        category: ban.category,
        label: ban.label,
        matched: actionId,
        reason: `Connector action "${actionId}" is blocked by the agent's hard ban on ${ban.category}.`,
      }
    }
  }
  return null
}

/** Structured denial text surfaced as the tool result when a call is banned. */
export function formatHardBanDenial(violation: HardBanViolation): string {
  return (
    `blocked by agent policy: ${violation.category} — ${violation.reason}` +
    (violation.label ? ` (ban: ${violation.label})` : "") +
    " This is a dispatch-time hard ban (enforcement: tool-block); do not retry the send."
  )
}
