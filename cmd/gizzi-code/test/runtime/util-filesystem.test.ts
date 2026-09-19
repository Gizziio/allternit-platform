import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Filesystem, getFileInfo, isDirectory, isFile, copy } from "../../src/runtime/util/filesystem"

// Regression: the Filesystem namespace's exported stat shadowed the
// fs/promises import, making stat()/isDir()/isFile()/copy() infinitely
// self-recursive (b0142 escalation). These calls must hit the real fs.

describe("runtime/util/filesystem namespace", () => {
  test("stat returns file metadata", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "a.txt")
    await fs.writeFile(file, "hello")

    const s = await Filesystem.stat(file)
    expect(s.size).toBe(5)
    expect(s.isFile).toBe(true)
    expect(s.isDirectory).toBe(false)
    expect(s.mtime).toBeInstanceOf(Date)
  })

  test("isDir/isFile classify real paths", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "b.txt")
    await fs.writeFile(file, "x")
    const sub = path.join(tmp.path, "sub")
    await fs.mkdir(sub)

    expect(await Filesystem.isDir(tmp.path)).toBe(true)
    expect(await Filesystem.isDir(file)).toBe(false)
    expect(await Filesystem.isDir(path.join(tmp.path, "nope"))).toBe(false)
    expect(await Filesystem.isFile(file)).toBe(true)
    expect(await Filesystem.isFile(sub)).toBe(false)
  })

  test("copy copies a file tree recursively", async () => {
    await using tmp = await tmpdir()
    const src = path.join(tmp.path, "src")
    const nested = path.join(src, "nested")
    await fs.mkdir(nested, { recursive: true })
    await fs.writeFile(path.join(nested, "c.txt"), "content")

    const dest = path.join(tmp.path, "dest")
    await Filesystem.copy(src, dest)

    expect(await fs.readFile(path.join(dest, "nested", "c.txt"), "utf-8")).toBe("content")
  })

  test("top-level helpers use the real fs stat too", async () => {
    await using tmp = await tmpdir()
    const file = path.join(tmp.path, "d.txt")
    await fs.writeFile(file, "hello world")

    const info = await getFileInfo(file)
    expect(info.size).toBe(11)
    expect(info.isFile).toBe(true)
    expect(await isDirectory(tmp.path)).toBe(true)
    expect(await isFile(file)).toBe(true)

    const dest = path.join(tmp.path, "e.txt")
    await copy(file, dest)
    expect(await fs.readFile(dest, "utf-8")).toBe("hello world")
  })

  test("globUp walks up the directory tree", async () => {
    await using tmp = await tmpdir()
    const nested = path.join(tmp.path, "x", "y")
    await fs.mkdir(nested, { recursive: true })
    await fs.writeFile(path.join(tmp.path, "marker.txt"), "")

    const matches = await Filesystem.globUp(nested, "marker.txt")
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]).toEndWith("marker.txt")
  })
})
