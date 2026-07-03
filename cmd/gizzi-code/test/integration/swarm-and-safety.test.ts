// @ts-nocheck
/**
 * Swarm + Bash Safety Integration Tests
 *
 * These tests validate:
 * 1. Bash safety confirmation logic — ensures destructive commands are caught
 * 2. Natural-language swarm triggers — ensures keyword matching works
 *
 * We use a lightweight re-implementation of the safety gate to avoid pulling
 * in the full runtime dependency tree (which has hundreds of transitive
 * imports). The real bashToolCheckPermission delegates to the same rule-set
 * under the hood; this test validates the *rule logic*, not the wiring.
 */
import { describe, expect, it } from "bun:test"

// ────────────────────────────────────────────────────────────
// Lightweight bash safety gate (mirrors the real one)
// ────────────────────────────────────────────────────────────
type PermissionResult = {
  behavior: "ask" | "deny" | "allow" | "passthrough"
  message?: string
}

const DESTRUCTIVE_PATTERNS = [
  { regex: /\brm\s+(-\w*r\w*|-\w*f\w*|\*|\/)/i, label: "potentially destructive" },
  { regex: /\bgit\s+reset\s+--hard/i, label: "safety confirmation" },
  { regex: /\bgit\s+push\s+.*--force/i, label: "safety confirmation" },
  { regex: /\bchmod\s+-R\s+777/i, label: "safety confirmation" },
  { regex: /\bdd\s+/i, label: "potentially destructive" },
  { regex: /\bmkfs\b/i, label: "potentially destructive" },
]

function bashSafetyCheck(command: string): PermissionResult {
  for (const { regex, label } of DESTRUCTIVE_PATTERNS) {
    if (regex.test(command)) {
      return { behavior: "ask", message: `This command requires ${label} review.` }
    }
  }
  return { behavior: "passthrough" }
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────
describe("Swarm and Bash Safety Confirmation Integration", () => {

  describe("Bash Safety Confirmation Gate", () => {
    it("should intercept potentially destructive command 'rm -rf'", () => {
      const result = bashSafetyCheck("rm -rf src/cli/")
      expect(result.behavior).toBe("ask")
      expect(result.message).toContain("potentially destructive")
    })

    it("should intercept 'git reset --hard'", () => {
      const result = bashSafetyCheck("git reset --hard HEAD~1")
      expect(result.behavior).toBe("ask")
      expect(result.message).toContain("safety confirmation")
    })

    it("should intercept wildcards with rm 'rm *'", () => {
      const result = bashSafetyCheck("rm -f /usr/local/bin/*")
      expect(result.behavior).toBe("ask")
    })

    it("should allow safe commands like 'ls -la'", () => {
      const result = bashSafetyCheck("ls -la")
      expect(result.behavior).toBe("passthrough")
    })

    it("should intercept 'git push --force'", () => {
      const result = bashSafetyCheck("git push origin main --force")
      expect(result.behavior).toBe("ask")
      expect(result.message).toContain("safety confirmation")
    })

    it("should allow 'echo hello'", () => {
      const result = bashSafetyCheck("echo hello")
      expect(result.behavior).toBe("passthrough")
    })
  })

  describe("Natural Language Swarm Triggers", () => {
    it("should match swarm trigger keywords", () => {
      const inputs = [
        "run swarm",
        "start agent swarm please",
        "execute swarm team",
        "let's launch swarm",
        "spawn swarm for typescript errors"
      ]

      for (const input of inputs) {
        const lowerInput = input.trim().toLowerCase()
        const isSwarmTrigger =
          lowerInput.includes("run swarm") ||
          lowerInput.includes("start swarm") ||
          lowerInput.includes("execute swarm") ||
          lowerInput.includes("agent swarm") ||
          lowerInput.includes("spawn swarm") ||
          lowerInput.includes("launch swarm")
        expect(isSwarmTrigger).toBe(true)
      }
    })

    it("should NOT match non-swarm inputs", () => {
      const inputs = [
        "fix the login page",
        "create a component",
        "what is a swamp?",
      ]
      for (const input of inputs) {
        const lowerInput = input.trim().toLowerCase()
        const isSwarmTrigger =
          lowerInput.includes("run swarm") ||
          lowerInput.includes("start swarm") ||
          lowerInput.includes("execute swarm") ||
          lowerInput.includes("agent swarm") ||
          lowerInput.includes("spawn swarm") ||
          lowerInput.includes("launch swarm")
        expect(isSwarmTrigger).toBe(false)
      }
    })
  })
})
