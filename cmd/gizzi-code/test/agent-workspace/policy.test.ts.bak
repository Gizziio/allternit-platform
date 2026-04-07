// @ts-nocheck
/**
 * Agent Workspace - Policy Engine Tests
 * 
 * Tests the policy enforcement engine for client-side validation.
 */

import { describe, test, expect } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { PolicyEngine } from "../../src/agent-workspace/policy"
import { AgentWorkspace } from "../../src/agent-workspace/artifacts"
import { tmpdir } from "../fixture/fixture"

describe("PolicyEngine", () => {
  describe("loadPolicies()", () => {
    test("loads policies from POLICY.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Write custom policy file
      const policyContent = `- [ALLOW] tool: read_file - Allow reading files
- [DENY] tool: bash:rm - Prevent file deletion
- [ASK] file: *.secret - Ask before accessing secrets
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies.length).toBe(3)
      expect(policies[0].action).toBe("allow")
      expect(policies[0].scope).toBe("tool")
      expect(policies[0].condition).toBe("read_file")
      expect(policies[1].action).toBe("deny")
      expect(policies[2].action).toBe("ask")
    })

    test("assigns unique IDs to policies", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ALLOW] tool: test1 - First policy
- [DENY] tool: test2 - Second policy
- [ASK] tool: test3 - Third policy
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies[0].id).toBe("policy-1")
      expect(policies[1].id).toBe("policy-2")
      expect(policies[2].id).toBe("policy-3")
    })

    test("assigns descending priority to policies", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ALLOW] tool: first - First policy
- [DENY] tool: second - Second policy
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies[0].priority).toBe(99) // 100 - 1
      expect(policies[1].priority).toBe(98) // 100 - 2
    })

    test("returns default policies when POLICY.md doesn't exist", async () => {
      await using tmp = await tmpdir()
      // Don't initialize workspace

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies.length).toBe(2)
      expect(policies[0].id).toBe("default-1")
      expect(policies[0].name).toBe("Verify destructive")
      expect(policies[0].action).toBe("ask")
      expect(policies[1].id).toBe("default-2")
      expect(policies[1].name).toBe("Log all actions")
      expect(policies[1].action).toBe("allow")
    })

    test("returns empty policies for empty POLICY.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, "", "utf-8")

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies.length).toBe(0)
    })

    test("handles policies with special characters in description", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ASK] tool: dangerous - Ask before: running destructive commands with "quotes" and 'apostrophes'
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies.length).toBe(1)
      expect(policies[0].description).toContain('"quotes"')
    })

    test("handles uppercase action and scope", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ALLOW] TOOL: test - Test policy
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const policies = await PolicyEngine.loadPolicies(tmp.path)

      expect(policies[0].action).toBe("allow")
      expect(policies[0].scope).toBe("tool")
    })
  })

  describe("evaluateToolCall()", () => {
    test("allows tool call when no matching policy", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Clear policies
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, "", "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "read_file",
        args: { path: "/test" },
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.allowed).toBe(true)
      expect(result.action).toBe("allow")
    })

    test("denies tool call matching deny policy", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [DENY] tool: rm_rf - Never allow rm -rf
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "rm_rf",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.allowed).toBe(false)
      expect(result.action).toBe("deny")
      expect(result.policy?.condition).toBe("rm_rf")
    })

    test("asks for tool call matching ask policy", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ASK] tool: destructive - Ask before destructive ops
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "destructive",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.allowed).toBe(true) // ASK means allowed but requires confirmation
      expect(result.action).toBe("ask")
    })

    test("uses highest priority matching policy", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ALLOW] tool: test - Allow test
- [DENY] tool: test - Deny test
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "test",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      // First policy has higher priority
      expect(result.action).toBe("allow")
    })

    test("matches wildcard tool patterns", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ASK] tool: bash:* - Ask before any bash command
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "bash:rm",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.action).toBe("ask")
    })

    test("doesn't match wildcard when tool doesn't match pattern", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [DENY] tool: bash:* - Deny all bash
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "read_file",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.allowed).toBe(true)
      expect(result.action).toBe("allow")
    })

    test("matches file scope policies", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ASK] file: *.secret - Ask before accessing secrets
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "read_file",
        args: { path: "config.secret" },
        context: { 
          sessionId: "test", 
          dagNodeId: "1", 
          filesAccessed: ["config.secret"],
        },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.action).toBe("ask")
    })

    test("matches file wildcard patterns", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [DENY] file: *.env - Deny env files
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "read_file",
        args: {},
        context: { 
          sessionId: "test", 
          dagNodeId: "1", 
          filesAccessed: [".env", ".env.local"],
        },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.action).toBe("deny")
    })

    test("session scope policies always match", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ASK] session: * - Always ask in session
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "any_tool",
        args: {},
        context: { 
          sessionId: "test", 
          dagNodeId: "1", 
          filesAccessed: [],
        },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.action).toBe("ask")
    })

    test("global scope policies always match", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ALLOW] global: * - Allow everything
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "any_tool",
        args: {},
        context: { 
          sessionId: "test", 
          dagNodeId: "1", 
          filesAccessed: [],
        },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.action).toBe("allow")
    })

    test("includes reason in result", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [DENY] tool: dangerous - This is very dangerous
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "dangerous",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.reason).toBe("This is very dangerous")
    })

    test("includes matching policy in result", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const policyContent = `- [ALLOW] tool: test - Test policy
`
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l2_policy_md, policyContent, "utf-8")

      const call: PolicyEngine.ToolCall = {
        tool: "test",
        args: {},
        context: { sessionId: "test", dagNodeId: "1", filesAccessed: [] },
      }

      const result = await PolicyEngine.evaluateToolCall(tmp.path, call)

      expect(result.policy).toBeDefined()
      expect(result.policy?.id).toBe("policy-1")
      expect(result.policy?.condition).toBe("test")
    })
  })

  describe("addPolicy()", () => {
    test("appends policy to POLICY.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const newPolicy: Omit<PolicyEngine.Policy, "id"> = {
        name: "Test Policy",
        description: "Test policy description",
        scope: "tool",
        condition: "test_tool",
        action: "ask",
        priority: 50,
      }

      await PolicyEngine.addPolicy(tmp.path, newPolicy)

      const paths = AgentWorkspace.getPaths(tmp.path)
      const content = await fs.readFile(paths.l2_policy_md, "utf-8")
      expect(content).toContain("[ASK]")
      expect(content).toContain("TOOL:")
      expect(content).toContain("test_tool")
      expect(content).toContain("Test policy description")
    })

    test("appends to existing policies", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const paths = AgentWorkspace.getPaths(tmp.path)
      const initialContent = "# Existing Policy\n\n- [ALLOW] tool: existing - Existing policy\n"
      await fs.writeFile(paths.l2_policy_md, initialContent, "utf-8")

      const newPolicy: Omit<PolicyEngine.Policy, "id"> = {
        name: "New Policy",
        description: "New policy description",
        scope: "file",
        condition: "*.new",
        action: "deny",
        priority: 40,
      }

      await PolicyEngine.addPolicy(tmp.path, newPolicy)

      const content = await fs.readFile(paths.l2_policy_md, "utf-8")
      expect(content).toContain("Existing policy")
      expect(content).toContain("New policy description")
      expect(content).toContain("[DENY]")
    })

    test("converts action to uppercase", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const newPolicy: Omit<PolicyEngine.Policy, "id"> = {
        name: "Test",
        description: "Test",
        scope: "tool",
        condition: "test",
        action: "allow",
        priority: 50,
      }

      await PolicyEngine.addPolicy(tmp.path, newPolicy)

      const paths = AgentWorkspace.getPaths(tmp.path)
      const content = await fs.readFile(paths.l2_policy_md, "utf-8")
      expect(content).toContain("[ALLOW]")
    })

    test("converts scope to uppercase", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const newPolicy: Omit<PolicyEngine.Policy, "id"> = {
        name: "Test",
        description: "Test",
        scope: "session",
        condition: "test",
        action: "ask",
        priority: 50,
      }

      await PolicyEngine.addPolicy(tmp.path, newPolicy)

      const paths = AgentWorkspace.getPaths(tmp.path)
      const content = await fs.readFile(paths.l2_policy_md, "utf-8")
      expect(content).toContain("SESSION:")
    })
  })
})
