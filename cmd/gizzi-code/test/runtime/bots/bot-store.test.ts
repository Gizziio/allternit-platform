// @ts-nocheck
import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "../../fixture/fixture"
import {
  BotSchema,
  BotStoreError,
  botDir,
  botDirIsPrivate,
  botsDir,
  cloneBot,
  createBot,
  deleteBot,
  getBot,
  listBotMemory,
  listBots,
  readSoul,
  resolveBotDirName,
  updateBot,
  validateBotName,
} from "../../../src/runtime/bots/bot-store"

let tmp: { path: string }

beforeAll(async () => {
  tmp = await tmpdir()
  process.env.GIZZI_CONFIG_DIR = join(tmp.path, ".gizzi")
})

afterAll(() => {
  delete process.env.GIZZI_CONFIG_DIR
  rmSync(join(tmp.path, ".gizzi"), { recursive: true, force: true })
})

function readBotJson(name: string): any {
  return JSON.parse(readFileSync(join(botDir(name), "bot.json"), "utf8"))
}

function writeBotJson(name: string, data: any): void {
  writeFileSync(join(botDir(name), "bot.json"), JSON.stringify(data))
}

describe("createBot", () => {
  test("creates bot.json (schema-valid), SOUL.md, and memory/", async () => {
    const bot = await createBot({
      name: "research-buddy",
      title: "Research Buddy",
      description: "Researches things",
      model: "anthropic/claude-sonnet-4-5",
      soul: "# SOUL\nYou are a researcher.\n",
    })

    expect(bot.schemaVersion).toBe(1)
    expect(bot.name).toBe("research-buddy")
    expect(bot.title).toBe("Research Buddy")
    expect(bot.description).toBe("Researches things")
    expect(bot.model).toBe("anthropic/claude-sonnet-4-5")
    expect(bot.avatar).toBeNull()
    expect(bot.canonicalSession).toBeNull()
    expect(bot.capabilityEpoch).toBeNull()
    expect(bot.createdAt).toBe(bot.updatedAt)

    const dir = botDir("research-buddy")
    expect(existsSync(join(dir, "bot.json"))).toBe(true)
    expect(existsSync(join(dir, "SOUL.md"))).toBe(true)
    expect(existsSync(join(dir, "memory"))).toBe(true)

    expect(BotSchema.safeParse(readBotJson("research-buddy")).success).toBe(true)
    expect(await readSoul("research-buddy")).toBe("# SOUL\nYou are a researcher.\n")
    expect(await listBotMemory("research-buddy")).toEqual([])
  })

  test("honors GIZZI_CONFIG_DIR — bots live under the override, not ~/.gizzi", async () => {
    await createBot({ name: "ada", title: "Ada" })
    expect(botsDir()).toBe(join(tmp.path, ".gizzi", "bots"))
    expect(existsSync(join(tmp.path, ".gizzi", "bots", "ada", "bot.json"))).toBe(true)
  })

  test("writes a starter SOUL.md when no soul content is given", async () => {
    await createBot({ name: "plain", title: "Plain" })
    const soul = await readSoul("plain")
    expect(soul).toContain("# SOUL — plain")
    expect(soul).toContain("Standing instructions")
  })

  test("bot directories are private (no group/other permissions) and atomic writes leave no tmp files", async () => {
    await createBot({ name: "private", title: "Private" })
    expect(await botDirIsPrivate("private")).toBe(true)
    expect(readdirSync(botDir("private")).filter((f) => f.endsWith(".tmp"))).toEqual([])
  })

  test("refuses a duplicate name", async () => {
    await createBot({ name: "dup", title: "Dup" })
    await expect(createBot({ name: "dup", title: "Dup" })).rejects.toThrow(/already exists/)
  })
})

describe("name validation", () => {
  test("accepts lowercase slugs", () => {
    for (const name of ["ada", "a", "bot-2", "x-y-z-9"]) {
      expect(() => validateBotName(name)).not.toThrow()
    }
  })

  test("rejects uppercase, spaces, leading/trailing/consecutive dashes, symbols", () => {
    for (const name of ["Ada", "my bot", "-ada", "ada-", "a--b", "bot_2", "bot.2", ""]) {
      expect(() => validateBotName(name)).toThrow(BotStoreError)
    }
  })

  test("rejects reserved subcommand names", async () => {
    for (const name of ["list", "create", "chat", "routine", "help"]) {
      expect(() => validateBotName(name)).toThrow(/reserved/)
      await expect(createBot({ name, title: "x" })).rejects.toThrow(/reserved/)
    }
  })
})

