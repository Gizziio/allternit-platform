// @ts-nocheck
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync, statSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "../../fixture/fixture"
import { createBot, pinCanonicalSession } from "../../../src/runtime/bots/bot-store"
import {
  getActiveBotNames,
  isBotActive,
  lastActivityPath,
  PRESENCE_WINDOW_MS,
  recordBotActivity,
  recordCanonicalChatActivity,
} from "../../../src/runtime/bots/bot-presence"

let tmp: { path: string }

beforeAll(async () => {
  tmp = await tmpdir()
  process.env.GIZZI_CONFIG_DIR = join(tmp.path, ".gizzi")
})

afterAll(() => {
  delete process.env.GIZZI_CONFIG_DIR
  rmSync(join(tmp.path, ".gizzi"), { recursive: true, force: true })
})

const T0 = new Date("2026-09-07T00:00:00Z")

function at(ms: number): Date {
  return new Date(T0.getTime() + ms)
}

describe("recordBotActivity", () => {
  test("creates .last-activity with 0o600 inside the bot home", async () => {
    await createBot({ name: "ada", title: "Ada" })
    await recordBotActivity("ada", { now: T0 })

    const path = lastActivityPath("ada")
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).mode & 0o077).toBe(0)
    // One ISO timestamp line, parseable back to the injected clock.
    const lines = readFileSync(path, "utf8").trim().split("\n")
    expect(lines).toHaveLength(1)
    expect(Date.parse(lines[0])).toBe(T0.getTime())
  })

  test("appends one line per heartbeat; newest wins on read", async () => {
    await createBot({ name: "bo", title: "Bo" })
    await recordBotActivity("bo", { now: T0 })
    await recordBotActivity("bo", { now: at(60_000) })

    const lines = readFileSync(lastActivityPath("bo"), "utf8").trim().split("\n")
    expect(lines).toHaveLength(2)
    expect(await isBotActive("bo", at(60_000 + 10_000))).toBe(true)
  })

  test("does not rewrite file mode on later appends", async () => {
    await createBot({ name: "cy", title: "Cy" })
    await recordBotActivity("cy", { now: T0 })
    await recordBotActivity("cy", { now: at(1_000) })
    expect(statSync(lastActivityPath("cy")).mode & 0o077).toBe(0)
  })
})

describe("window math", () => {
  test("bot is active 89s after heartbeat, inactive 91s after", async () => {
    await createBot({ name: "dot", title: "Dot" })
    await recordBotActivity("dot", { now: T0 })

    expect(PRESENCE_WINDOW_MS).toBe(90_000)
    expect(await isBotActive("dot", at(89_000))).toBe(true)
    expect(await isBotActive("dot", at(91_000))).toBe(false)
  })

  test("never-recorded bot is inactive", async () => {
    await createBot({ name: "eli", title: "Eli" })
    expect(await isBotActive("eli", T0)).toBe(false)
  })

  test("missing bot is inactive, not an error", async () => {
    expect(await isBotActive("no-such-bot", T0)).toBe(false)
  })

  test("heartbeat survives clock read at the exact window edge", async () => {
    await createBot({ name: "fox", title: "Fox" })
    await recordBotActivity("fox", { now: T0 })
    // Below the window → active; at/above → inactive (half-open [0, window)).
    expect(await isBotActive("fox", at(PRESENCE_WINDOW_MS - 1))).toBe(true)
    expect(await isBotActive("fox", at(PRESENCE_WINDOW_MS))).toBe(false)
  })
})

describe("getActiveBotNames", () => {
  test("returns only in-window bots, sorted by name", async () => {
    // Far past every other describe's heartbeats so only this test's
    // heartbeats can be in-window.
    const base = at(10_000_000)
    await createBot({ name: "zed", title: "Zed" })
    await createBot({ name: "amy", title: "Amy" })
    await createBot({ name: "kim", title: "Kim" })

    await recordBotActivity("zed", { now: base })
    await recordBotActivity("amy", { now: new Date(base.getTime() + 10_000) })
    // kim never heartbeats — filtered out.

    const now = new Date(base.getTime() + 20_000)
    expect(await getActiveBotNames(now)).toEqual(["amy", "zed"])

    // After the window closes only the freshest remains.
    expect(await getActiveBotNames(new Date(base.getTime() + 99_000))).toEqual(["amy"])
    expect(await getActiveBotNames(new Date(base.getTime() + 101_000))).toEqual([])
  })
})

describe("recordCanonicalChatActivity (SessionPrompt hook)", () => {
  test("records a heartbeat when the session is a bot's canonical chat", async () => {
    await createBot({ name: "bob", title: "Bob" })
    await pinCanonicalSession("bob", { projectPath: tmp.path, sessionId: "sess-bob" })

    await recordCanonicalChatActivity("sess-bob", { now: T0 })
    expect(existsSync(lastActivityPath("bob"))).toBe(true)
    expect(await isBotActive("bob", at(5_000))).toBe(true)
  })

  test("does nothing for non-canonical sessions", async () => {
    await createBot({ name: "hal", title: "Hal" })

    await recordCanonicalChatActivity("sess-human", { now: T0 })
    expect(existsSync(lastActivityPath("hal"))).toBe(false)

    // A bot with no canonical pin at all is also skipped.
    await recordCanonicalChatActivity("", { now: T0 })
    expect(existsSync(lastActivityPath("hal"))).toBe(false)
    expect(await getActiveBotNames(at(5_000))).not.toContain("hal")
  })

  test("targets exactly the pinned bot, leaving teammates untouched", async () => {
    await createBot({ name: "pip", title: "Pip" })
    await createBot({ name: "quinn", title: "Quinn" })
    await pinCanonicalSession("pip", { projectPath: tmp.path, sessionId: "sess-pip" })

    await recordCanonicalChatActivity("sess-pip", { now: T0 })
    expect(existsSync(lastActivityPath("pip"))).toBe(true)
    expect(existsSync(lastActivityPath("quinn"))).toBe(false)
  })
})
