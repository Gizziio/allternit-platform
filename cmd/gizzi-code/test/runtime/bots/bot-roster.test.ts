// @ts-nocheck
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "../../fixture/fixture"
import { botDir, createBot, pinCanonicalSession } from "../../../src/runtime/bots/bot-store"
import { appendBotInbox, drainBotInbox } from "../../../src/runtime/bots/bot-inbox"
import {
  botWatermarkPath,
  getBotRosterRows,
  markBotRead,
} from "../../../src/runtime/bots/bot-roster"
import { getActiveBotNames, recordBotActivity } from "../../../src/runtime/bots/bot-presence"

/**
 * Phase B5 — roster + unread store: row shape, active-first-then-name
 * sorting, unread from pending inbox lines, watermark-driven markBotRead
 * (idempotent, no-op for unknown bots). Presence state comes from the real
 * bot-presence module (same GIZZI_CONFIG_DIR sandbox). The canonical-chat
 * unread term and hasCanonicalChat resolve against a real temp sqlite
 * session store (XDG_DATA_HOME sandbox) with no Instance context — that is
 * the thin-context path the session-db helper exists for.
 */

let tmp: { path: string }

beforeAll(async () => {
  tmp = await tmpdir()
  process.env.GIZZI_CONFIG_DIR = join(tmp.path, ".gizzi")
  // Session store sandbox (xdg-basedir reads these at first Global import).
  process.env.XDG_DATA_HOME = join(tmp.path, "xdg-data")
  process.env.XDG_CACHE_HOME = join(tmp.path, "xdg-cache")
  process.env.XDG_CONFIG_HOME = join(tmp.path, "xdg-config")
  process.env.XDG_STATE_HOME = join(tmp.path, "xdg-state")
})

afterAll(() => {
  delete process.env.GIZZI_CONFIG_DIR
  delete process.env.XDG_DATA_HOME
  delete process.env.XDG_CACHE_HOME
  delete process.env.XDG_CONFIG_HOME
  delete process.env.XDG_STATE_HOME
  rmSync(join(tmp.path, ".gizzi"), { recursive: true, force: true })
})

describe("getBotRosterRows", () => {
  test("returns one row per bot with exactly the contract shape", async () => {
    await createBot({
      name: "shape-bot",
      title: "Shape Bot",
      description: "row shape probe",
      model: "anthropic/claude-sonnet-4-5",
    })
    await createBot({ name: "shape-plain", title: "Plain" })

    const rows = await getBotRosterRows()
    const row = rows.find((r) => r.name === "shape-bot")

    expect(row).toBeDefined()
    expect(Object.keys(row).sort()).toEqual(
      [
        "active",
        "description",
        "hasCanonicalChat",
        "model",
        "name",
        "title",
        "unreadCount",
      ].sort(),
    )
    expect(row.title).toBe("Shape Bot")
    expect(row.description).toBe("row shape probe")
    expect(row.model).toBe("anthropic/claude-sonnet-4-5")
    expect(row.hasCanonicalChat).toBe(false) // never pinned/opened
    expect(row.active).toBe(false)
    expect(row.unreadCount).toBe(0)

    const plain = rows.find((r) => r.name === "shape-plain")
    expect(plain.model).toBeNull()
    expect(plain.description).toBe("")
  })

  test("sorts active bots first, then by name", async () => {
    await createBot({ name: "sort-alpha", title: "Alpha" })
    await createBot({ name: "sort-beta", title: "Beta" })
    await createBot({ name: "sort-gamma", title: "Gamma" })

    await recordBotActivity("sort-gamma")
    await recordBotActivity("sort-beta")

    const rows = await getBotRosterRows()
    const names = rows.map((r) => r.name)

    expect(names.indexOf("sort-beta")).toBeLessThan(names.indexOf("sort-alpha"))
    expect(names.indexOf("sort-gamma")).toBeLessThan(names.indexOf("sort-alpha"))
    expect(names.indexOf("sort-beta")).toBeLessThan(names.indexOf("sort-gamma"))
    // active rows carry the flag
    const beta = rows.find((r) => r.name === "sort-beta")
    const gamma = rows.find((r) => r.name === "sort-gamma")
    const alpha = rows.find((r) => r.name === "sort-alpha")
    expect(beta.active).toBe(true)
    expect(gamma.active).toBe(true)
    expect(alpha.active).toBe(false)
    // inactive remainder still name-sorted
    const inactive = rows.filter((r) => !r.active).map((r) => r.name)
    expect(inactive).toEqual([...inactive].sort((a, b) => a.localeCompare(b)))
  })

  test("unreadCount counts pending inbox envelopes and drops to 0 after drain", async () => {
    await createBot({ name: "unread-bot", title: "Unread Bot" })

    await appendBotInbox("unread-bot", {
      from: "sender",
      fromSessionId: "ses_sender",
      message: "one",
      at: new Date().toISOString(),
    })
    await appendBotInbox("unread-bot", {
      from: "sender",
      fromSessionId: "ses_sender",
      message: "two",
      at: new Date().toISOString(),
    })

    let rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "unread-bot").unreadCount).toBe(2)

    await drainBotInbox("unread-bot")
    rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "unread-bot").unreadCount).toBe(0)
  })

  test("unreadCount tolerates a malformed watermark", async () => {
    await createBot({ name: "bad-watermark", title: "Bad Watermark" })
    writeFileSync(botWatermarkPath("bad-watermark"), "not json{")

    await appendBotInbox("bad-watermark", {
      from: "sender",
      fromSessionId: "ses_sender",
      message: "ping",
      at: new Date().toISOString(),
    })

    const rows = await getBotRosterRows()
    // inbox term still counts; the garbage watermark adds nothing and breaks nothing
    expect(rows.find((r) => r.name === "bad-watermark").unreadCount).toBe(1)
  })
})

