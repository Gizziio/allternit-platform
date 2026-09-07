/**
 * Bot presence (Bot Mode, phase B5 — see docs/GIZZI_BOT_MODE_SPEC.md).
 *
 * Heartbeat presence for the TUI bots pane: a bot is "active" while its
 * canonical chat is working. `SessionPrompt` records activity at every turn
 * start (presence = working — the heartbeat lands before the model call, not
 * after success), and turn-start inbox pickup means a bot woken by
 * message_agent also shows active.
 *
 * Storage is a dependency-light touch: each heartbeat appends one ISO
 * timestamp line to `<bot dir>/.last-activity` (0o600, created inside the
 * 0o700 bot home). Readers take the newest parseable line, so a torn write
 * degrades to an older heartbeat instead of a lost bot. The file is small in
 * practice — one line per turn — and absence of the file means "never seen
 * active".
 *
 * This module stays free of CLI/UI/session-runtime imports so bun tests can
 * drive it with only a sandboxed GIZZI_CONFIG_DIR. The canonical-chat import
 * below only reaches bot-store, so there is no cycle.
 */
import { appendFile, mkdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { botDir, listBots } from "@/runtime/bots/bot-store"
import { findBotByCanonicalSession } from "@/runtime/bots/canonical-chat"

/** A bot counts as active for this long after its most recent heartbeat. */
export const PRESENCE_WINDOW_MS = 90_000

/** Heartbeat file inside the bot home. */
export const LAST_ACTIVITY_FILE = ".last-activity"

export function lastActivityPath(name: string): string {
  return join(botDir(name), LAST_ACTIVITY_FILE)
}

/**
 * Record one heartbeat for the bot: append an ISO timestamp line to
 * `.last-activity` (0o600). The bot directory is created defensively (0o700),
 * mirroring the bot-inbox precedent. `opts.now` is injectable for tests.
 */
export async function recordBotActivity(
  name: string,
  opts: { now?: Date } = {},
): Promise<void> {
  const now = opts.now ?? new Date()
  const dir = botDir(name)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await appendFile(lastActivityPath(name), now.toISOString() + "\n", { mode: 0o600 })
}

/** Newest parseable heartbeat in ms since epoch, or null when none exists. */
async function lastActivityMs(name: string): Promise<number | null> {
  let raw: string
  try {
    raw = await readFile(lastActivityPath(name), "utf8")
  } catch {
    return null
  }
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  for (let i = lines.length - 1; i >= 0; i--) {
    const ms = Date.parse(lines[i])
    if (!Number.isNaN(ms)) return ms
  }
  return null
}

/** True when the bot's most recent heartbeat is inside the presence window. */
export async function isBotActive(name: string, now: Date = new Date()): Promise<boolean> {
  const last = await lastActivityMs(name)
  if (last === null) return false
  return now.getTime() - last < PRESENCE_WINDOW_MS
}

/** Names of every bot currently inside the presence window, sorted. */
export async function getActiveBotNames(now: Date = new Date()): Promise<string[]> {
  const bots = await listBots()
  const active: string[] = []
  for (const bot of bots) {
    if (await isBotActive(bot.name, now)) active.push(bot.name)
  }
  return active.sort((a, b) => a.localeCompare(b))
}

/**
 * Turn-start heartbeat used by SessionPrompt: when `sessionID` is some bot's
 * canonical chat, record activity for that bot. Non-canonical sessions and
 * store/fs errors are swallowed — presence must never break a turn.
 */
export async function recordCanonicalChatActivity(
  sessionID: string,
  opts: { now?: Date } = {},
): Promise<void> {
  if (!sessionID) return
  let bot: { name: string } | null = null
  try {
    bot = await findBotByCanonicalSession(sessionID)
  } catch {
    return
  }
  if (!bot) return
  await recordBotActivity(bot.name, opts).catch(() => {
    // Best-effort heartbeat — a presence write failure must not fail the turn.
  })
}
