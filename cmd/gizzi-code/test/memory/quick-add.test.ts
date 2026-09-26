// @ts-nocheck
import { describe, expect, test } from "bun:test"
import path from "path"
import {
  appendToMemoryFile,
  buildMemoryQuickAddContent,
  extractMemoryQuickAddText,
} from "../../src/cli/ui/ink-app/utils/memory/quickAdd"
import { tmpdir } from "../fixture/fixture"

describe("extractMemoryQuickAddText", () => {
  test("strips the leading # and surrounding whitespace", () => {
    expect(extractMemoryQuickAddText("#test memory line")).toBe("test memory line")
    expect(extractMemoryQuickAddText("#  spaced  ")).toBe("spaced")
    expect(extractMemoryQuickAddText("#nospace")).toBe("nospace")
  })

  test("bare # yields empty text (routes to /memory flow)", () => {
    expect(extractMemoryQuickAddText("#")).toBe("")
    expect(extractMemoryQuickAddText("#   ")).toBe("")
  })
})

describe("buildMemoryQuickAddContent", () => {
  test("creates a fresh file with just the bullet", () => {
    expect(buildMemoryQuickAddContent("", "my note")).toBe("- my note\n")
    expect(buildMemoryQuickAddContent("   \n", "my note")).toBe("- my note\n")
  })

  test("appends the bullet after existing content", () => {
    expect(buildMemoryQuickAddContent("# Title\n", "my note")).toBe("# Title\n- my note\n")
    expect(buildMemoryQuickAddContent("# Title\n\n- old\n\n\n", "my note")).toBe(
      "# Title\n\n- old\n- my note\n",
    )
  })
})

describe("appendToMemoryFile", () => {
  test("creates parent dirs and file, then appends on second call", async () => {
    await using tmp = await tmpdir()
    const target = path.join(tmp.path, "nested", "dir", "GIZZI.md")

    await appendToMemoryFile(target, "first note")
    expect(await Bun.file(target).text()).toBe("- first note\n")

    await appendToMemoryFile(target, "second note")
    expect(await Bun.file(target).text()).toBe("- first note\n- second note\n")
  })

  test("preserves existing file bytes", async () => {
    await using tmp = await tmpdir({
      init: async dir => {
        await Bun.write(path.join(dir, "GIZZI.md"), "# Existing\n\nkeep me\n")
      },
    })
    const target = path.join(tmp.path, "GIZZI.md")
    await appendToMemoryFile(target, "new note")
    expect(await Bun.file(target).text()).toBe("# Existing\n\nkeep me\n- new note\n")
  })
})