describe("markBotRead", () => {
  test("writes a watermark for the pinned session and is idempotent", async () => {
    await createBot({ name: "read-bot", title: "Read Bot" })
    await pinCanonicalSession("read-bot", {
      projectPath: "/tmp/some-project",
      sessionId: "ses_pinned",
    })

    await markBotRead("read-bot")
    expect(existsSync(botWatermarkPath("read-bot"))).toBe(true)

    const first = JSON.parse(readFileSync(botWatermarkPath("read-bot"), "utf8"))
    // no Instance context in tests — the count degrades to 0, sessionId stays pinned
    expect(first).toEqual({ sessionId: "ses_pinned", messageCount: 0 })

    await markBotRead("read-bot")
    const second = JSON.parse(readFileSync(botWatermarkPath("read-bot"), "utf8"))
    expect(second).toEqual(first)
  })

  test("stamps a null-sessionId watermark for an unpinned bot", async () => {
    await createBot({ name: "unpinned-bot", title: "Unpinned" })

    await markBotRead("unpinned-bot")
    const watermark = JSON.parse(readFileSync(botWatermarkPath("unpinned-bot"), "utf8"))
    expect(watermark).toEqual({ sessionId: null, messageCount: 0 })

    // a null-sessionId watermark never matches a later pin, so chat unread stays 0
    await pinCanonicalSession("unpinned-bot", {
      projectPath: "/tmp/some-project",
      sessionId: "ses_later",
    })
    const rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "unpinned-bot").unreadCount).toBe(0)
  })

  test("is a no-op for unknown bots", async () => {
    await markBotRead("no-such-bot")
    expect(existsSync(botWatermarkPath("no-such-bot"))).toBe(false)
  })

  test("watermark with a mismatched sessionId contributes no chat unread", async () => {
    await createBot({ name: "mismatch-bot", title: "Mismatch" })
    await pinCanonicalSession("mismatch-bot", {
      projectPath: "/tmp/some-project",
      sessionId: "ses_new",
    })
    // stale watermark from an older pin
    writeFileSync(
      botWatermarkPath("mismatch-bot"),
      JSON.stringify({ sessionId: "ses_old", messageCount: 0 }) + "\n",
    )

    const rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "mismatch-bot").unreadCount).toBe(0)
  })
})

