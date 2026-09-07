// @ts-nocheck
import { describe, expect, test } from "bun:test"
import path from "path"
import {
  parseFrontmatter,
  stringifyFrontmatter,
  extractWikilinks,
  extractTags,
  sanitizeFilename,
  readNote,
  writeNote,
  listNotes,
  ensureVaultStructure,
} from "../src/vault/io"
import { Vault } from "../src/vault/types"
import { tmpdir } from "./fixture/fixture"

describe("parseFrontmatter", () => {
  test("content without frontmatter returns empty frontmatter and full body", () => {
    const content = "# Just a heading\n\nSome body text."
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({})
    expect(body).toBe(content)
  })

  test("unterminated frontmatter block returns empty frontmatter", () => {
    const content = "---\ntitle: Broken\n# no closing marker\nBody here"
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({})
    expect(body).toBe(content)
  })

  test("parses scalars: strings, quoted strings, numbers, booleans", () => {
    const content = [
      "---",
      "title: My Note",
      'quoted: "hello world"',
      "count: 42",
      "ratio: 3.14",
      "negative: -7",
      "active: true",
      "archived: false",
      "---",
      "Body line.",
    ].join("\n")
    const { frontmatter, body } = parseFrontmatter(content)
    expect(frontmatter).toEqual({
      title: "My Note",
      quoted: "hello world",
      count: 42,
      ratio: 3.14,
      negative: -7,
      active: true,
      archived: false,
    })
    expect(body).toBe("Body line.")
  })

  test("parses array values", () => {
    const content = ["---", "tags:", "  - alpha", "  - beta", "---", "body"].join("\n")
    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter.tags).toEqual(["alpha", "beta"])
  })

  test("a key with empty value followed by another key flushes an empty array", () => {
    const content = ["---", "description:", "title: Next", "---", "body"].join("\n")
    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter.description).toEqual([])
    expect(frontmatter.title).toBe("Next")
  })

  test("comment and blank lines inside frontmatter are skipped", () => {
    const content = ["---", "# a comment", "title: Kept", "", "---", "body"].join("\n")
    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter).toEqual({ title: "Kept" })
  })

  test("frontmatter value line containing a colon keeps the rest", () => {
    const content = ["---", "url: https://example.com/a:b", "---", "body"].join("\n")
    const { frontmatter } = parseFrontmatter(content)
    expect(frontmatter.url).toBe("https://example.com/a:b")
  })
})

describe("stringifyFrontmatter", () => {
  test("round-trips through parseFrontmatter", () => {
    const original = {
      title: "Round Trip",
      count: 3,
      active: true,
      tags: ["x", "y"],
      skipped: undefined,
    }
    const { frontmatter, body } = parseFrontmatter(stringifyFrontmatter(original) + "\n\nBody")
    expect(frontmatter).toEqual({
      title: "Round Trip",
      count: 3,
      active: true,
      tags: ["x", "y"],
    })
    expect(body).toBe("Body")
  })

  test("emits YAML array syntax for arrays", () => {
    const out = stringifyFrontmatter({ tags: ["a", "b"] })
    expect(out).toContain("tags:\n  - a\n  - b")
    expect(out.startsWith("---")).toBe(true)
    expect(out.endsWith("---")).toBe(true)
  })

  test("null and undefined values are omitted", () => {
    const out = stringifyFrontmatter({ a: null, b: undefined, c: "kept" })
    expect(out).not.toContain("a:")
    expect(out).not.toContain("b:")
    expect(out).toContain("c: kept")
  })
})

describe("extractWikilinks", () => {
  test("extracts targets and dedupes, ignoring aliases", () => {
    const content = "See [[Note One]] and [[Note One|An Alias]] plus [[Two]] and [[Note One]] again."
    expect(extractWikilinks(content)).toEqual(["Note One", "Two"])
  })

  test("returns empty array when no links", () => {
    expect(extractWikilinks("plain text, no links")).toEqual([])
  })

  test("regex state is reset between calls (global flag safety)", () => {
    extractWikilinks("[[A]]")
    expect(extractWikilinks("[[B]]")).toEqual(["B"])
  })
})

describe("extractTags", () => {
  test("extracts #tags including nested paths and dedupes", () => {
    const content = "#alpha some text #beta/sub and #alpha again"
    expect(extractTags(content)).toEqual(["alpha", "beta/sub"])
  })

  test("requires the tag to start immediately after the hash (no space)", () => {
    // A spaced markdown heading "# Heading" is not treated as a tag,
    // while "#Heading" and mid-word "#2fast" are.
    expect(extractTags("# Heading\nno tags here #2fast")).toEqual(["2fast"])
    expect(extractTags("#Heading")).toEqual(["Heading"])
  })
})

