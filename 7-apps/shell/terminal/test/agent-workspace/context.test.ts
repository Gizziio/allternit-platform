/**
 * Agent Workspace - Context Pack Builder Tests
 * 
 * Tests the context pack builder for LLM consumption.
 */

import { describe, test, expect } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { ContextPackBuilder } from "../../src/agent-workspace/context"
import { AgentWorkspace } from "../../src/agent-workspace/artifacts"
import { tmpdir } from "../fixture/fixture"

describe("ContextPackBuilder", () => {
  describe("build()", () => {
    test("builds context pack from initialized workspace", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path, { sessionId: "test-session" })

      const pack = await ContextPackBuilder.build(tmp.path)

      expect(pack.version).toBe("1.0.0")
      expect(pack.workspace).toBe(tmp.path)
      expect(pack.sessionId).toBe("test-session")
      expect(pack.layers.length).toBeGreaterThan(0)
      expect(typeof pack.totalTokens).toBe("number")
      expect(typeof pack.checksum).toBe("string")
      expect(pack.checksum.length).toBe(16)
    })

    test("includes L1, L2, L3, L4 by default", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const layerNumbers = pack.layers.map(l => l.layer)

      expect(layerNumbers).toContain(1)
      expect(layerNumbers).toContain(2)
      expect(layerNumbers).toContain(3)
      expect(layerNumbers).toContain(4)
    })

    test("excludes L5 by default", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path, { enableL5: true })

      const pack = await ContextPackBuilder.build(tmp.path)
      const layerNumbers = pack.layers.map(l => l.layer)

      expect(layerNumbers).not.toContain(5)
    })

    test("includes L5 when specified in options", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path, { enableL5: true })

      const pack = await ContextPackBuilder.build(tmp.path, { includeLayers: [1, 2, 3, 4, 5] })
      const layerNumbers = pack.layers.map(l => l.layer)

      expect(layerNumbers).toContain(5)
    })

    test("filters layers based on includeLayers option", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path, { includeLayers: [1, 2] })
      const layerNumbers = pack.layers.map(l => l.layer)

      expect(layerNumbers).toEqual([1, 2])
    })

    test("layers have correct names", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)

      const l1 = pack.layers.find(l => l.layer === 1)
      expect(l1?.name).toBe("Cognitive")

      const l2 = pack.layers.find(l => l.layer === 2)
      expect(l2?.name).toBe("Identity")

      const l3 = pack.layers.find(l => l.layer === 3)
      expect(l3?.name).toBe("Governance")

      const l4 = pack.layers.find(l => l.layer === 4)
      expect(l4?.name).toBe("Skills")
    })

    test("includes files in each layer", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)

      for (const layer of pack.layers) {
        expect(layer.files.length).toBeGreaterThan(0)
        for (const file of layer.files) {
          expect(typeof file.path).toBe("string")
          expect(typeof file.content).toBe("string")
          expect(typeof file.priority).toBe("number")
        }
      }
    })

    test("L1 contains BRAIN.md and MEMORY.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l1 = pack.layers.find(l => l.layer === 1)

      const brainFile = l1?.files.find(f => f.path.includes("BRAIN.md"))
      expect(brainFile).toBeDefined()
      expect(brainFile?.content).toContain("A2R Brain")

      const memoryFile = l1?.files.find(f => f.path.includes("MEMORY.md"))
      expect(memoryFile).toBeDefined()
      expect(memoryFile?.content).toContain("A2R Memory Index")
    })

    test("L2 contains IDENTITY.md and POLICY.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l2 = pack.layers.find(l => l.layer === 2)

      const identityFile = l2?.files.find(f => f.path.includes("IDENTITY.md"))
      expect(identityFile).toBeDefined()
      expect(identityFile?.content).toContain("Agent Identity")

      const policyFile = l2?.files.find(f => f.path.includes("POLICY.md"))
      expect(policyFile).toBeDefined()
      expect(policyFile?.content).toContain("Base Policy")
    })

    test("L3 contains PLAYBOOK.md and TOOLS.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l3 = pack.layers.find(l => l.layer === 3)

      const playbookFile = l3?.files.find(f => f.path.includes("PLAYBOOK.md"))
      expect(playbookFile).toBeDefined()
      expect(playbookFile?.content).toContain("Operating Playbook")

      const toolsFile = l3?.files.find(f => f.path.includes("TOOLS.md"))
      expect(toolsFile).toBeDefined()
      expect(toolsFile?.content).toContain("Tool Definitions")
    })

    test("L4 contains INDEX.md", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l4 = pack.layers.find(l => l.layer === 4)

      const indexFile = l4?.files.find(f => f.path.includes("INDEX.md"))
      expect(indexFile).toBeDefined()
      expect(indexFile?.content).toContain("Skill Registry")
    })

    test("files are sorted by priority (highest first)", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)

      for (const layer of pack.layers) {
        for (let i = 1; i < layer.files.length; i++) {
          expect(layer.files[i - 1].priority).toBeGreaterThanOrEqual(layer.files[i].priority)
        }
      }
    })

    test("calculates token estimate", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)

      // Token estimate should be roughly content length / 4
      expect(pack.totalTokens).toBeGreaterThan(0)

      // Calculate expected tokens
      let totalChars = 0
      for (const layer of pack.layers) {
        for (const file of layer.files) {
          totalChars += file.content.length
        }
      }
      const expectedTokens = Math.ceil(totalChars / 4)
      expect(pack.totalTokens).toBe(expectedTokens)
    })

    test("generates consistent checksum for same content", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack1 = await ContextPackBuilder.build(tmp.path)
      const pack2 = await ContextPackBuilder.build(tmp.path)

      expect(pack1.checksum).toBe(pack2.checksum)
    })

    test("generates different checksum for different content", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack1 = await ContextPackBuilder.build(tmp.path)

      // Modify a file
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l1_brain_md, "# Modified Brain\n", "utf-8")

      const pack2 = await ContextPackBuilder.build(tmp.path)

      expect(pack1.checksum).not.toBe(pack2.checksum)
    })

    test("throws error for non-existent workspace", async () => {
      await using tmp = await tmpdir()
      // Don't initialize workspace

      await expect(ContextPackBuilder.build(tmp.path)).rejects.toThrow()
    })

    test("respects maxTokens option (future feature)", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // This test documents expected behavior - currently no filtering is implemented
      const pack = await ContextPackBuilder.build(tmp.path, { maxTokens: 1000 })

      // Should still build successfully
      expect(pack.layers.length).toBeGreaterThan(0)
    })

    test("handles custom file content", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Add custom content
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(
        paths.l2_conventions_md,
        "# Custom Conventions\n\n- Use TypeScript\n- Write tests\n",
        "utf-8"
      )

      const pack = await ContextPackBuilder.build(tmp.path)
      const l2 = pack.layers.find(l => l.layer === 2)
      const conventionsFile = l2?.files.find(f => f.path.includes("CONVENTIONS.md"))

      expect(conventionsFile?.content).toContain("Custom Conventions")
      expect(conventionsFile?.content).toContain("Use TypeScript")
    })
  })

  describe("formatForLLM()", () => {
    test("formats context pack as markdown", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path, { sessionId: "test-session" })

      const pack = await ContextPackBuilder.build(tmp.path)
      const formatted = ContextPackBuilder.formatForLLM(pack)

      expect(formatted).toContain("# A2R Context Pack")
      expect(formatted).toContain(`**Workspace:** ${tmp.path}`)
      expect(formatted).toContain("**Session:** test-session")
      expect(formatted).toContain(`**Checksum:** ${pack.checksum}`)
    })

    test("includes all layers in formatted output", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const formatted = ContextPackBuilder.formatForLLM(pack)

      for (const layer of pack.layers) {
        expect(formatted).toContain(`# Layer ${layer.layer}: ${layer.name}`)
      }
    })

    test("includes all files in formatted output", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const formatted = ContextPackBuilder.formatForLLM(pack)

      for (const layer of pack.layers) {
        for (const file of layer.files) {
          expect(formatted).toContain(`## ${file.path}`)
          expect(formatted).toContain(file.content)
        }
      }
    })

    test("uses horizontal rules between layers", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const formatted = ContextPackBuilder.formatForLLM(pack)

      expect(formatted).toContain("---")
    })

    test("produces deterministic output for same pack", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const formatted1 = ContextPackBuilder.formatForLLM(pack)
      const formatted2 = ContextPackBuilder.formatForLLM(pack)

      expect(formatted1).toBe(formatted2)
    })

    test("formats different packs differently", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack1 = await ContextPackBuilder.build(tmp.path)

      // Modify content
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l1_brain_md, "# Modified Brain\n", "utf-8")

      const pack2 = await ContextPackBuilder.build(tmp.path)
      const formatted1 = ContextPackBuilder.formatForLLM(pack1)
      const formatted2 = ContextPackBuilder.formatForLLM(pack2)

      expect(formatted1).not.toBe(formatted2)
    })
  })

  describe("loadBrain()", () => {
    test("returns BRAIN.md content", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const content = await ContextPackBuilder.loadBrain(tmp.path)

      expect(content).not.toBeNull()
      expect(content).toContain("A2R Brain")
      expect(content).toContain("Task Graph")
    })

    test("returns null when BRAIN.md doesn't exist", async () => {
      await using tmp = await tmpdir()
      // Don't initialize workspace

      const content = await ContextPackBuilder.loadBrain(tmp.path)

      expect(content).toBeNull()
    })

    test("returns updated content after modification", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(paths.l1_brain_md, "# Updated Brain Content\n", "utf-8")

      const content = await ContextPackBuilder.loadBrain(tmp.path)

      expect(content).toBe("# Updated Brain Content\n")
    })
  })

  describe("loadConventions()", () => {
    test("returns CONVENTIONS.md content", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const content = await ContextPackBuilder.loadConventions(tmp.path)

      expect(content).not.toBeNull()
      expect(content).toContain("Project Conventions")
    })

    test("returns null when CONVENTIONS.md doesn't exist", async () => {
      await using tmp = await tmpdir()
      // Don't initialize workspace

      const content = await ContextPackBuilder.loadConventions(tmp.path)

      expect(content).toBeNull()
    })

    test("returns updated content after modification", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(
        paths.l2_conventions_md,
        "# New Conventions\n\n- Convention 1\n- Convention 2\n",
        "utf-8"
      )

      const content = await ContextPackBuilder.loadConventions(tmp.path)

      expect(content).toContain("New Conventions")
      expect(content).toContain("Convention 1")
    })
  })

  describe("file priorities", () => {
    test("BRAIN.md has highest priority", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l1 = pack.layers.find(l => l.layer === 1)
      const brainFile = l1?.files.find(f => f.path.includes("BRAIN.md"))

      expect(brainFile?.priority).toBe(100)
    })

    test("HEARTBEAT.md has high priority", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l3 = pack.layers.find(l => l.layer === 3)
      const heartbeatFile = l3?.files.find(f => f.path.includes("HEARTBEAT.md"))

      expect(heartbeatFile?.priority).toBe(90)
    })

    test("IDENTITY.md has medium-high priority", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l2 = pack.layers.find(l => l.layer === 2)
      const identityFile = l2?.files.find(f => f.path.includes("IDENTITY.md"))

      expect(identityFile?.priority).toBe(80)
    })

    test("POLICY.md has medium priority", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      const pack = await ContextPackBuilder.build(tmp.path)
      const l2 = pack.layers.find(l => l.layer === 2)
      const policyFile = l2?.files.find(f => f.path.includes("POLICY.md"))

      expect(policyFile?.priority).toBe(70)
    })

    test("unknown files have default low priority", async () => {
      await using tmp = await tmpdir()
      await AgentWorkspace.initialize(tmp.path)

      // Add unknown file
      const paths = AgentWorkspace.getPaths(tmp.path)
      await fs.writeFile(
        path.join(paths.l1_cognitive, "UNKNOWN.md"),
        "# Unknown\n",
        "utf-8"
      )

      const pack = await ContextPackBuilder.build(tmp.path)
      const l1 = pack.layers.find(l => l.layer === 1)
      const unknownFile = l1?.files.find(f => f.path.includes("UNKNOWN.md"))

      expect(unknownFile?.priority).toBe(5)
    })
  })
})
