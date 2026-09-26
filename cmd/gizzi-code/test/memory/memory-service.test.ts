import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { MemoryService } from "../../src/runtime/memory/memory-service"
import { Instance } from "../../src/runtime/context/project/instance"
import { Global } from "../../src/runtime/context/global"
import { getAutoMemPathFor } from "../../src/memdir/paths"
import { tmpdir } from "../fixture/fixture"

const FRONTMATTER = (name: string, description: string, type: string, body: string) =>
  ["---", `name: ${name}`, `description: ${description}`, `type: ${type}`, "---", "", body].join("\n")

function projectHash(directory: string): string {
  return directory.replace(/^\//, "").replace(/\//g, "-")
}

describe("MemoryService memdir convergence", () => {
  let originalConfigDir: string | undefined
  let originalClaudeConfigDir: string | undefined
  let originalCoworkOverride: string | undefined
  const disposables: { [Symbol.asyncDispose](): Promise<void> }[] = []

  beforeEach(() => {
    originalConfigDir = process.env["GIZZI_CONFIG_DIR"]
    originalClaudeConfigDir = process.env["CLAUDE_CONFIG_DIR"]
    originalCoworkOverride = process.env["GIZZI_COWORK_MEMORY_PATH_OVERRIDE"]
    delete process.env["GIZZI_COWORK_MEMORY_PATH_OVERRIDE"]
  })

  afterEach(async () => {
    if (originalConfigDir === undefined) delete process.env["GIZZI_CONFIG_DIR"]
    else process.env["GIZZI_CONFIG_DIR"] = originalConfigDir
    if (originalClaudeConfigDir === undefined) delete process.env["CLAUDE_CONFIG_DIR"]
    else process.env["CLAUDE_CONFIG_DIR"] = originalClaudeConfigDir
    if (originalCoworkOverride === undefined) delete process.env["GIZZI_COWORK_MEMORY_PATH_OVERRIDE"]
    else process.env["GIZZI_COWORK_MEMORY_PATH_OVERRIDE"] = originalCoworkOverride
    while (disposables.length > 0) await disposables.pop()![Symbol.asyncDispose]()
  })

  /** Isolated config home with a projects/ dir so getMemoryBaseDir() picks it */
  async function useIsolatedConfigHome() {
    const configHome = await tmpdir({
      init: async (dir) => {
        await fs.mkdir(path.join(dir, "projects"), { recursive: true })
      },
    })
    disposables.push(configHome)
    process.env["GIZZI_CONFIG_DIR"] = configHome.path
    const claudeHome = await tmpdir()
    disposables.push(claudeHome)
    process.env["CLAUDE_CONFIG_DIR"] = claudeHome.path
    return { configHome, claudeHome }
  }

  test("save writes to the memdir auto-memory directory (not the old global store)", async () => {
    await using project = await tmpdir()
    const { configHome } = await useIsolatedConfigHome()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const entry = await MemoryService.save(
          { name: "user_role", description: "The user's role", type: "user" },
          "Staff engineer, prefers terse answers.",
        )

        const memdir = getAutoMemPathFor(project.path)
        expect(entry.filepath).toBe(path.join(memdir, "user_role.md"))
        expect(entry.filepath.startsWith(path.join(configHome.path, "projects") + path.sep)).toBe(true)
        // Never the pre-convergence global store
        expect(entry.filepath.startsWith(Global.Path.config)).toBe(false)

        const onDisk = await fs.readFile(entry.filepath, "utf8")
        expect(onDisk).toContain("name: user_role")

        const index = await fs.readFile(path.join(memdir, "MEMORY.md"), "utf8")
        expect(index).toContain("[user_role](user_role.md)")

        const recalled = await MemoryService.get("user_role.md")
        expect(recalled?.body).toContain("Staff engineer")
      },
    })
  })

  test("list sees both memdir and legacy L1-COGNITIVE memories; memdir wins dedupe", async () => {
    await using project = await tmpdir({
      init: async (dir) => {
        const l1 = path.join(dir, ".gizzi", "L1-COGNITIVE", "memory")
        await fs.mkdir(l1, { recursive: true })
        await Bun.write(path.join(l1, "legacy_note.md"), FRONTMATTER("legacy_note", "Legacy fact", "project", "from L1"))
        await Bun.write(path.join(l1, "dup.md"), FRONTMATTER("dup", "legacy version", "project", "stale"))
      },
    })
    await useIsolatedConfigHome()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await MemoryService.save({ name: "dup", description: "memdir version", type: "project" }, "fresh")

        const all = await MemoryService.list()
        const names = all.map((e) => e.filename).sort()
        expect(names).toContain("legacy_note.md")
        expect(names.filter((n) => n === "dup.md")).toHaveLength(1)
        expect(all.find((e) => e.filename === "dup.md")?.description).toBe("memdir version")

        const hits = await MemoryService.search("legacy fact")
        expect(hits.map((e) => e.filename)).toContain("legacy_note.md")
      },
    })
  })

  test("one-time import copies legacy stores into memdir without deleting sources", async () => {
    await using project = await tmpdir({
      init: async (dir) => {
        const l1 = path.join(dir, ".gizzi", "L1-COGNITIVE", "memory")
        await fs.mkdir(l1, { recursive: true })
        await Bun.write(path.join(l1, "old_fact.md"), FRONTMATTER("old_fact", "Old L1 fact", "project", "kept"))
        await Bun.write(path.join(l1, "MEMORY.md"), "# GIZZI Memory Index\n\nsession log stuff\n")
      },
    })
    await useIsolatedConfigHome()

    // Pre-convergence global store (old memory_write target), redirected to a tmp
    await using oldGlobalConfig = await tmpdir()
    const oldGlobalMemory = path.join(oldGlobalConfig.path, "projects", projectHash(project.path), "memory")
    await fs.mkdir(oldGlobalMemory, { recursive: true })
    await Bun.write(path.join(oldGlobalMemory, "old_global.md"), FRONTMATTER("old_global", "Old global fact", "user", "kept too"))
    await Bun.write(path.join(oldGlobalMemory, "MEMORY.md"), "# Memory Index\n\n- [old_global](old_global.md) — Old global fact (user)\n")

    const originalGlobalConfig = Global.Path.config
    ;(Global.Path as { config: string }).config = oldGlobalConfig.path
    try {
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          await MemoryService.list() // triggers the import

          const memdir = getAutoMemPathFor(project.path)
          // Copies landed in the memdir
          expect(await fs.readFile(path.join(memdir, "old_fact.md"), "utf8")).toContain("name: old_fact")
          expect(await fs.readFile(path.join(memdir, "old_global.md"), "utf8")).toContain("name: old_global")
          // Same-format index entries from the old global store were merged
          const index = await fs.readFile(path.join(memdir, "MEMORY.md"), "utf8")
          expect(index).toContain("[old_global](old_global.md)")
          // L1 MEMORY.md content was NOT folded into the memdir index
          expect(index).not.toContain("session log stuff")

          // Sources untouched
          expect(
            await fs.readFile(path.join(project.path, ".gizzi", "L1-COGNITIVE", "memory", "old_fact.md"), "utf8"),
          ).toContain("name: old_fact")
          expect(await fs.readFile(path.join(oldGlobalMemory, "old_global.md"), "utf8")).toContain("name: old_global")

          // Marker written → subsequent runs are no-ops
          const marker = JSON.parse(await fs.readFile(path.join(memdir, ".memdir-import-v1.json"), "utf8"))
          expect(marker.importedAt).toBeTruthy()
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = originalGlobalConfig
    }
  })

  test("upsert preserves pre-existing TUI-style MEMORY.md lines", async () => {
    await using project = await tmpdir()
    await useIsolatedConfigHome()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const memdir = getAutoMemPathFor(project.path)
        await fs.mkdir(memdir, { recursive: true })
        // TUI extract-memories style line: no (type) suffix
        await Bun.write(path.join(memdir, "MEMORY.md"), "# Memory Index\n\n- [Some Note](tui_note.md) — one-line hook\n")

        await MemoryService.save({ name: "new_fact", description: "New fact", type: "project" }, "body")

        const index = await fs.readFile(path.join(memdir, "MEMORY.md"), "utf8")
        expect(index).toContain("- [Some Note](tui_note.md) — one-line hook")
        expect(index).toContain("- [new_fact](new_fact.md) — New fact (project)")
      },
    })
  })
})
