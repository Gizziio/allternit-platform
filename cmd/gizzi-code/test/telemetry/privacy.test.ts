import { describe, expect, test } from "bun:test"
import { cleanTelemetryString } from "@/runtime/telemetry/privacy"

describe("runtime telemetry privacy", () => {
  test("redacts common identity, secret, URL, and path shapes", () => {
    const cleaned = cleanTelemetryString(
      "alice@example.com https://example.com/private ghp_123456789012345678901234 /Users/alice/project/file.ts",
    )
    expect(cleaned).not.toContain("alice@example.com")
    expect(cleaned).not.toContain("example.com")
    expect(cleaned).not.toContain("ghp_")
    expect(cleaned).not.toContain("/Users/alice")
  })

  test("retains diagnostic node_modules tails", () => {
    expect(cleanTelemetryString("/Users/alice/project/node_modules/pkg/index.js")).toContain("node_modules/pkg/index.js")
  })
})