describe("presence interop", () => {
  test("rows reflect recordBotActivity via bot-presence", async () => {
    await createBot({ name: "presence-bot", title: "Presence" })

    let rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "presence-bot").active).toBe(false)
    expect(await getActiveBotNames()).not.toContain("presence-bot")

    await recordBotActivity("presence-bot")
    expect(await getActiveBotNames()).toContain("presence-bot")

    rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "presence-bot").active).toBe(true)
  })
})

describe("canonical-chat unread without Instance context (session-db)", () => {
  const runPrefix = `ses-chat-unread-${Date.now()}`

  afterAll(async () => {
    // Remove this run's seeded rows wherever the lazy store singleton bound
    // (tmp sandbox, or — when a co-run file opened it first — the real data
    // dir). Unique per-run ids make this exact and safe.
    try {
      const { Database, sql } = await import("../../../src/runtime/session/storage/db")
      Database.use((db) => {
        db.run(sql`DELETE FROM message WHERE id LIKE ${runPrefix + "-%-m-%"}`)
        db.run(sql`DELETE FROM session WHERE id LIKE ${runPrefix + "-%"}`)
        db.run(sql`DELETE FROM project WHERE id LIKE ${"proj-" + runPrefix + "-%"}`)
      })
    } catch {
      // store never opened in this process — nothing to clean
    }
  })

  let seedSeq = 0
  async function seedSession(sessionId: string, messageCount: number) {
    const { Database } = await import("../../../src/runtime/session/storage/db")
    const { SessionTable, MessageTable } = await import("../../../src/runtime/session/session.sql")
    const { ProjectTable } = await import("../../../src/runtime/context/project/project.sql")
    const batch = seedSeq++
    Database.use((db) => {
      db.insert(ProjectTable)
        .values({ id: `proj-${sessionId}`, worktree: "/tmp/x", sandboxes: [] })
        .onConflictDoNothing()
        .run()
      db.insert(SessionTable)
        .values({
          id: sessionId,
          project_id: `proj-${sessionId}`,
          slug: "s",
          directory: "/tmp/x",
          title: "canonical",
          version: "1",
        })
        .onConflictDoNothing()
        .run()
      for (let i = 0; i < messageCount; i++) {
        db.insert(MessageTable)
          .values({ id: `${sessionId}-m-${batch}-${i}`, session_id: sessionId, data: {} })
          .run()
      }
    })
  }

  test("hasCanonicalChat resolves and unread counts chat activity past the watermark", async () => {
    await createBot({ name: "chat-unread", title: "Chat Unread" })
    // Per-run unique session id: whatever database the lazy store singleton is
    // bound to (an earlier test file in a co-run process may have opened it
    // before this file's XDG sandbox was set), this session's rows can never
    // collide with a previous run's leftovers.
    const sessionId = `${runPrefix}-${Math.floor(Math.random() * 1e6)}`
    await seedSession(sessionId, 5)
    await pinCanonicalSession("chat-unread", {
      projectPath: "/tmp/x",
      sessionId,
    })

    let rows = await getBotRosterRows()
    const row = rows.find((r) => r.name === "chat-unread")
    expect(row.hasCanonicalChat).toBe(true)

    // catch up: watermark stamps the current count (5)
    await markBotRead("chat-unread")
    rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "chat-unread").unreadCount).toBe(0)

    // two new messages in the canonical chat -> unread 2
    await seedSession(sessionId, 2)
    rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "chat-unread").unreadCount).toBe(2)

    // pending inbox envelopes add on top
    await appendBotInbox("chat-unread", { id: "env-1", from: "other", fromSessionId: "ses-x", message: "hi", at: Date.now() })
    rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "chat-unread").unreadCount).toBe(3)
    await drainBotInbox("chat-unread")

    // markBotRead catches up again with the true count, idempotently
    await markBotRead("chat-unread")
    rows = await getBotRosterRows()
    expect(rows.find((r) => r.name === "chat-unread").unreadCount).toBe(0)
  })
})
