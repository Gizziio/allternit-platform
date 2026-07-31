import { describe, expect, test } from "bun:test"
import path from "path"
import { getProjectDirsUpToHome } from "../../src/shared/utils/markdownConfigLoader"
import { tmpdir } from "../fixture/fixture"

describe("getProjectDirsUpToHome .gizzi/.claude compat", () => {
  test("finds .gizzi/<subdir> when only that exists", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, ".gizzi", "commands", "foo.md"), "# foo")
      },
    })
    const dirs = getProjectDirsUpToHome("commands", tmp.path)
    expect(dirs).toContain(path.join(tmp.path, ".gizzi", "commands"))
    expect(dirs).not.toContain(path.join(tmp.path, ".claude", "commands"))
  })

  test("falls back to .claude/<subdir> when only that exists", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, ".claude", "commands", "foo.md"), "# foo")
      },
    })
    const dirs = getProjectDirsUpToHome("commands", tmp.path)
    expect(dirs).toContain(path.join(tmp.path, ".claude", "commands"))
    expect(dirs).not.toContain(path.join(tmp.path, ".gizzi", "commands"))
  })

  test("includes both when both exist (additive, not precedence)", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, ".gizzi", "commands", "new.md"), "# new")
        await Bun.write(path.join(dir, ".claude", "commands", "legacy.md"), "# legacy")
      },
    })
    const dirs = getProjectDirsUpToHome("commands", tmp.path)
    expect(dirs).toContain(path.join(tmp.path, ".gizzi", "commands"))
    expect(dirs).toContain(path.join(tmp.path, ".claude", "commands"))
  })

  test("returns empty when neither exists", async () => {
    await using tmp = await tmpdir()
    const dirs = getProjectDirsUpToHome("commands", tmp.path)
    expect(dirs).toEqual([])
  })
})
