/**
 * Agent Workspace - Policy Engine
 * 
 * Enforces policies from L2-IDENTITY/POLICY.md and L3-GOVERNANCE/PLAYBOOK.md
 * Mirrors the kernel's policy engine but for client-side enforcement.
 */

import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"
import path from "path"

const log = Log.create({ service: "agent_workspace.policy" })

export namespace PolicyEngine {
  export interface Policy {
    id: string
    name: string
    description: string
    scope: "tool" | "file" | "session" | "global"
    condition: string
    action: "allow" | "deny" | "ask"
    priority: number
  }

  export interface PolicyResult {
    allowed: boolean
    action: "allow" | "deny" | "ask"
    reason?: string
    policy?: Policy
  }

  export interface ToolCall {
    tool: string
    args: Record<string, unknown>
    context: {
      sessionId: string
      dagNodeId: string
      filesAccessed: string[]
    }
  }

  /**
   * Load policies from workspace
   * 
   * Reads L2-IDENTITY/POLICY.md and parses policy rules.
   */
  export async function loadPolicies(workspace: string): Promise<Policy[]> {
    const policyPath = path.join(workspace, ".a2r", "L2-IDENTITY", "POLICY.md")
    const policies: Policy[] = []

    try {
      const content = await Filesystem.readText(policyPath)
      
      // Parse markdown for policy rules
      // Format: "- [ACTION] SCOPE: CONDITION - DESCRIPTION"
      const policyRegex = /^-\s*\[(\w+)\]\s*(\w+):\s*(.+?)\s*-\s*(.+)$/gm
      let match
      let id = 0

      while ((match = policyRegex.exec(content)) !== null) {
        policies.push({
          id: `policy-${++id}`,
          action: match[1].toLowerCase() as "allow" | "deny" | "ask",
          scope: match[2].toLowerCase() as "tool" | "file" | "session" | "global",
          condition: match[3].trim(),
          description: match[4].trim(),
          name: match[3].trim(),
          priority: 100 - id, // Earlier policies have higher priority
        })
      }

      log.debug("Loaded policies", { count: policies.length })
    } catch (error) {
      log.debug("No POLICY.md found, using defaults")
      // Return default policies
      return getDefaultPolicies()
    }

    return policies
  }

  /**
   * Evaluate tool call against policies
   * 
   * Mirrors kernel's PreToolUse gating.
   */
  export async function evaluateToolCall(
    workspace: string,
    call: ToolCall
  ): Promise<PolicyResult> {
    const policies = await loadPolicies(workspace)

    // Find matching policies (most specific first)
    const matchingPolicies = policies
      .filter(p => matchesPolicy(p, call))
      .sort((a, b) => b.priority - a.priority)

    if (matchingPolicies.length === 0) {
      return { allowed: true, action: "allow" }
    }

    // Apply highest priority policy
    const policy = matchingPolicies[0]
    const result: PolicyResult = {
      allowed: policy.action !== "deny",
      action: policy.action,
      policy,
      reason: policy.description,
    }

    log.debug("Policy evaluation", {
      tool: call.tool,
      action: result.action,
      policy: policy.id,
    })

    return result
  }

  /**
   * Check if policy matches tool call
   */
  function matchesPolicy(policy: Policy, call: ToolCall): boolean {
    switch (policy.scope) {
      case "tool":
        return matchesCondition(policy.condition, call.tool)
      case "file":
        return call.context.filesAccessed.some(f => 
          matchesCondition(policy.condition, f)
        )
      case "session":
        return true // Session-level policies always match
      case "global":
        return true
      default:
        return false
    }
  }

  /**
   * Simple pattern matching for conditions
   */
  function matchesCondition(condition: string, value: string): boolean {
    // Support wildcards: "bash:*", "file:*.ts"
    if (condition.includes("*")) {
      const regex = new RegExp("^" + condition.replace(/\*/g, ".*") + "$")
      return regex.test(value)
    }
    return condition === value
  }

  /**
   * Get default policies
   */
  function getDefaultPolicies(): Policy[] {
    return [
      {
        id: "default-1",
        name: "Verify destructive",
        description: "Always verify before destructive operations",
        scope: "tool",
        condition: "destructive",
        action: "ask",
        priority: 100,
      },
      {
        id: "default-2",
        name: "Log all actions",
        description: "Log all actions to memory.jsonl",
        scope: "global",
        condition: "*",
        action: "allow",
        priority: 1,
      },
    ]
  }

  /**
   * Add policy to workspace
   */
  export async function addPolicy(
    workspace: string,
    policy: Omit<Policy, "id">
  ): Promise<void> {
    const policyPath = path.join(workspace, ".a2r", "L2-IDENTITY", "POLICY.md")
    
    const line = `- [${policy.action.toUpperCase()}] ${policy.scope.toUpperCase()}: ${policy.condition} - ${policy.description}\n`
    
    try {
      await Filesystem.append(policyPath, line)
      log.info("Policy added", { scope: policy.scope, condition: policy.condition })
    } catch (error) {
      log.error("Failed to add policy", { error })
      throw error
    }
  }
}