describe("sanitizeFilename", () => {
  test("replaces forbidden characters with underscores", () => {
    const dirty = 'a<b>c:d"e/f\\g|h?i*j'
    expect(sanitizeFilename(dirty)).toBe("a_b_c_d_e_f_g_h_i_j")
  })

  test("strips control characters", () => {
    expect(sanitizeFilename("a\x00b\x1fc")).toBe("a_b_c")
  })

  test("truncates to 200 characters", () => {
    const long = "x".repeat(300)
    expect(sanitizeFilename(long)).toHaveLength(200)
  })

  test("keeps ordinary names unchanged", () => {
    expect(sanitizeFilename("My Note (2026) [draft]")).toBe("My Note (2026) [draft]")
  })
})

describe("writeNote / readNote / listNotes (tmpdir)", () => {
  test("write then read round-trips content, folder, title and links", async () => {
    await using tmp = await tmpdir()
    const abs = path.join(tmp.path, "People", "Jane Doe.md")
    await writeNote(abs, {
      frontmatter: { title: "Jane Doe", tags: ["person"] },
      content: "Met [[Project X]] today. #networking",
    })
    const note = await readNote(abs, tmp.path)
    expect(note).not.toBeNull()
    expect(note.title).toBe("Jane Doe")
    expect(note.folder).toBe("People")
    expect(note.relPath).toBe(path.join("People", "Jane Doe.md"))
    // readNote trims leading whitespace only; the trailing newline from
    // writeNote is preserved.
    expect(note.content).toBe("Met [[Project X]] today. #networking\n")
    expect(note.outgoingLinks).toEqual(["Project X"])
    expect(note.frontmatter.tags).toEqual(["person", "networking"])
  })

  test("falls back to filename as title when frontmatter has none", async () => {
    await using tmp = await tmpdir()
    const abs = path.join(tmp.path, "daily.md")
    await writeNote(abs, { frontmatter: {}, content: "plain" })
    const note = await readNote(abs, tmp.path)
    expect(note.title).toBe("daily")
  })

  test("root-level notes get an empty folder", async () => {
    await using tmp = await tmpdir()
    const abs = path.join(tmp.path, "root.md")
    await writeNote(abs, { frontmatter: {}, content: "x" })
    const note = await readNote(abs, tmp.path)
    expect(note.folder).toBe("")
  })

  test("readNote returns null for missing files", async () => {
    await using tmp = await tmpdir()
    expect(await readNote(path.join(tmp.path, "nope.md"), tmp.path)).toBeNull()
  })

  test("listNotes finds all markdown notes under the vault root", async () => {
    await using tmp = await tmpdir()
    await writeNote(path.join(tmp.path, "a.md"), { frontmatter: {}, content: "a" })
    await writeNote(path.join(tmp.path, "sub", "b.md"), { frontmatter: {}, content: "b" })
    const notes = await listNotes(tmp.path)
    expect(notes.map((n) => path.basename(n.path)).sort()).toEqual(["a.md", "b.md"])
  })
})

describe("ensureVaultStructure", () => {
  test("creates the standard vault directories in a tmpdir", async () => {
    await using tmp = await tmpdir()
    await ensureVaultStructure(tmp.path)
    const fs = await import("fs/promises")
    for (const dir of ["Daily", "People", "Projects", "Meetings", "Topics", "Attachments"]) {
      const stat = await fs.stat(path.join(tmp.path, dir))
      expect(stat.isDirectory()).toBe(true)
    }
  })
})

describe("Vault.inferEntityType", () => {
  const note = (folder: string, frontmatter: Record<string, unknown> = {}) => ({
    folder,
    frontmatter,
  })

  test("prefers a valid frontmatter type", () => {
    expect(Vault.inferEntityType(note("People", { type: "person" }))).toBe("person")
    expect(Vault.inferEntityType(note("", { type: "runbook" }))).toBe("runbook")
  })

  test("falls back to the first folder segment when it is a valid type", () => {
    expect(Vault.inferEntityType(note("topic/some-topic"))).toBe("topic")
    expect(Vault.inferEntityType(note("module"))).toBe("module")
  })

  test("falls back to reference when neither yields a valid type", () => {
    expect(Vault.inferEntityType(note("People"))).toBe("reference") // plural folder, not an enum value
    expect(Vault.inferEntityType(note("random-folder"))).toBe("reference")
    expect(Vault.inferEntityType(note(""))).toBe("reference")
  })

  test("invalid frontmatter type falls through to folder inference", () => {
    expect(Vault.inferEntityType(note("idea", { type: "bogus" }))).toBe("idea")
    expect(Vault.inferEntityType(note("misc", { type: "bogus" }))).toBe("reference")
  })
})
