// @ts-nocheck
// Verifies gizzi's search path uses the VENDORED ripgrep binary
// (vendor/ripgrep/<arch>-<platform>/rg), not a system rg.
import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ripGrep, ripgrepCommand } from "@/shared/utils/ripgrep"

describe("vendored ripgrep", () => {
  test("resolves the vendored binary and searches with it", async () => {
    const { rgPath } = ripgrepCommand()
    expect(rgPath).toContain("vendor/ripgrep/")
    expect(rgPath).toContain(`${process.arch}-${process.platform}`)

    const dir = mkdtempSync(join(tmpdir(), "rg-vendor-test-"))
    writeFileSync(join(dir, "haystack.txt"), "nothing here\ngizzi-rg-vendor-ok needle\nbye\n")

    const results = await ripGrep(["-n", "gizzi-rg-vendor-ok"], dir)
    const text = Array.isArray(results) ? results.join("\n") : String(results)
    expect(text).toContain("gizzi-rg-vendor-ok needle")
  }, 15_000)
})
