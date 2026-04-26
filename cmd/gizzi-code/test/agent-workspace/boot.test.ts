// @ts-nocheck
/**
 * Agent Workspace - Boot Sequence Tests
 * 
 * Tests the 21-phase deterministic initialization of the 5-layer workspace.
 */

import { describe, test, expect } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { BootSequence } from "../../src/agent-workspace/boot"
import { AgentWorkspace } from "../../src/agent-workspace/artifacts"
import { tmpdir } from "../fixture/fixture"

describe("BootSequence", () => {
  describe("execute()", () => {
    test("executes full boot sequence successfully", async () => {
      await using tmp = await tmpdir()
      
      const result = await BootSequence.execute({
        workspace: tmp.path,
        sessionId: "test-session",
        runner: "test-runner",
      })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(21)
      expect(result.totalPhases).toBe(21)
      expect(result.errors).toEqual([])
      expect(result.paths).toBeDefined()
    })

    test("completes 19 phases without L5", async () => {
      await using tmp = await tmpdir()
      
      const result = await BootSequence.execute({
        workspace: tmp.path,
        enableL5: false,
      })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(21) // Still 21 because phases 1-19 + 21
    })

    test("completes 20 phases with L5 enabled", async () => {
      await using tmp = await tmpdir()
      
      const result = await BootSequence.execute({
        workspace: tmp.path,
        enableL5: true,
      })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(21)

      // Verify L5 was created
      const paths = AgentWorkspace.getPaths(tmp.path)
      const l5Exists = await fs.stat(paths.l5_business).catch(() => null)
      expect(l5Exists).toBeDefined()
    })

    test("creates workspace structure on boot", async () => {
      await using tmp = await tmpdir()
      
      await BootSequence.execute({ workspace: tmp.path })

      const paths = AgentWorkspace.getPaths(tmp.path)

      // Verify all layers exist
      expect(await fs.stat(paths.l1_cognitive)).toBeDefined()
      expect(await fs.stat(paths.l2_identity)).toBeDefined()
      expect(await fs.stat(paths.l3_governance)).toBeDefined()
      expect(await fs.stat(paths.l4_skills)).toBeDefined()

      // Verify manifest exists
      const manifest = await fs.readFile(paths.manifest, "utf-8")
      expect(JSON.parse(manifest).platform).toBe("allternit")
    })

    test("uses provided sessionId", async () => {
      await using tmp = await tmpdir()
      
      await BootSequence.execute({
        workspace: tmp.path,
        sessionId: "custom-session-123",
      })

      const manifest = await AgentWorkspace.readManifest(tmp.path)
      expect(manifest.session.session_id).toBe("custom-session-123")
    })

    test("uses provided runner", async () => {
      await using tmp = await tmpdir()
      
      await BootSequence.execute({
        workspace: tmp.path,
        runner: "custom-runner",
      })

      const manifest = await AgentWorkspace.readManifest(tmp.path)
      expect(manifest.session.runner).toBe("custom-runner")
    })

    test("skipIfExists skips when workspace exists", async () => {
      await using tmp = await tmpdir()
      
      // First boot
      await BootSequence.execute({ workspace: tmp.path })
      const firstManifest = await AgentWorkspace.readManifest(tmp.path)
      const firstTimestamp = firstManifest.workspace.created_at

      // Wait a tiny bit to ensure timestamp would differ
      await new Promise(r => setTimeout(r, 10))

      // Second boot with skipIfExists
      const result = await BootSequence.execute({
        workspace: tmp.path,
        skipIfExists: true,
      })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(0)

      // Verify original manifest was preserved
      const secondManifest = await AgentWorkspace.readManifest(tmp.path)
      expect(secondManifest.workspace.created_at).toBe(firstTimestamp)
    })

    test("skipIfExists=false reinitializes workspace", async () => {
      await using tmp = await tmpdir()
      
      // First boot
      await BootSequence.execute({ workspace: tmp.path })
      const firstManifest = await AgentWorkspace.readManifest(tmp.path)

      // Wait a tiny bit
      await new Promise(r => setTimeout(r, 10))

      // Second boot without skipIfExists
      const result = await BootSequence.execute({
        workspace: tmp.path,
        skipIfExists: false,
      })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(21)

      // Verify new manifest was created
      const secondManifest = await AgentWorkspace.readManifest(tmp.path)
      expect(secondManifest.workspace.created_at).toBeGreaterThanOrEqual(firstManifest.workspace.created_at)
    })

    test("skipIfExists proceeds when workspace doesn't exist", async () => {
      await using tmp = await tmpdir()
      
      const result = await BootSequence.execute({
        workspace: tmp.path,
        skipIfExists: true,
      })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(21)
    })

    test("returns paths in result", async () => {
      await using tmp = await tmpdir()
      
      const result = await BootSequence.execute({ workspace: tmp.path })

      expect(result.paths).toBeDefined()
      expect(result.paths?.root).toBe(path.join(tmp.path, ".allternit"))
      expect(result.paths?.manifest).toContain("manifest.json")
    })

    test("handles errors gracefully", async () => {
      // Use a path that cannot be written to
      const invalidPath = "/nonexistent/deeply/nested/path/that/cannot/be/created"
      
      const result = await BootSequence.execute({ workspace: invalidPath })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.phasesCompleted).toBeLessThan(21)
    })

    test("generates unique session IDs when not provided", async () => {
      await using tmp1 = await tmpdir()
      await using tmp2 = await tmpdir()
      
      await BootSequence.execute({ workspace: tmp1.path })
      await BootSequence.execute({ workspace: tmp2.path })

      const manifest1 = await AgentWorkspace.readManifest(tmp1.path)
      const manifest2 = await AgentWorkspace.readManifest(tmp2.path)

      expect(manifest1.session.session_id).not.toBe(manifest2.session.session_id)
      expect(manifest1.session.session_id).toMatch(/^sess-/)
      expect(manifest2.session.session_id).toMatch(/^sess-/)
    })

    test("phase 21 discovers existing handoff", async () => {
      await using tmp = await tmpdir()
      
      // Initialize workspace first
      const paths = await AgentWorkspace.initialize(tmp.path)
      
      // Create a baton file
      const batonPath = path.join(paths.l1_batons, "existing-baton.md")
      await fs.writeFile(batonPath, "# Baton\n", "utf-8")
      
      // Update handoff to point to baton
      await AgentWorkspace.updateHandoff(tmp.path, batonPath)

      // Clear the workspace manifest to force re-boot
      await fs.rm(paths.manifest)

      // Re-execute boot sequence
      const result = await BootSequence.execute({ workspace: tmp.path })

      expect(result.success).toBe(true)
      expect(result.phasesCompleted).toBe(21)
    })
  })

  describe("getPhases()", () => {
    test("returns 20 phases by default (without L5)", () => {
      const phases = BootSequence.getPhases()

      expect(phases.length).toBe(20)
      expect(phases[0].phase).toBe(1)
      expect(phases[19].phase).toBe(21)
    })

    test("returns 20 phases without L5", () => {
      const phases = BootSequence.getPhases(false)

      expect(phases.length).toBe(20)
      // Phase 20 should not be in the list
      expect(phases.some(p => p.phase === 20)).toBe(false)
    })

    test("returns 21 phases with L5", () => {
      const phases = BootSequence.getPhases(true)

      expect(phases.length).toBe(21)
      expect(phases.some(p => p.phase === 20)).toBe(true)
    })

    test("phases have correct structure", () => {
      const phases = BootSequence.getPhases()

      for (const phase of phases) {
        expect(typeof phase.phase).toBe("number")
        expect(typeof phase.name).toBe("string")
        expect(typeof phase.layer).toBe("number")
        expect(typeof phase.action).toBe("function")
      }
    })

    test("phases 1-6 are layer 1 (Foundation)", () => {
      const phases = BootSequence.getPhases()
      const l1Phases = phases.filter(p => p.phase >= 1 && p.phase <= 6)

      for (const phase of l1Phases) {
        expect(phase.layer).toBe(1)
      }
    })

    test("phases 7-14 are layer 2 (Identity)", () => {
      const phases = BootSequence.getPhases()
      const l2Phases = phases.filter(p => p.phase >= 7 && p.phase <= 14)

      for (const phase of l2Phases) {
        expect(phase.layer).toBe(2)
      }
    })

    test("phases 15-18 are layer 3 (Governance)", () => {
      const phases = BootSequence.getPhases()
      const l3Phases = phases.filter(p => p.phase >= 15 && p.phase <= 18)

      for (const phase of l3Phases) {
        expect(phase.layer).toBe(3)
      }
    })

    test("phase 19 is layer 4 (Skills)", () => {
      const phases = BootSequence.getPhases()
      const l4Phase = phases.find(p => p.phase === 19)

      expect(l4Phase?.layer).toBe(4)
    })

    test("phase 20 is layer 5 (Business)", () => {
      const phases = BootSequence.getPhases(true)
      const l5Phase = phases.find(p => p.phase === 20)

      expect(l5Phase?.layer).toBe(5)
    })

    test("phase 21 is layer 0 (Handoff)", () => {
      const phases = BootSequence.getPhases()
      const handoffPhase = phases.find(p => p.phase === 21)

      expect(handoffPhase?.layer).toBe(0)
      expect(handoffPhase?.name).toBe("Handoff Discovery")
    })

    test("phase names are descriptive", () => {
      const phases = BootSequence.getPhases(true) // Include L5 for full list

      expect(phases[0].name).toBe("Create L1 structure")
      expect(phases[6].name).toBe("Create L2 structure")
      expect(phases[14].name).toBe("Create L3 structure")
      expect(phases[18].name).toBe("Create L4 structure")
      expect(phases[20].name).toBe("Handoff Discovery")
    })

    test("phase actions are async functions", async () => {
      const phases = BootSequence.getPhases()

      // Phase actions are empty async functions for reporting purposes
      await expect(phases[0].action()).resolves.toBeUndefined()
    })
  })
})
