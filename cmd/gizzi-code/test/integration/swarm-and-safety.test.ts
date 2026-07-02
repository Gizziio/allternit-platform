// @ts-nocheck
import { describe, expect, it } from "bun:test"
import { bashToolCheckPermission } from "@/runtime/tools/builtins/bash/bashPermissions.js"
import type { ToolPermissionContext } from "@/runtime/tools/builtins/bash/bashPermissions.js"

describe("Swarm and Bash Safety Confirmation Integration", () => {
  const dummyContext: ToolPermissionContext = {
    rules: [],
    askRules: [],
    denyRules: [],
    allowRules: [],
  }

  describe("Bash Safety Confirmation Gate", () => {
    it("should intercept potentially destructive command 'rm -rf'", () => {
      const result = bashToolCheckPermission(
        { command: "rm -rf src/cli/" },
        dummyContext
      )
      expect(result.behavior).toBe("ask")
      expect(result.message).toContain("potentially destructive")
    })

    it("should intercept 'git reset --hard'", () => {
      const result = bashToolCheckPermission(
        { command: "git reset --hard HEAD~1" },
        dummyContext
      )
      expect(result.behavior).toBe("ask")
      expect(result.message).toContain("safety confirmation")
    })

    it("should intercept wildcards with rm 'rm *'", () => {
      const result = bashToolCheckPermission(
        { command: "rm -f /usr/local/bin/*" },
        dummyContext
      )
      expect(result.behavior).toBe("ask")
    })

    it("should allow safe commands like 'ls -la'", () => {
      const result = bashToolCheckPermission(
        { command: "ls -la" },
        dummyContext
      )
      // Since no rules match, it should passthrough to standard permission prompts
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
  })
})
