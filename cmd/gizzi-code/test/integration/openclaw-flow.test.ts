// @ts-nocheck
/**
 * E2E Test - Full OpenClaw Workspace Integration Flow
 * 
 * Tests the complete flow with actual .openclaw workspace:
 * 1. Detect workspace
 * 2. Load Gizzi identity
 * 3. Load workspace agents
 * 4. Create agents with workspace context
 */

import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import * as AgentWorkspaceBridge from "@/agent-workspace/bridge"
import * as AgentWorkspaceLoader from "@/agent/workspace-loader"
import { rmdir, mkdir, writeFile, readFile } from "fs/promises"
import path from "path"
import fs from "fs/promises"
import os from "os"

describe("OpenClaw Full Flow Integration", () => {
  const testDir = "/tmp/allternit-openclaw-flow-test"
  const homeDir = os.homedir()
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })
  })
  
  afterAll(async () => {
    try {
      await rmdir(testDir, { recursive: true })
    } catch {}
  })

  describe("Real .openclaw Detection", () => {
    it("should detect user's .openclaw if it exists", async () => {
      const openclawPath = path.join(homeDir, ".openclaw")
      const exists = await fs.access(openclawPath).then(() => true).catch(() => false)
      
      if (!exists) {
        console.log("Skipping: No .openclaw in home directory")
        return
      }
      
      // Should detect when checking home directory
      const detected = await AgentWorkspaceBridge.detectWorkspace(homeDir)
      
      expect(detected).not.toBeNull()
      expect(detected?.type).toBe("openclaw")
      expect(detected?.path).toBe(openclawPath)
    })

    it("should load Gizzi identity from .openclaw", async () => {
      const openclawPath = path.join(homeDir, ".openclaw")
      const identityPath = path.join(openclawPath, "workspace", "docs", "IDENTITY.md")
      
      const exists = await fs.access(identityPath).then(() => true).catch(() => false)
      
      if (!exists) {
        console.log("Skipping: No IDENTITY.md in .openclaw")
        return
      }
      
      const detected = await AgentWorkspaceBridge.detectWorkspace(homeDir)
      
      expect(detected?.identity).toBeDefined()
      expect(detected?.identity?.name).toContain("Gizzi")
      expect(detected?.hasSoul).toBe(true)
    })

    it("should find gizzi-orchestrator agent", async () => {
      const openclawPath = path.join(homeDir, ".openclaw")
      const gizziPath = path.join(openclawPath, "workspace", "agents", "gizzi-orchestrator", "config.json")
      
      const exists = await fs.access(gizziPath).then(() => true).catch(() => false)
      
      if (!exists) {
        console.log("Skipping: No gizzi-orchestrator config found")
        return
      }
      
      const agents = await AgentWorkspaceBridge.getWorkspaceAgents(openclawPath, "openclaw")
      
      const gizzi = agents.find(a => a.name.toLowerCase().includes("gizzi"))
      expect(gizzi).toBeDefined()
      expect(gizzi?.config?.purpose).toBeDefined()
    })
  })

  describe("Workspace-Aware Prompt Generation", () => {
    it("should generate Gizzi-aware prompt", async () => {
      const openclawPath = path.join(homeDir, ".openclaw")
      const exists = await fs.access(openclawPath).then(() => true).catch(() => false)
      
      if (!exists) {
        console.log("Skipping: No .openclaw found")
        return
      }
      
      const detected = await AgentWorkspaceBridge.detectWorkspace(homeDir)
      if (!detected?.identity) {
        console.log("Skipping: No identity in workspace")
        return
      }
      
      const prompt = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt(
        "You are a coding assistant.",
        detected
      )
      
      expect(prompt).toContain("Gizzi")
      expect(prompt).toContain("# Workspace Identity")
      expect(prompt).toContain("# Base Identity")
      expect(prompt).toContain("# Agent Configuration")
      expect(prompt).toContain("coding assistant")
    })
  })

  describe("Agent Creation with Context", () => {
    it("should create agent config from workspace agent", async () => {
      // Create a mock workspace with gizzi-like agent
      const mockOpenclaw = path.join(testDir, "mock-openclaw")
      const agentsPath = path.join(mockOpenclaw, "workspace", "agents", "test-orchestrator")
      
      await mkdir(agentsPath, { recursive: true })
      
      // Create config
      await writeFile(
        path.join(agentsPath, "config.json"),
        JSON.stringify({
          name: "Test Orchestrator",
          purpose: "Test orchestration and coordination",
          permissions: {
            spawn_agents: true,
            delegate_work: true,
            retire_agents: false
          },
          authority_level: "high",
          core_functions: ["test", "coordinate"]
        })
      )
      
      // Create identity
      await mkdir(path.join(mockOpenclaw, "workspace", "docs"), { recursive: true })
      await writeFile(
        path.join(mockOpenclaw, "workspace", "docs", "IDENTITY.md"),
        "- **Name:** TestIdentity\n- **Creature:** Test AI\n"
      )
      
      const agents = await AgentWorkspaceBridge.getWorkspaceAgents(mockOpenclaw, "openclaw")
      expect(agents).toHaveLength(1)
      expect(agents[0].config.name).toBe("Test Orchestrator")
      
      // Verify the agent config structure
      const config = agents[0].config
      expect(config.permissions.spawn_agents).toBe(true)
      expect(config.authority_level).toBe("high")
    })
  })

  describe("Integration with Agent Loader", () => {
    it("should not double-enhance prompts", async () => {
      // Use real .openclaw if available
      const openclawPath = path.join(homeDir, ".openclaw")
      const exists = await fs.access(openclawPath).then(() => true).catch(() => false)
      
      if (!exists) {
        console.log("Skipping: No .openclaw found")
        return
      }
      
      // Get real workspace detection
      const detected = await AgentWorkspaceBridge.detectWorkspace(homeDir)
      if (!detected?.identity) {
        console.log("Skipping: No identity in workspace")
        return
      }
      
      const basePrompt = "You are a helpful assistant."
      
      // First enhancement
      const enhanced1 = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt(
        basePrompt,
        detected
      )
      
      // Should contain workspace context
      expect(enhanced1).toContain("# Workspace")
      expect(enhanced1).toContain(detected.identity.name)
      
      // Second enhancement (via loader) should detect already enhanced
      const enhanced2 = await AgentWorkspaceLoader.enhanceWithWorkspaceContext(
        "test-agent",
        enhanced1
      )
      
      // Should be same (no double enhance)
      expect(enhanced2).toBe(enhanced1)
    })
  })
})
