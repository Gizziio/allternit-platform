import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "fs"
import { dirname, join } from "path"

// @ts-nocheck burn-down regression guard.
//
// The burn-down queue (script/typecheck-burndown/queue.json) is the committed
// baseline: it lists every handwritten nocheck file, packed into burn-down
// batches. This guard enforces two invariants:
//
//   1. The nocheck population must NEVER GROW. The burn-down only moves one
//      way: files leave the queue when their header is removed and their
//      type errors are fixed. If someone adds a new file carrying
//      `// @ts-nocheck` (or removes an exclusion from an existing file), the
//      eligible count rises above the baseline and this test fails.
//      Escape hatch: test/ts-nocheck-allowlist.txt — an explicit, reviewed
//      list of intentional exceptions (see that file's header).
//
//   2. Every file listed in queue.json must STILL carry the header. Burning
//      down a file means removing its `// @ts-nocheck` line — which is only
//      legal together with updating queue.json (removing the file from its
//      batch / marking state). A listed file whose header is gone means the
//      queue state was not updated; the batch plan would silently rot.
//
// The exclusion rules (compiler-artifact fingerprints, vendored ink/vim
// subtrees) are shared with the queue builder via import, so this test can
// never disagree with the generator about what counts.

// plain Node .mjs, no types — the scan rules live here so the guard cannot
// disagree with the generator about what counts.
import { scanQueue } from "../script/typecheck-burndown/build-queue.mjs"

const ROOT = join(import.meta.dir, "..")
const QUEUE_FILE = join(ROOT, "script", "typecheck-burndown", "queue.json")
const ALLOWLIST = join(import.meta.dir, "ts-nocheck-allowlist.txt")
const NOCHECK_HEADER = "// @ts-nocheck"

const queue = JSON.parse(readFileSync(QUEUE_FILE, "utf8"))

const allowlist = new Set(
  readFileSync(ALLOWLIST, "utf8")
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#")),
)

const current = scanQueue()

describe("ts-nocheck burn-down guard", () => {
  test("committed queue is internally consistent", () => {
    expect(queue.version).toBe(1)
    expect(queue.batchCount).toBe(queue.batches.length)
    expect(queue.stats.totalQueueFiles).toBe(
      queue.batches.reduce((n: number, b: { files: string[] }) => n + b.files.length, 0),
    )
    // every queued file exists on disk
    for (const b of queue.batches) {
      for (const f of b.files) {
        expect(existsSync(join(ROOT, f)), `${f} listed in queue.json but missing on disk`).toBe(true)
      }
    }
    // no file appears in two batches
    const seen = new Set<string>()
    for (const b of queue.batches) {
      for (const f of b.files) {
        expect(seen.has(f), `${f} appears in more than one batch`).toBe(false)
        seen.add(f)
      }
    }
  })

  test("nocheck count has not increased vs the committed baseline", () => {
    const allowed = current.queue.filter(f => allowlist.has(f.path))
    const eligible = current.queue.filter(f => !allowlist.has(f.path))
    expect(
      eligible.length,
      `handwritten @ts-nocheck files grew: ${eligible.length} now vs baseline ` +
        `${queue.stats.totalQueueFiles}. Burn down, do not add. If this file is an ` +
        `intentional exception, list it in test/ts-nocheck-allowlist.txt.`,
    ).toBeLessThanOrEqual(queue.stats.totalQueueFiles)
    // allowlist entries must actually be nocheck files, else the list is stale
    expect(allowed.length).toBe(allowlist.size)
    // the committed baseline must match the same exclusion rules
    expect(current.totalNocheck).toBe(queue.stats.totalNocheck)
    expect(current.excludedCompilerArtifacts).toBe(queue.stats.excludedCompilerArtifacts)
    expect(current.excludedVendored).toBe(queue.stats.excludedVendored)
  })

  test("every queued file still carries the @ts-nocheck header", () => {
    const burned: string[] = []
    for (const b of queue.batches) {
      for (const f of b.files) {
        const text = readFileSync(join(ROOT, f), "utf8")
        if (!text.startsWith(NOCHECK_HEADER)) burned.push(f)
      }
    }
    expect(
      burned,
      "files burned down without updating script/typecheck-burndown/queue.json: " +
        burned.join(", "),
    ).toEqual([])
  })
})