describe("getBot / listBots", () => {
  test("listBots is sorted by name", async () => {
    await createBot({ name: "zed", title: "Z" })
    await createBot({ name: "abc", title: "A" })
    const names = (await listBots()).map((b) => b.name)
    expect(names).toEqual([...names].sort())
    expect(names.indexOf("abc")).toBeLessThan(names.indexOf("zed"))
  })

  test("lookup is case-insensitive and returns null when missing", async () => {
    const bot = await getBot("ADA")
    expect(bot?.name).toBe("ada")
    expect(await getBot("nope")).toBeNull()
  })

  test("exact directory match wins over a case-insensitive match", () => {
    expect(resolveBotDirName(["ada", "ADA"], "ADA")).toBe("ADA")
  })

  test("ambiguous case-insensitive matches error instead of guessing", () => {
    expect(() => resolveBotDirName(["ada", "Ada"], "aDa")).toThrow(/ambiguous/)
    expect(() => resolveBotDirName(["ada", "Ada"], "ADA")).toThrow(/ambiguous/)
  })

  test("ignores directories without a valid bot.json", async () => {
    await createBot({ name: "real", title: "Real" })
    mkdirSync(join(botsDir(), "not-a-bot"), { recursive: true })
    mkdirSync(join(botsDir(), "broken"), { recursive: true })
    writeFileSync(join(botsDir(), "broken", "bot.json"), "{ not json")
    const names = (await listBots()).map((b) => b.name)
    expect(names).toContain("real")
    expect(names).not.toContain("not-a-bot")
    expect(names).not.toContain("broken")
  })
})

describe("updateBot", () => {
  test("patches metadata, bumps updatedAt, never touches canonicalSession", async () => {
    const created = await createBot(
      { name: "up", title: "Up", model: "a/b" },
      { now: new Date("2026-01-01T00:00:00Z") },
    )
    // simulate a B2-era pinned session by rewriting bot.json directly
    writeBotJson("up", {
      ...readBotJson("up"),
      canonicalSession: { projectPath: "/p", sessionId: "s-1" },
    })

    const updated = await updateBot(
      "up",
      { title: "New Title", model: null },
      { now: new Date("2026-02-01T00:00:00Z") },
    )
    expect(updated.title).toBe("New Title")
    expect(updated.model).toBeNull()
    expect(updated.description).toBe("")
    expect(updated.updatedAt).toBe("2026-02-01T00:00:00.000Z")
    expect(updated.updatedAt > created.updatedAt).toBe(true)
    // canonical session survives an identity edit
    expect(updated.canonicalSession).toEqual({ projectPath: "/p", sessionId: "s-1" })

    expect(readdirSync(botDir("up")).filter((f) => f.endsWith(".tmp"))).toEqual([])
  })

  test("throws for a missing bot", async () => {
    await expect(updateBot("ghost", { title: "x" })).rejects.toThrow(/not found/)
  })
})

describe("cloneBot", () => {
  test("copies identity + SOUL.md + memory/, never canonicalSession", async () => {
    await createBot({
      name: "source",
      title: "Source Bot",
      description: "orig",
      model: "a/b",
      soul: "# SOUL\nsource persona\n",
    })
    writeFileSync(join(botDir("source"), "memory", "note.md"), "remember this\n")
    writeBotJson("source", {
      ...readBotJson("source"),
      canonicalSession: { projectPath: "/p", sessionId: "s-9" },
      capabilityEpoch: "epoch-1",
    })

    const clone = await cloneBot("source", "copy")
    expect(clone.name).toBe("copy")
    expect(clone.title).toBe("Source Bot")
    expect(clone.description).toBe("orig")
    expect(clone.model).toBe("a/b")
    expect(clone.canonicalSession).toBeNull()
    expect(clone.capabilityEpoch).toBeNull()
    expect(await readSoul("copy")).toBe("# SOUL\nsource persona\n")
    expect(await listBotMemory("copy")).toEqual(["note.md"])

    // isolation: editing the clone's memory does not touch the source
    writeFileSync(join(botDir("copy"), "memory", "note.md"), "changed\n")
    writeFileSync(join(botDir("copy"), "memory", "extra.md"), "new\n")
    expect(readFileSync(join(botDir("source"), "memory", "note.md"), "utf8")).toBe(
      "remember this\n",
    )
    expect(await listBotMemory("source")).toEqual(["note.md"])

    // source still pinned, clone not
    expect((await getBot("source"))?.canonicalSession?.sessionId).toBe("s-9")
    expect((await getBot("copy"))?.canonicalSession).toBeNull()
  })

  test("throws when the source does not exist", async () => {
    await expect(cloneBot("ghost", "copy")).rejects.toThrow(/not found/)
  })
})

describe("deleteBot", () => {
  test("removes the whole bot directory and returns the deleted identity", async () => {
    await createBot({ name: "bye", title: "Bye", soul: "# SOUL\nbye\n" })
    const removed = await deleteBot("bye")
    expect(removed.name).toBe("bye")
    expect(existsSync(botDir("bye"))).toBe(false)
    expect((await listBots()).map((b) => b.name)).not.toContain("bye")
  })

  test("throws for a missing bot", async () => {
    await expect(deleteBot("ghost")).rejects.toThrow(/not found/)
  })
})
