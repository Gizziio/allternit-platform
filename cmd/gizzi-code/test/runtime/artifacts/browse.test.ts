// @ts-nocheck
import { describe, expect, test } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "../../fixture/fixture"
import {
  artifactInputToMarkdown,
  describeEntryMeta,
  estimateRenderedLines,
  formatBytes,
  formatDate,
  listArtifacts,
  readArtifactMarkdown,
  resolveArtifactsRoot,
} from "../../../src/runtime/artifacts/browse"

const SAMPLE_INPUT = {
  title: "Launch Checklist",
  subtitle: "v1 rollout",
  status: { label: "On track", tone: "accent" },
  tabs: [
    {
      id: "overview",
      label: "Overview",
      callout: { text: "Freeze on Friday" },
      sections: [
        {
          heading: "Scope",
          body: ["Ship the CLI.", "Docs follow."],
          list: ["one", "two"],
          stats: [{ label: "tasks done", value: "12" }],
          table: { headers: ["a", "b|"], rows: [["1", "2"]] },
        },
      ],
    },
  ],
}

function writeCanvasConfig(root: string, slug: string, extra: Record<string, unknown> = {}) {
  const dir = join(root, slug)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, "config.json"),
    JSON.stringify({
      configVersion: 1,
      artifactKey: slug,
      sessionId: "sess-1",
      canvasId: "canvas-123",
      lastPublishedVersion: 2,
      lastPublishedAt: "2026-09-25T10:00:00.000Z",
      input: SAMPLE_INPUT,
      ...extra,
    }),
  )
}

describe("resolveArtifactsRoot", () => {
  test("prefers .gizzi/artifacts when it exists", async () => {
    await using tmp = await tmpdir()
    mkdirSync(join(tmp.path, ".gizzi", "artifacts"), { recursive: true })
    mkdirSync(join(tmp.path, ".claude", "artifacts"), { recursive: true })
    const res = resolveArtifactsRoot(tmp.path)
    expect(res.root).toBe(join(tmp.path, ".gizzi", "artifacts"))
    expect(res.source).toBe("gizzi")
  })

  test("falls back to .claude/artifacts (read-only compat)", async () => {
    await using tmp = await tmpdir()
    mkdirSync(join(tmp.path, ".claude", "artifacts"), { recursive: true })
    const res = resolveArtifactsRoot(tmp.path)
    expect(res.root).toBe(join(tmp.path, ".claude", "artifacts"))
    expect(res.source).toBe("claude")
  })

  test("defaults to the .gizzi path when neither exists", async () => {
    await using tmp = await tmpdir()
    const res = resolveArtifactsRoot(tmp.path)
    expect(res.root).toBe(join(tmp.path, ".gizzi", "artifacts"))
    expect(res.source).toBe("gizzi")
  })
})

describe("listArtifacts", () => {
  test("returns [] for a missing directory", async () => {
    await using tmp = await tmpdir()
    expect(listArtifacts(join(tmp.path, "nope"))).toEqual([])
  })

  test("lists canvas configs and loose .md files, newest first", async () => {
    await using tmp = await tmpdir()
    const root = join(tmp.path, ".gizzi", "artifacts")
    writeCanvasConfig(root, "launch-checklist")
    writeFileSync(join(root, "report.md"), "# Report\n")
    // A directory without config.json is not an artifact.
    mkdirSync(join(root, "stray-dir"))
    writeFileSync(join(root, "notes.txt"), "not markdown")

    const entries = listArtifacts(root)
    expect(entries.map(e => (e.kind === "canvas" ? e.slug : e.name)).sort()).toEqual([
      "launch-checklist",
      "report.md",
    ])
    const canvas = entries.find(e => e.kind === "canvas")!
    expect(canvas.title).toBe("Launch Checklist")
    expect(canvas.canvasId).toBe("canvas-123")
    expect(canvas.version).toBe(2)
    expect(canvas.configPath).toBe(join(root, "launch-checklist", "config.json"))
    const md = entries.find(e => e.kind === "markdown")!
    expect(md.filePath).toBe(join(root, "report.md"))
    // mtimes: report.md written after the config → sorted first
    expect(entries[0].kind).toBe("markdown")
  })

  test("tolerates a corrupt config.json (title falls back to slug)", async () => {
    await using tmp = await tmpdir()
    const root = join(tmp.path, ".gizzi", "artifacts")
    const dir = join(root, "broken")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "config.json"), "{not json")
    const entries = listArtifacts(root)
    expect(entries).toHaveLength(1)
    expect(entries[0].kind).toBe("canvas")
    expect(entries[0].title).toBe("broken")
  })
})

