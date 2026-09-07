// @ts-nocheck
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { mkdir, stat, utimes, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "../../fixture/fixture"
import {
  createBot,
  getBot,
  pinCanonicalSession,
  setCapabilityEpoch,
  botDir,
} from "../../../src/runtime/bots/bot-store"
import { computeCapabilityEpoch, fnv1a } from "../../../src/runtime/bots/capability-epoch"
import {
  MEMORY_CHAR_BUDGET,
  botChatSystemPrompt,
  buildPersonaInjection,
  ensureCapabilityEpoch,
  isCanonicalBotSession,
  openCanonicalChat,
  resolveCanonicalSession,
  type CanonicalChatDeps,
} from "../../../src/runtime/bots/canonical-chat"

let tmp: { path: string }

beforeAll(async () => {
  tmp = await tmpdir()
  process.env.GIZZI_CONFIG_DIR = join(tmp.path, ".gizzi")
})

afterAll(() => {
  delete process.env.GIZZI_CONFIG_DIR
  rmSync(join(tmp.path, ".gizzi"), { recursive: true, force: true })
})

/* In-memory fake of the runtime session store — no database required. */
function fakeDeps(opts: { existing?: Record<string, string>; createdIds?: string[] } = {}) {
  const sessions = new Map(Object.entries(opts.existing ?? {}))
  let counter = 0
  const deps: CanonicalChatDeps = {
    async sessionExists(sessionId, projectPath) {
      return sessions.get(sessionId) === projectPath
    },
    async createSession(projectPath, _title) {
      const id = opts.createdIds?.[counter++] ?? `ses_fake_${sessions.size}_${counter}`
      sessions.set(id, projectPath)
      return { id }
    },
  }
  return { deps, sessions }
}

function readBotJson(name: string): any {
  return JSON.parse(readFileSync(join(botDir(name), "bot.json"), "utf8"))
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe("resolveCanonicalSession", () => {
  test("returns the pin when the pinned session exists", async () => {
    const bot = await createBot({ name: "res-ok", title: "Res Ok" })
    const { deps } = fakeDeps({ existing: { "ses_1": "/proj" } })
    await pinCanonicalSession("res-ok", { projectPath: "/proj", sessionId: "ses_1" })

    const resolved = await resolveCanonicalSession(await getBot("res-ok"), deps)
    expect(resolved).toEqual({ projectPath: "/proj", sessionId: "ses_1" })
  })

  test("returns null when the bot is not pinned", async () => {
    const bot = await createBot({ name: "res-none", title: "Res None" })
    expect(await resolveCanonicalSession(bot, fakeDeps().deps)).toBeNull()
  })

  test("returns null when the pinned session is missing from the store", async () => {
    await createBot({ name: "res-gone", title: "Res Gone" })
    await pinCanonicalSession("res-gone", { projectPath: "/proj", sessionId: "ses_deleted" })
    const bot = await getBot("res-gone")
    // empty store — the session was deleted (e.g. `gizzi session delete`)
    expect(await resolveCanonicalSession(bot, fakeDeps().deps)).toBeNull()
  })

  test("returns null instead of throwing when the store lookup fails", async () => {
    await createBot({ name: "res-err", title: "Res Err" })
    await pinCanonicalSession("res-err", { projectPath: "/proj", sessionId: "ses_x" })
    const bot = await getBot("res-err")
    const broken: CanonicalChatDeps = {
      async sessionExists() {
        throw new Error("db unreadable")
      },
      async createSession() {
        throw new Error("unreachable")
      },
    }
    expect(await resolveCanonicalSession(bot, broken)).toBeNull()
  })
})

describe("openCanonicalChat", () => {
  test("creates a session in the project dir and pins it (lazy birth)", async () => {
    const bot = await createBot({ name: "open-new", title: "Open New" })
    const { deps, sessions } = fakeDeps()

    const opened = await openCanonicalChat(bot, { projectPath: "/proj-a" }, deps)
    expect(opened.created).toBe(true)
    expect(opened.projectPath).toBe("/proj-a")
    expect(sessions.get(opened.sessionId)).toBe("/proj-a")

    const pinned = readBotJson("open-new")
    expect(pinned.canonicalSession).toEqual({
      projectPath: "/proj-a",
      sessionId: opened.sessionId,
    })
  })

  test("resumes an existing pin without creating a new session", async () => {
    await createBot({ name: "open-resume", title: "Open Resume" })
    await pinCanonicalSession("open-resume", { projectPath: "/proj-b", sessionId: "ses_keep" })
    const bot = await getBot("open-resume")
    const { deps, sessions } = fakeDeps({ existing: { "ses_keep": "/proj-b" } })

    const opened = await openCanonicalChat(bot, { projectPath: "/elsewhere" }, deps)
    expect(opened).toEqual({ projectPath: "/proj-b", sessionId: "ses_keep", created: false })
    expect(sessions.size).toBe(1) // no new session created
  })

  test("re-points when the pinned session is unusable, keeping the pinned project", async () => {
    await createBot({ name: "open-repoint", title: "Open Repoint" })
    await pinCanonicalSession("open-repoint", { projectPath: "/proj-c", sessionId: "ses_old" })
    const bot = await getBot("open-repoint")
    const { deps, sessions } = fakeDeps()

    const opened = await openCanonicalChat(bot, {}, deps)
    expect(opened.created).toBe(true)
    expect(opened.projectPath).toBe("/proj-c") // re-pointed in place, not cwd
    expect(opened.sessionId).not.toBe("ses_old")
    expect(readBotJson("open-repoint").canonicalSession.sessionId).toBe(opened.sessionId)
    expect(sessions.get(opened.sessionId)).toBe("/proj-c")
  })
})

describe("isCanonicalBotSession", () => {
  test("true only for a pinned canonical session id", async () => {
    await createBot({ name: "canon-a", title: "A" })
    await createBot({ name: "canon-b", title: "B" })
    await pinCanonicalSession("canon-a", { projectPath: "/p", sessionId: "ses_canon" })

    expect(await isCanonicalBotSession("ses_canon")).toBe(true)
    expect(await isCanonicalBotSession("ses_other")).toBe(false)
    expect(await isCanonicalBotSession("")).toBe(false)
  })
})

describe("capability epoch (D5)", () => {
  test("fnv1a is stable and sensitive to input", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"))
    expect(fnv1a("hello")).not.toBe(fnv1a("world"))
    expect(fnv1a("")).toMatch(/^[0-9a-f]{8}$/)
  })

  test("computeCapabilityEpoch covers identity, SOUL, memory list, and roster", () => {
    const base = {
      name: "b",
      title: "T",
      description: "d",
      model: "p/m",
      soul: "soul content",
      memoryFiles: ["a.md", "b.md"],
      rosterNames: ["x", "y"],
    }
    const epoch = computeCapabilityEpoch(base)
    // order-insensitive roster + memory list
    expect(computeCapabilityEpoch({ ...base, rosterNames: ["y", "x"] })).toBe(epoch)
    expect(computeCapabilityEpoch({ ...base, memoryFiles: ["b.md", "a.md"] })).toBe(epoch)
    // every drift class bumps the epoch
    expect(computeCapabilityEpoch({ ...base, title: "T2" })).not.toBe(epoch)
    expect(computeCapabilityEpoch({ ...base, model: null })).not.toBe(epoch)
    expect(computeCapabilityEpoch({ ...base, soul: "changed" })).not.toBe(epoch)
    expect(computeCapabilityEpoch({ ...base, memoryFiles: ["a.md"] })).not.toBe(epoch)
    expect(computeCapabilityEpoch({ ...base, rosterNames: ["x", "y", "z"] })).not.toBe(epoch)
  })

  test("ensureCapabilityEpoch stamps on first call and on drift, never when stable", async () => {
    const bot = await createBot({ name: "epoch-bot", title: "Epoch Bot", soul: "# SOUL\nv1\n" })
    const first = await ensureCapabilityEpoch(await getBot("epoch-bot"))
    expect(first).toMatch(/^[0-9a-f]{8}$/)
    expect(readBotJson("epoch-bot").capabilityEpoch).toBe(first)

    // stable config → no rewrite (updatedAt untouched)
    await sleep(10)
    const before = readBotJson("epoch-bot").updatedAt
    const second = await ensureCapabilityEpoch(await getBot("epoch-bot"))
    expect(second).toBe(first)
    expect(readBotJson("epoch-bot").updatedAt).toBe(before)

    // SOUL drift → re-stamp with a different epoch
    await writeFile(join(botDir("epoch-bot"), "SOUL.md"), "# SOUL\nv2\n")
    await sleep(10)
    const third = await ensureCapabilityEpoch(await getBot("epoch-bot"))
    expect(third).not.toBe(first)
    expect(readBotJson("epoch-bot").capabilityEpoch).toBe(third)

    // roster drift (a teammate appears) → re-stamp
    await createBot({ name: "epoch-teammate", title: "Teammate" })
    await sleep(10)
    const fourth = await ensureCapabilityEpoch(await getBot("epoch-bot"))
    expect(fourth).not.toBe(third)
  })

  test("setCapabilityEpoch updates the stored epoch", async () => {
    await createBot({ name: "stamp", title: "Stamp" })
    const updated = await setCapabilityEpoch("stamp", "deadbeef")
    expect(updated.capabilityEpoch).toBe("deadbeef")
    expect(readBotJson("stamp").capabilityEpoch).toBe("deadbeef")
  })
})

describe("persona injection", () => {
  test("identity line, SOUL, memory notes (newest first), and teammates", async () => {
    await createBot({
      name: "persona",
      title: "Persona Bot",
      description: "does things",
      soul: "# SOUL\nBe helpful.\n",
    })
    await createBot({ name: "persona-pal", title: "Pal" })
    const memoryDir = join(botDir("persona"), "memory")
    const old = join(memoryDir, "older.md")
    const fresh = join(memoryDir, "fresher.md")
    await writeFile(old, "old note\n")
    await writeFile(fresh, "fresh note\n")
    // make mtime order deterministic regardless of fs timestamp granularity
    const t = (await stat(old)).mtime
    await utimes(old, t, new Date(t.getTime() - 60_000))
    await utimes(fresh, t, new Date(t.getTime()))

    const bot = await getBot("persona")
    const injection = await buildPersonaInjection(bot)

    expect(injection).toContain("You are Persona Bot (persona), a bot on this machine.")
    expect(injection).toContain("Never claim to be a different assistant.")
    expect(injection).toContain("does things")
    expect(injection).toContain("Be helpful.")
    // newest note first
    expect(injection.indexOf("fresher.md")).toBeLessThan(injection.indexOf("older.md"))
    expect(injection).toContain("fresh note")
    // teammate roster (names + titles), self excluded
    expect(injection).toContain("persona-pal — Pal")
    expect(injection).not.toContain("- persona — Persona Bot")
  })

  test("memory injection is bounded by MEMORY_CHAR_BUDGET", async () => {
    await createBot({ name: "budget", title: "Budget", soul: "# SOUL\nx\n" })
    const memoryDir = join(botDir("budget"), "memory")
    const bigNew = "n".repeat(MEMORY_CHAR_BUDGET)
    const bigOld = "o".repeat(MEMORY_CHAR_BUDGET)
    await writeFile(join(memoryDir, "big-new.md"), bigNew)
    await writeFile(join(memoryDir, "big-old.md"), bigOld)
    const t = new Date()
    await utimes(join(memoryDir, "big-old.md"), t, new Date(t.getTime() - 60_000))

    const injection = await buildPersonaInjection(await getBot("budget"))
    expect(injection).toContain("big-new.md")
    expect(injection).not.toContain("big-old.md") // oldest note fell off the budget
    expect(injection).toContain("memory truncated")
  })

  test("botChatSystemPrompt injects for canonical sessions only, and stamps the epoch", async () => {
    await createBot({ name: "hook", title: "Hook", soul: "# SOUL\nhooked\n" })
    expect(await botChatSystemPrompt("ses_not_a_bot")).toBeUndefined()

    await pinCanonicalSession("hook", { projectPath: "/p", sessionId: "ses_hook" })
    const injection = await botChatSystemPrompt("ses_hook")
    expect(injection).toContain("You are Hook (hook), a bot on this machine.")
    expect(injection).toContain("hooked")
    expect(readBotJson("hook").capabilityEpoch).toMatch(/^[0-9a-f]{8}$/)
  })
})
