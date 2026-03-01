import { describe, it, expect, beforeEach } from "vitest"
import { AnimationRegistry, createA2RRegistry } from "../registry"
import type { AnimSpec } from "../types"

describe("AnimationRegistry", () => {
  let registry: AnimationRegistry

  beforeEach(() => {
    registry = new AnimationRegistry()
  })

  describe("register", () => {
    it("registers valid animation", () => {
      const spec: AnimSpec = {
        id: "test.anim",
        frames: ["A", "B", "C"],
        intervalTicks: 2,
        mode: "loop",
      }

      registry.register(spec)
      expect(registry.has("test.anim")).toBe(true)
    })

    it("throws for missing id", () => {
      const spec = {
        id: "",
        frames: ["A"],
        intervalTicks: 1,
        mode: "loop",
      } as AnimSpec

      expect(() => registry.register(spec)).toThrow("must have an id")
    })

    it("throws for empty frames", () => {
      const spec: AnimSpec = {
        id: "test.empty",
        frames: [],
        intervalTicks: 1,
        mode: "loop",
      }

      expect(() => registry.register(spec)).toThrow("has no frames")
    })

    it("throws for invalid intervalTicks", () => {
      const spec: AnimSpec = {
        id: "test.interval",
        frames: ["A"],
        intervalTicks: 0,
        mode: "loop",
      }

      expect(() => registry.register(spec)).toThrow("intervalTicks must be > 0")
    })

    it("throws for duplicate id", () => {
      const spec: AnimSpec = {
        id: "test.dupe",
        frames: ["A"],
        intervalTicks: 1,
        mode: "loop",
      }

      registry.register(spec)
      expect(() => registry.register(spec)).toThrow("already registered")
    })
  })

  describe("get", () => {
    it("returns registered spec", () => {
      const spec: AnimSpec = {
        id: "test.get",
        frames: ["X", "Y"],
        intervalTicks: 1,
        mode: "pingpong",
      }

      registry.register(spec)
      const got = registry.get("test.get")

      expect(got.id).toBe("test.get")
      expect(got.frames).toEqual(["X", "Y"])
      expect(got.mode).toBe("pingpong")
    })

    it("throws for unknown id", () => {
      expect(() => registry.get("unknown")).toThrow("Unknown animation id")
    })
  })

  describe("has", () => {
    it("returns true for registered", () => {
      registry.register({
        id: "test.has",
        frames: ["A"],
        intervalTicks: 1,
        mode: "loop",
      })

      expect(registry.has("test.has")).toBe(true)
    })

    it("returns false for unregistered", () => {
      expect(registry.has("not.there")).toBe(false)
    })
  })

  describe("unregister", () => {
    it("removes registered animation", () => {
      registry.register({
        id: "test.remove",
        frames: ["A"],
        intervalTicks: 1,
        mode: "loop",
      })

      expect(registry.unregister("test.remove")).toBe(true)
      expect(registry.has("test.remove")).toBe(false)
    })

    it("returns false for unknown id", () => {
      expect(registry.unregister("unknown")).toBe(false)
    })
  })

  describe("list", () => {
    it("returns empty array when empty", () => {
      expect(registry.list()).toEqual([])
    })

    it("returns all registered ids", () => {
      registry.register({ id: "a", frames: ["A"], intervalTicks: 1, mode: "loop" })
      registry.register({ id: "b", frames: ["B"], intervalTicks: 1, mode: "loop" })
      registry.register({ id: "c", frames: ["C"], intervalTicks: 1, mode: "loop" })

      const ids = registry.list()
      expect(ids).toContain("a")
      expect(ids).toContain("b")
      expect(ids).toContain("c")
      expect(ids.length).toBe(3)
    })
  })

  describe("count", () => {
    it("returns zero when empty", () => {
      expect(registry.count()).toBe(0)
    })

    it("returns correct count", () => {
      registry.register({ id: "x", frames: ["X"], intervalTicks: 1, mode: "loop" })
      registry.register({ id: "y", frames: ["Y"], intervalTicks: 1, mode: "loop" })

      expect(registry.count()).toBe(2)
    })
  })

  describe("clear", () => {
    it("removes all animations", () => {
      registry.register({ id: "a", frames: ["A"], intervalTicks: 1, mode: "loop" })
      registry.register({ id: "b", frames: ["B"], intervalTicks: 1, mode: "loop" })

      registry.clear()

      expect(registry.count()).toBe(0)
      expect(registry.has("a")).toBe(false)
    })
  })
})

describe("createA2RRegistry", () => {
  it("creates registry with default animations", () => {
    const registry = createA2RRegistry()

    expect(registry.count()).toBeGreaterThan(0)
    expect(registry.has("status.connecting")).toBe(true)
    expect(registry.has("status.planning")).toBe(true)
    expect(registry.has("status.executing")).toBe(true)
    expect(registry.has("spinner.braille")).toBe(true)
    expect(registry.has("spinner.quadrant")).toBe(true)
  })

  it("has status.idle", () => {
    const registry = createA2RRegistry()
    expect(registry.has("status.idle")).toBe(true)

    const idle = registry.get("status.idle")
    expect(idle.frames).toEqual([">"])
  })

  it("has A2R signature loaders", () => {
    const registry = createA2RRegistry()

    expect(registry.has("a2r.orbit_harness.connecting")).toBe(true)
    expect(registry.has("a2r.orbit_harness.executing")).toBe(true)
    expect(registry.has("a2r.orbit_harness.completed")).toBe(true)
    expect(registry.has("a2r.rails_scan")).toBe(true)
  })

  it("has correct frame counts for status animations", () => {
    const registry = createA2RRegistry()

    expect(registry.get("status.connecting").frames.length).toBe(8)
    expect(registry.get("status.planning").frames.length).toBe(6)
    expect(registry.get("status.executing").frames.length).toBe(4)
    expect(registry.get("status.compacting").frames.length).toBe(8)
  })

  it("has correct interval ticks", () => {
    const registry = createA2RRegistry()

    expect(registry.get("status.connecting").intervalTicks).toBe(3)
    expect(registry.get("spinner.braille").intervalTicks).toBe(2)
    expect(registry.get("spinner.quadrant").intervalTicks).toBe(2)
  })

  it("has correct modes", () => {
    const registry = createA2RRegistry()

    expect(registry.get("status.connecting").mode).toBe("loop")
    expect(registry.get("a2r.orbit_harness.completed").mode).toBe("once")
    expect(registry.get("a2r.rails_scan").mode).toBe("pingpong")
  })
})
