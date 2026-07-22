import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Scratchpad, type ScratchpadOptions } from "@/runtime/session/scratchpad"

const roots: string[] = []
afterEach(async () => Promise.all(roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true }))))

async function fixture() {
  const baseDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "gizzi-scratchpad-"))
  roots.push(baseDirectory)
  const options: ScratchpadOptions = { baseDirectory, rootSessionID: "root-session", trace: false }
  return options
}

describe("canonical session scratchpad", () => {
  test("isolates private files while sharing explicit root-session files", async () => {
    const options = await fixture()
    await Scratchpad.write({ sessionID: "agent-a", path: "notes/a.md", content: "private-a", options })
    await Scratchpad.write({ sessionID: "agent-b", path: "notes/b.md", content: "private-b", options })
    await Scratchpad.write({ sessionID: "agent-a", path: "handoff.md", content: "shared", shared: true, options })

    await expect(Scratchpad.read({ sessionID: "agent-b", path: "notes/a.md", options })).rejects.toThrow()
    expect((await Scratchpad.read({ sessionID: "agent-b", path: "notes/b.md", options })).content).toBe("private-b")
    expect((await Scratchpad.read({ sessionID: "agent-b", path: "handoff.md", shared: true, options })).content).toBe("shared")
  })

  test("rejects traversal, absolute paths, symlinks, and oversized writes", async () => {
    const options = await fixture()
    await expect(Scratchpad.write({ sessionID: "agent-a", path: "../escape", content: "no", options })).rejects.toThrow()
    await expect(Scratchpad.write({ sessionID: "agent-a", path: "/tmp/escape", content: "no", options })).rejects.toThrow()
    await expect(Scratchpad.write({ sessionID: "agent-a", path: "large", content: "x".repeat(1_000_001), options })).rejects.toThrow()

    const scope = await Scratchpad.scope("agent-a", options)
    const outside = path.join(options.baseDirectory!, "outside")
    await fs.mkdir(outside)
    await fs.symlink(outside, path.join(scope.privateDirectory, "link"))
    await expect(Scratchpad.write({ sessionID: "agent-a", path: "link/escape", content: "no", options })).rejects.toThrow()
    await expect(fs.stat(path.join(outside, "escape"))).rejects.toThrow()
  })

  test("lists metadata without content and supports file and root cleanup", async () => {
    const options = await fixture()
    await Scratchpad.write({ sessionID: "agent-a", path: "secret-note.md", content: "not in metadata", options })
    const listed = await Scratchpad.list("agent-a", options)
    expect(listed.entries[0]).toMatchObject({ path: "secret-note.md", bytes: 15, shared: false })
    expect(JSON.stringify(listed)).not.toContain("not in metadata")
    expect(await Scratchpad.remove({ sessionID: "agent-a", path: "secret-note.md", options })).toBe(true)
    expect((await Scratchpad.list("agent-a", options)).entries).toEqual([])

    await Scratchpad.write({ sessionID: "agent-a", path: "shared.md", content: "shared", shared: true, options })
    await Scratchpad.cleanup("root-session", true, options)
    await expect(fs.stat(path.join(options.baseDirectory!, "root-session"))).rejects.toThrow()
  })
})
