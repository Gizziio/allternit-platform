import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { GIZZIBrand, GIZZICopy, Bus, Workspace, Verification } from "../src/index"
import { WorkspaceInitialized, SessionStarted } from "../src/bus/events"
import * as fs from "node:fs/promises"

describe("GIZZI Core", () => {
  describe("Brand", () => {
    it("should have correct product name", () => {
      expect(GIZZIBrand.product).toBe("GIZZI Code")
      expect(GIZZIBrand.command).toBe("gizzi-code")
    })

    it("should have copy strings", () => {
      expect(GIZZICopy.sidebar.onboardingTitle).toBe("Kernel ready")
    })
  })

  describe("Bus", () => {
    it("should publish and subscribe to events", async () => {
      let received = false
      
      const unsub = Bus.subscribe(WorkspaceInitialized, (event) => {
        received = true
        expect(event.properties.path).toBe("/tmp/test")
      })

      await Bus.publish(WorkspaceInitialized, { path: "/tmp/test", name: "test" })
      
      expect(received).toBe(true)
      unsub()
    })

    it("should support wildcard subscriptions", async () => {
      const events: string[] = []
      
      const unsub = Bus.subscribeAll((event) => {
        events.push(event.type)
      })

      await Bus.publish(SessionStarted, { sessionId: "abc", workspace: "/tmp" })
      
      expect(events).toContain("session.started")
      unsub()
    })
  })

  describe("Workspace", () => {
    const testPath = "/tmp/gizzi-test-" + Date.now()

    it("should initialize workspace with correct files", async () => {
      await Workspace.init(testPath, {
        name: "TestGizzi",
        emoji: "🧪",
        vibe: "Testing vibes",
      })

      const files = await Workspace.listFiles(testPath)
      expect(files).toContain("IDENTITY.md")
      expect(files).toContain("SOUL.md")
      expect(files).toContain("USER.md")
      expect(files).toContain("MEMORY.md")
      expect(files).toContain("AGENTS.md")
    })

    it("should read workspace files", async () => {
      const identity = await Workspace.readFile(testPath, "IDENTITY.md")
      expect(identity).toContain("TestGizzi")
      expect(identity).toContain("🧪")
    })
  })

  describe("Verification", () => {
    it("should have verification module", () => {
      expect(Verification).toBeDefined()
      expect(typeof Verification.empirical).toBe("function")
      expect(typeof Verification.semiFormal).toBe("function")
    })
  })
})
