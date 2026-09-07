/**
 * Bot roster + unread store (Bot Mode, phase B5 — TUI bots pane, see
 * docs/GIZZI_BOT_MODE_SPEC.md).
 *
 * `getBotRosterRows` merges the bot profile store (B1) with presence (B5
 * presence agent's bot-presence) and unread counts into one row per bot for
 * the TUI bots pane. `markBotRead` is the pane's "caught up" action: it
 * stamps a watermark in the bot's home directory recording how far the
 * reader has seen.
 *
 * Unread model:
 * - pending inbox envelopes (lines in `inbox.jsonl`) always count;
 * - plus unread activity in the canonical chat, tracked by the
 *   `<botdir>/.watermark` file `{ sessionId, messageCount }`: when the
 *   watermark's sessionId matches the pinned canonical session,
 *   `max(0, currentCount - watermarkCount)` is added. The current count is a
 *   direct COUNT query via `session-db.ts` — it works with or without a
 *   bootstrap Instance context (thin contexts only need the data dir, which
 *   the helper ensures); a genuinely unreadable store degrades the chat term
 *   to 0 so unread is inbox-only, never an error.
 *
 * This module is deliberately free of CLI/UI imports so bun tests can drive
 * it with only a sandboxed GIZZI_CONFIG_DIR.
 */
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { getActiveBotNames } from "@/runtime/bots/bot-presence"
import { countBotInbox } from "@/runtime/bots/bot-inbox"
import { resolveCanonicalSession } from "@/runtime/bots/canonical-chat"
import { botDir, getBot, listBots } from "@/runtime/bots/bot-store"

/* -------------------------------------------------------------------------- */
/* Row shape (B5 contract)                                                    */
/* -------------------------------------------------------------------------- */

export interface BotRosterRow {
  name: string
  title: string
  description: string
  model: string | null
  hasCanonicalChat: boolean
  active: boolean
  unreadCount: number
}

/* -------------------------------------------------------------------------- */
/* Read watermark (unread store)                                              */
/* -------------------------------------------------------------------------- */

/**
 * What `markBotRead` stamped: the pinned canonical session the reader saw,
 * and how many messages it had at that time. `sessionId` is null when the
 * bot had no pin at mark time (the watermark then never matches, so the
 * chat-unread term stays 0).
 */
export interface BotReadWatermark {
  sessionId: string | null
  messageCount: number
}

export function botWatermarkPath(name: string): string {
  return join(botDir(name), ".watermark")
}

function parseWatermark(raw: string): BotReadWatermark | null {
  try {
    const parsed = JSON.parse(raw) as Partial<BotReadWatermark>
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof parsed.messageCount === "number" &&
      (typeof parsed.sessionId === "string" || parsed.sessionId === null)
    ) {
      return { sessionId: parsed.sessionId, messageCount: parsed.messageCount }
    }
    return null
  } catch {
    return null
  }
}

async function readWatermark(name: string): Promise<BotReadWatermark | null> {
  try {
    return parseWatermark(await readFile(botWatermarkPath(name), "utf8"))
  } catch {
    return null // no watermark (or unreadable) — treat as never marked read
  }
}

/* -------------------------------------------------------------------------- */
/* Canonical chat message count (best-effort)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Current message count of the pinned canonical session, via a direct COUNT
 * query against the session store — identical to the Instance-context path
 * (same drizzle store, same table), but also works in thin contexts where the
 * CLI bootstrap never ran (the data dir is ensured inside). Returns null when
 * the store is genuinely unreadable: callers degrade to inbox-only unread
 * rather than failing.
 */
async function canonicalSessionMessageCount(sessionId: string): Promise<number | null> {
  try {
    const { countSessionMessages } = await import("@/runtime/bots/session-db")
    return await countSessionMessages(sessionId)
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Roster rows                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One row per bot: identity from the profile store, presence from
 * bot-presence, `hasCanonicalChat` from canonical-chat resolution, and the
 * unread badge (pending inbox envelopes + unread canonical-chat activity
 * past the watermark). Sorted active-first, then by name.
 */
export async function getBotRosterRows(now?: Date): Promise<BotRosterRow[]> {
  const [bots, activeNames] = await Promise.all([
    listBots(),
    // Presence must never break the roster — degrade to "nobody active".
    getActiveBotNames(now).catch(() => [] as string[]),
  ])
  const active = new Set(activeNames)

  const rows = await Promise.all(
    bots.map(async (bot): Promise<BotRosterRow> => {
      const [inboxPending, watermark, canonical] = await Promise.all([
        countBotInbox(bot.name),
        readWatermark(bot.name),
        // Tolerate the cost: one session-store probe per pinned bot.
        resolveCanonicalSession(bot).catch(() => null),
      ])

      let chatUnread = 0
      const pinnedId = bot.canonicalSession?.sessionId ?? null
      if (watermark && pinnedId !== null && watermark.sessionId === pinnedId) {
        const current = await canonicalSessionMessageCount(pinnedId)
        if (current !== null) {
          chatUnread = Math.max(0, current - watermark.messageCount)
        }
      }

      return {
        name: bot.name,
        title: bot.title,
        description: bot.description,
        model: bot.model,
        hasCanonicalChat: canonical !== null,
        active: active.has(bot.name),
        unreadCount: inboxPending + chatUnread,
      }
    }),
  )

  return rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/* -------------------------------------------------------------------------- */
/* Mark read                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Stamp the read watermark for a bot: `{ sessionId: pinnedId, messageCount:
 * <current or 0> }` (0 when the session store is unreachable). Idempotent —
 * an identical watermark is not rewritten. No-op for unknown bots.
 */
export async function markBotRead(name: string): Promise<void> {
  const bot = await getBot(name).catch(() => null)
  if (!bot) return

  const pinnedId = bot.canonicalSession?.sessionId ?? null
  const current = pinnedId !== null ? await canonicalSessionMessageCount(pinnedId) : null
  const watermark: BotReadWatermark = { sessionId: pinnedId, messageCount: current ?? 0 }

  const existing = await readWatermark(bot.name)
  if (
    existing !== null &&
    existing.sessionId === watermark.sessionId &&
    existing.messageCount === watermark.messageCount
  ) {
    return
  }

  await writeFile(botWatermarkPath(bot.name), JSON.stringify(watermark) + "\n", {
    mode: 0o600,
  })
}
