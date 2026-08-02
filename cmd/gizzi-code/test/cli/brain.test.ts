// @ts-nocheck
import { test, expect } from "bun:test"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { tmpdir } from "../fixture/fixture"
import {
  DEFAULT_BRAIN_PATH,
  brainTemplates,
  getBrainStatus,
  initBrain,
  setBrainRemote,
  syncBrain,
} from "../../src/cli/commands/brain/lib"
import { SettingsSchema as SharedSettingsSchema } from "../../src/shared/utils/settings/types"
import { SettingsSchema as InkSettingsSchema } from "../../src/cli/ui/ink-app/utils/settings/types"

function git(dir: string, ...args: string[]): string {
  const proc = Bun.spawnSync(["git", "-C", dir, ...args])
  return proc.stdout.toString().trim()
}

const CORPUS_PAGES: Array<[string, string]> = [
  ["identity.md", "identity"],
  ["domains/_template.md", "domain"],
  ["decisions/_template.md", "decision"],
  ["runbooks/_template.md", "runbook"],
  ["ideas/_template.md", "idea"],
]

test("init creates the canonical layout with valid frontmatter and one commit", async () => {
  await using tmp = await tmpdir()
  const brainPath = join(tmp.path, "brain")

  const result = await initBrain(brainPath)
  expect(result.path).toBe(brainPath)

  // Canonical layout (spec v1)
  for (const f of [
    "brain.yaml",
    "identity.md",
    "MEMORY.md",
    "domains/_template.md",
    "decisions/_template.md",
    "runbooks/_template.md",
    "ideas/_template.md",
  ]) {
    expect(existsSync(join(brainPath, f))).toBe(true)
  }

  // Valid frontmatter (type/status/domain per the C2 convention) in every
  // template page that carries frontmatter
  for (const [file, expectedType] of CORPUS_PAGES) {
    const { data } = matter(readFileSync(join(brainPath, file), "utf8"))
    expect(data.type).toBe(expectedType)
    expect(typeof data.status).toBe("string")
    expect(typeof data.domain).toBe("string")
  }
  // decisions carry a date per the spec (js-yaml parses YAML timestamps into
  // Date objects — accept either form, but it must be a real date)
  const decision = matter(
    readFileSync(join(brainPath, "decisions/_template.md"), "utf8"),
  ).data
  const dateOk =
    decision.date instanceof Date ||
    (typeof decision.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(decision.date))
  expect(dateOk).toBe(true)

  // brain.yaml parses and carries the required metadata
  const brainYaml = matter(
    `---\n${readFileSync(join(brainPath, "brain.yaml"), "utf8")}---\n`,
  ).data
  expect(brainYaml.schema_version).toBe(1)
  expect(brainYaml).toHaveProperty("created")
  expect(brainYaml).toHaveProperty("remote")

  // Exactly one initial commit, and the brain reports clean status
  expect(git(brainPath, "rev-list", "--count", "HEAD")).toBe("1")
  const status = await getBrainStatus(brainPath)
  expect(status.exists).toBe(true)
  expect(status.isRepo).toBe(true)
  expect(status.remote).toBeNull()
  expect(status.uncommitted).toEqual([])
  expect(status.unpushed).toBeNull()
  expect(status.clean).toBe(true)
})

test("init works in an existing but empty directory", async () => {
  await using tmp = await tmpdir()
  const result = await initBrain(tmp.path)
  expect(existsSync(join(tmp.path, "brain.yaml"))).toBe(true)
  expect(result.files).toContain("MEMORY.md")
})

test("init refuses a non-empty directory without --force", async () => {
  await using tmp = await tmpdir()
  const brainPath = join(tmp.path, "brain")
  await initBrain(brainPath)

  await expect(initBrain(brainPath)).rejects.toThrow(/non-empty/)

  // --force reinitializes in place
  const again = await initBrain(brainPath, { force: true })
  expect(again.path).toBe(brainPath)
  expect(existsSync(join(brainPath, "identity.md"))).toBe(true)
})

test("status reports uncommitted changes and stays clean after init", async () => {
  await using tmp = await tmpdir()
  const brainPath = join(tmp.path, "brain")
  await initBrain(brainPath)

  expect((await getBrainStatus(brainPath)).clean).toBe(true)

  writeFileSync(join(brainPath, "ideas", "new-idea.md"), "---\ntype: idea\nstatus: new\ndomain: meta\n---\n")
  const dirty = await getBrainStatus(brainPath)
  expect(dirty.uncommitted.length).toBe(1)
  expect(dirty.clean).toBe(false)
})

test("status on a missing brain reports exists=false", async () => {
  await using tmp = await tmpdir()
  const status = await getBrainStatus(join(tmp.path, "nope"))
  expect(status.exists).toBe(false)
})

test("sync without a remote reports no-remote (friendly, never fails)", async () => {
  await using tmp = await tmpdir()
  const brainPath = join(tmp.path, "brain")
  await initBrain(brainPath)

  const result = await syncBrain(brainPath)
  expect(result.kind).toBe("no-remote")
})

test("sync refuses to run with uncommitted changes", async () => {
  await using tmp = await tmpdir()
  const brainPath = join(tmp.path, "brain")
  await initBrain(brainPath)
  await setBrainRemote(brainPath, "https://example.invalid/brain.git")

  writeFileSync(join(brainPath, "ideas", "dirty.md"), "dirty\n")
  const result = await syncBrain(brainPath)
  expect(result.kind).toBe("dirty")
})

test("remote sets origin and keeps the repo clean", async () => {
  await using tmp = await tmpdir()
  const brainPath = join(tmp.path, "brain")
  await initBrain(brainPath)

  await setBrainRemote(brainPath, "https://example.invalid/brain.git")
  const status = await getBrainStatus(brainPath)
  expect(status.remote).toBe("https://example.invalid/brain.git")
  expect(status.uncommitted).toEqual([])
  expect(readFileSync(join(brainPath, "brain.yaml"), "utf8")).toContain(
    'remote: "https://example.invalid/brain.git"',
  )
})

test("templates are deterministic for a fixed clock", () => {
  const now = new Date("2026-08-02T00:00:00.000Z")
  const a = brainTemplates(now)
  const b = brainTemplates(now)
  expect(a.map((t) => t.path)).toEqual(b.map((t) => t.path))
  expect(a.map((t) => t.content)).toEqual(b.map((t) => t.content))
})

test("settings schema accepts brain.path in BOTH duplicated schema trees", () => {
  for (const Schema of [SharedSettingsSchema, InkSettingsSchema]) {
    const result = Schema().safeParse({ brain: { path: "/tmp/brain" } })
    expect(result.success).toBe(true)
  }
})

test("default brain path is ~/brain", () => {
  expect(DEFAULT_BRAIN_PATH.endsWith(join("brain"))).toBe(true)
  expect(DEFAULT_BRAIN_PATH.startsWith("/")).toBe(true)
})
