/**
 * message_agent (Bot Mode, phase B4 — D5, see docs/GIZZI_BOT_MODE_SPEC.md).
 *
 * Fire-and-forget DM between bots. The tool exists ONLY in canonical bot chat
 * sessions: ToolRegistry has no session context, so the registry lists it
 * unconditionally (like every builtin) and SessionPrompt.resolveTools deletes
 * it from the per-session tool record unless the session is a canonical bot
 * chat — the same gate-and-delete precedent as applyMobileToolGating.
 * `isMessageAgentSession` below is the single predicate both sides use.
 *
 * Semantics (platform parity): the message travels as a plain tool parameter
 * (never shell-interpreted), is validated against the live roster
 * (case-insensitive, ambiguity lists the exact handles, Hermes-style), is
 * appended to the TARGET bot's durable inbox (~/.gizzi/bots/<target>/
 * inbox.jsonl, 0o600, atomic append), and the sender gets an acknowledgement.
 * The reply arrives later as a background message in the sender's canonical
 * chat (see bot-inbox.ts pickup in SessionPrompt).
 */
import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"
import { BotStoreError, listBots, type Bot } from "@/runtime/bots/bot-store"
import { findBotByCanonicalSession, isCanonicalBotSession } from "@/runtime/bots/canonical-chat"
import { appendBotInbox } from "@/runtime/bots/bot-inbox"

/**
 * The single gating predicate (D5): message_agent is offered only when the
 * current session is some bot's pinned canonical chat. Regular chats,
 * subagents, and coordinator workers never see the tool.
 */
export async function isMessageAgentSession(sessionID: string): Promise<boolean> {
  return isCanonicalBotSession(sessionID)
}

/**
 * Resolve a target handle against a roster snapshot. Exact match wins; a
 * unique case-insensitive match resolves; zero matches and ambiguity are
 * structured tool errors (ambiguity lists the exact handles, Hermes-style).
 * Pure so tests can drive ambiguity with synthetic rosters — manufacturing a
 * case-collision on disk aliases directories on case-insensitive filesystems.
 */
export function matchMessageTarget(target: string, bots: Bot[]): Bot {
  const name = target.trim()
  if (!name) throw new BotStoreError("message_agent: target must be a bot name")
  const exact = bots.find((b) => b.name === name)
  if (exact) return exact
  const lower = name.toLowerCase()
  const matches = bots.filter((b) => b.name.toLowerCase() === lower)
  if (matches.length === 0) {
    const known = bots.map((b) => b.name).join(", ")
    throw new BotStoreError(
      `message_agent: unknown teammate '${name}' — known bots: ${known || "(none)"}`,
    )
  }
  if (matches.length > 1) {
    throw new BotStoreError(
      `message_agent: target '${name}' is ambiguous — it matches: ${matches.map((b) => b.name).join(", ")}`,
    )
  }
  return matches[0]!
}

/** Resolve a target handle against the live roster. */
export async function resolveMessageTarget(target: string): Promise<Bot> {
  return matchMessageTarget(target, await listBots())
}

const DESCRIPTION = `Message a teammate bot (Bot Mode DM). Fire-and-forget: the message is
appended to the target bot's durable inbox and picked up when its canonical
chat starts its next turn — the reply arrives in THIS chat as a background
message with attribution ("Message from 🤖 <name> (@<name>): ...").

- target: teammate bot name (see the Teammates section of your system prompt).
  Lookup is case-insensitive; unknown targets error, ambiguous targets list
  the exact handles.
- message: the plain-text message. It travels as a tool parameter — never
  shell-interpreted, never forwarded into a running turn.

Use this to hand off work, ask a teammate a question, or pass context. Do not
use it for external email (send_agent_email) or user-facing output.`

export const MessageAgentTool = Tool.define("message_agent", {
  description: DESCRIPTION,
  parameters: z.object({
    target: z.string().describe("Teammate bot name (case-insensitive; must exist in the roster)"),
    message: z.string().describe("Plain-text message to deliver to the target bot's inbox"),
  }),
  async execute(params, ctx) {
    // The sender is the bot whose canonical session is running this turn.
    // Gating guarantees this resolves; when it does not, fail closed with a
    // structured error rather than delivering under a bogus identity.
    const sender = await findBotByCanonicalSession(ctx.sessionID)
    if (!sender) {
      throw new BotStoreError(
        "message_agent: this session is not a canonical bot chat — the tool is unavailable here",
      )
    }

    const target = await resolveMessageTarget(params.target)
    const text = params.message.trim()
    if (!text) throw new BotStoreError("message_agent: message must not be empty")

    await appendBotInbox(target.name, {
      from: sender.name,
      fromSessionId: ctx.sessionID,
      message: text,
      at: new Date().toISOString(),
    })

    return {
      title: `Messaged ${target.name}`,
      output: `delivered to ${target.name}'s inbox; the reply arrives as a background completion`,
      metadata: { target: target.name, from: sender.name, delivered: true },
    }
  },
})