describe("readArtifactMarkdown", () => {
  test("reads loose markdown verbatim", async () => {
    await using tmp = await tmpdir()
    const root = join(tmp.path, ".gizzi", "artifacts")
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, "report.md"), "# Report\n\nbody\n")
    const [entry] = listArtifacts(root)
    expect(readArtifactMarkdown(entry)).toBe("# Report\n\nbody\n")
  })

  test("renders a canvas config as markdown from its saved input", async () => {
    await using tmp = await tmpdir()
    const root = join(tmp.path, ".gizzi", "artifacts")
    writeCanvasConfig(root, "launch-checklist")
    const [entry] = listArtifacts(root)
    const md = readArtifactMarkdown(entry)
    expect(md).toContain("# Launch Checklist")
    expect(md).toContain("key `launch-checklist`")
    expect(md).toContain("canvas `canvas-123`")
    expect(md).toContain("version 2")
    expect(md).toContain("## Overview")
  })

  test("falls back to a field summary when input is unusable", async () => {
    await using tmp = await tmpdir()
    const root = join(tmp.path, ".gizzi", "artifacts")
    const dir = join(root, "naked")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "config.json"), JSON.stringify({ artifactKey: "naked", canvasId: "c1" }))
    const [entry] = listArtifacts(root)
    const md = readArtifactMarkdown(entry)
    expect(md).toContain("# naked")
    expect(md).toContain("No saved generator input")
  })
})

describe("artifactInputToMarkdown", () => {
  test("renders all section shapes", () => {
    const md = artifactInputToMarkdown(SAMPLE_INPUT, {
      artifactKey: "launch-checklist",
      canvasId: "canvas-123",
      version: 2,
      publishedAt: "2026-09-25T10:00:00.000Z",
    })
    expect(md).toContain("# Launch Checklist")
    expect(md).toContain("v1 rollout")
    expect(md).toContain("**Status:** On track")
    expect(md).toContain("_key `launch-checklist` · canvas `canvas-123` · version 2 · published 2026-09-25T10:00:00.000Z_")
    expect(md).toContain("## Overview")
    expect(md).toContain("> Freeze on Friday")
    expect(md).toContain("### Scope")
    expect(md).toContain("Ship the CLI.")
    expect(md).toContain("- one")
    expect(md).toContain("- **12** — tasks done")
    // pipes in cells are escaped so the markdown table stays intact
    expect(md).toContain("| a | b\\| |")
    expect(md).toContain("| --- | --- |")
    expect(md).toContain("| 1 | 2 |")
  })
})

describe("formatting helpers", () => {
  test("formatBytes", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048)).toBe("2.0 KB")
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB")
  })

  test("formatDate", () => {
    expect(formatDate(0)).toBe("—")
    expect(formatDate(new Date(2026, 8, 26, 14, 3).getTime())).toBe("2026-09-26 14:03")
  })

  test("describeEntryMeta", async () => {
    await using tmp = await tmpdir()
    const root = join(tmp.path, ".gizzi", "artifacts")
    writeCanvasConfig(root, "launch-checklist")
    writeFileSync(join(root, "report.md"), "x".repeat(2048))
    const entries = listArtifacts(root)
    const canvas = entries.find(e => e.kind === "canvas")!
    expect(describeEntryMeta(canvas)).toContain("v2")
    expect(describeEntryMeta(canvas)).toContain("canvas-123")
    const md = entries.find(e => e.kind === "markdown")!
    expect(describeEntryMeta(md)).toContain("2.0 KB")
  })

  test("estimateRenderedLines wraps at the given width", () => {
    expect(estimateRenderedLines("short", 80)).toBe(1)
    const long = "x".repeat(200)
    expect(estimateRenderedLines(long, 50)).toBe(4)
    expect(estimateRenderedLines("a\n\nb", 80)).toBe(3)
    // degenerate widths clamp to a sane minimum instead of dividing by ~0
    expect(estimateRenderedLines(long, 1)).toBe(Math.ceil(200 / 20))
  })
})
