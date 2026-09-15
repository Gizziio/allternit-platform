import { describe, it, expect, vi } from "vitest"
import { AnimationDriver } from "@/cli/ui/components/animation/driver"
import { AnimationRegistry } from "@/cli/ui/components/animation/registry"
import type { AnimationDriverConfig } from "@/cli/ui/components/animation/types"

describe("AnimationDriver", () => {
  function createTestDriver(tick: bigint, enabled = true, onMetric?: any) {
    const registry = new AnimationRegistry()
    registry.register({
      id: "test.loop",
      frames: ["A", "B", "C", "D"],
      intervalTicks: 2,
      mode: "loop",
    })
    registry.register({
      id: "test.once",
      frames: ["1", "2", "3"],
      intervalTicks: 1,
      mode: "once",
    })
    registry.register({
      id: "test.pingpong",
      frames: ["a", "b", "c", "d"],
      intervalTicks: 1,
      mode: "pingpong",
    })

    const config: AnimationDriverConfig = {
      getTick: () => tick,
      animationsEnabled: () => enabled,
      onMetric,
    }

    return new AnimationDriver(registry, config)
  }

  describe("determinism", () => {
    it("returns same frame for same tick", () => {
      const driver = createTestDriver(10n)
      const f1 = driver.frame("test.loop")
      const f2 = driver.frame("test.loop")
      expect(f1).toBe(f2)
    })

    it("advances frame on tick change", () => {
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["A", "B"],
        intervalTicks: 1,
        mode: "loop",
      })

      const driver1 = new AnimationDriver(registry, {
        getTick: () => 0n,
        animationsEnabled: () => true,
      })
      const driver2 = new AnimationDriver(registry, {
        getTick: () => 1n,
        animationsEnabled: () => true,
      })

      expect(driver1.frame("test")).not.toBe(driver2.frame("test"))
    })
  })

  describe("loop mode", () => {
    it("cycles through frames", () => {
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["A", "B", "C"],
        intervalTicks: 1,
        mode: "loop",
      })

      const frames = []
      for (let i = 0n; i < 6n; i++) {
        const driver = new AnimationDriver(registry, {
          getTick: () => i,
          animationsEnabled: () => true,
        })
        frames.push(driver.frame("test"))
      }

      expect(frames).toEqual(["A", "B", "C", "A", "B", "C"])
    })
  })

  describe("once mode", () => {
    it("stops at last frame", () => {
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["1", "2", "3"],
        intervalTicks: 1,
        mode: "once",
      })

      const driver1 = new AnimationDriver(registry, {
        getTick: () => 0n,
        animationsEnabled: () => true,
      })
      const driver2 = new AnimationDriver(registry, {
        getTick: () => 5n,
        animationsEnabled: () => true,
      })

      expect(driver1.frame("test")).toBe("1")
      expect(driver2.frame("test")).toBe("3")
    })
  })

  describe("pingpong mode", () => {
    it("bounces back and forth", () => {
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["a", "b", "c", "d"],
        intervalTicks: 1,
        mode: "pingpong",
      })

      const frames = []
      for (let i = 0n; i < 8n; i++) {
        const driver = new AnimationDriver(registry, {
          getTick: () => i,
          animationsEnabled: () => true,
        })
        frames.push(driver.frame("test"))
      }

      // 0,1,2,3,2,1,0,1
      expect(frames).toEqual(["a", "b", "c", "d", "c", "b", "a", "b"])
    })
  })

  describe("intervalTicks", () => {
    it("advances every N ticks", () => {
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["A", "B"],
        intervalTicks: 3,
        mode: "loop",
      })

      const driver0 = new AnimationDriver(registry, {
        getTick: () => 0n,
        animationsEnabled: () => true,
      })
      const driver2 = new AnimationDriver(registry, {
        getTick: () => 2n,
        animationsEnabled: () => true,
      })
      const driver3 = new AnimationDriver(registry, {
        getTick: () => 3n,
        animationsEnabled: () => true,
      })

      expect(driver0.frame("test")).toBe("A")
      expect(driver2.frame("test")).toBe("A") // Still A at tick 2
      expect(driver3.frame("test")).toBe("B") // Advances at tick 3
    })
  })

  describe("animationsEnabled", () => {
    it("returns first frame when disabled", () => {
      const driver = createTestDriver(100n, false)
      const frame = driver.frame("test.loop")
      expect(frame).toBe("A")
    })

    it("ignores tick when disabled", () => {
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["A", "B", "C"],
        intervalTicks: 1,
        mode: "loop",
      })

      const driver = new AnimationDriver(registry, {
        getTick: () => 100n,
        animationsEnabled: () => false,
      })

      expect(driver.frame("test")).toBe("A") // Always first frame
    })
  })

  describe("stateToAnimationId", () => {
    it("maps runtime states correctly", () => {
      const driver = createTestDriver(0n)

      expect(driver.stateToAnimationId("idle")).toBe("status.idle")
      expect(driver.stateToAnimationId("connecting")).toBe("status.connecting")
      expect(driver.stateToAnimationId("executing")).toBe("status.executing")
      expect(driver.stateToAnimationId("compacting")).toBe("status.compacting")
    })

    it("defaults to idle for unknown states", () => {
      const driver = createTestDriver(0n)
      expect(driver.stateToAnimationId("unknown")).toBe("status.idle")
    })
  })

  describe("metrics", () => {
    it("emits metrics when enabled", () => {
      const onMetric = vi.fn()
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["A", "B"],
        intervalTicks: 1,
        mode: "loop",
      })

      const driver = new AnimationDriver(registry, {
        getTick: () => 10n,
        animationsEnabled: () => true,
        onMetric,
      })

      driver.frame("test")

      // Should emit eventually (throttled)
      expect(onMetric).toHaveBeenCalled()
      const call = onMetric.mock.calls[0][0]
      expect(call.type).toBe("frame_render")
      expect(call.animId).toBe("test")
      expect(call.tick).toBe(10n)
    })

    it("emits disabled metric when animations off", () => {
      const onMetric = vi.fn()
      const registry = new AnimationRegistry()
      registry.register({
        id: "test",
        frames: ["A", "B"],
        intervalTicks: 1,
        mode: "loop",
      })

      const driver = new AnimationDriver(registry, {
        getTick: () => 10n,
        animationsEnabled: () => false,
        onMetric,
      })

      driver.frame("test")

      expect(onMetric).toHaveBeenCalled()
      const call = onMetric.mock.calls[0][0]
      expect(call.type).toBe("animation_disabled")
    })
  })

  describe("procedural loaders", () => {
    describe("orbit_harness", () => {
      it("generates 12 character frames", () => {
        const registry = new AnimationRegistry()
        const driver = new AnimationDriver(registry, {
          getTick: () => 5n,
          animationsEnabled: () => true,
        })

        const frame = driver.frameProcedural("gizzi.orbit_harness", {
          phase: "executing",
          severity: "high",
        })

        expect(frame.length).toBe(12)
      })

      it("changes with tick", () => {
        const registry = new AnimationRegistry()
        
        const driver1 = new AnimationDriver(registry, {
          getTick: () => 0n,
          animationsEnabled: () => true,
        })
        const driver2 = new AnimationDriver(registry, {
          getTick: () => 5n,
          animationsEnabled: () => true,
        })

        const f1 = driver1.frameProcedural("gizzi.orbit_harness", {})
        const f2 = driver2.frameProcedural("gizzi.orbit_harness", {})

        expect(f1).not.toBe(f2)
      })
    })

    describe("rails_scan", () => {
      it("generates 14 character frames", () => {
        const registry = new AnimationRegistry()
        const driver = new AnimationDriver(registry, {
          getTick: () => 0n,
          animationsEnabled: () => true,
        })

        const frame = driver.frameProcedural("gizzi.rails_scan", {})
        expect(frame.length).toBe(14)
        expect(frame.startsWith("╞")).toBe(true)
        expect(frame.endsWith("╡")).toBe(true)
      })
    })

    describe("dag_pulse", () => {
      it("generates bounded width frames", () => {
        const registry = new AnimationRegistry()
        const driver = new AnimationDriver(registry, {
          getTick: () => 0n,
          animationsEnabled: () => true,
        })

        const frame = driver.frameProcedural("gizzi.dag_pulse", {})
        expect(frame.length).toBeLessThanOrEqual(12)
      })
    })
  })

  describe("error handling", () => {
    it("throws for unknown animation", () => {
      const registry = new AnimationRegistry()
      const driver = new AnimationDriver(registry, {
        getTick: () => 0n,
        animationsEnabled: () => true,
      })

      expect(() => driver.frame("unknown")).toThrow("Unknown animation id")
    })
  })
})
