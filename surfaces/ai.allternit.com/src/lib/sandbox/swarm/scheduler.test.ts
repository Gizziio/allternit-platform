/**
 * Tests for SwarmScheduler
 * Verifies batching, cleanup guarantees, and the concurrency cap against a
 * mock SwarmProvider — no real E2B calls are made here.
 */

import { describe, it, expect } from "vitest";

import { SwarmScheduler, DEFAULT_CONCURRENCY } from "./scheduler";

import type {
  SwarmBatchCreateResult,
  SwarmBatchDestroyResult,
  SwarmProvider,
  SwarmUnit,
  SwarmUnitRunFn,
  SwarmUnitRunResult,
  SwarmUnitSpec,
} from "./types";

let unitCounter = 0;
function makeUnit(spec: SwarmUnitSpec): SwarmUnit {
  unitCounter += 1;
  return {
    id: `unit-${unitCounter}`,
    status: "ready",
    createdAt: Date.now(),
    metadata: spec.metadata ?? {},
  };
}

/**
 * Mock SwarmProvider that never touches E2B. Records the size of every
 * batch it's called with (so tests can assert the scheduler's concurrency
 * cap is respected) and can be configured to fail specific specs or unit
 * IDs (so tests can exercise partial-failure handling).
 */
class MockSwarmProvider implements SwarmProvider {
  createBatchSizes: number[] = [];
  destroyBatchSizes: number[] = [];
  failSpecs = new Set<SwarmUnitSpec>();
  failUnitIds = new Set<string>();

  async createBatch(specs: SwarmUnitSpec[]): Promise<SwarmBatchCreateResult> {
    this.createBatchSizes.push(specs.length);
    const units: SwarmUnit[] = [];
    const failures: SwarmBatchCreateResult["failures"] = [];
    for (const spec of specs) {
      if (this.failSpecs.has(spec)) {
        failures.push({ spec, error: "mock creation failure" });
      } else {
        units.push(makeUnit(spec));
      }
    }
    return { units, failures };
  }

  async runBatch<T>(
    units: SwarmUnit[],
    fn: SwarmUnitRunFn<T>
  ): Promise<SwarmUnitRunResult<T>[]> {
    return Promise.all(
      units.map(async (unit): Promise<SwarmUnitRunResult<T>> => {
        try {
          const value = await fn(unit);
          return { unitId: unit.id, status: "fulfilled", value };
        } catch (error) {
          return { unitId: unit.id, status: "rejected", error: String(error) };
        }
      })
    );
  }

  async destroyBatch(unitIds: string[]): Promise<SwarmBatchDestroyResult> {
    this.destroyBatchSizes.push(unitIds.length);
    const destroyed: string[] = [];
    const failures: SwarmBatchDestroyResult["failures"] = [];
    for (const unitId of unitIds) {
      if (this.failUnitIds.has(unitId)) {
        failures.push({ unitId, error: "mock destroy failure" });
      } else {
        destroyed.push(unitId);
      }
    }
    return { destroyed, failures };
  }

  async status(unitId: string): Promise<SwarmUnit> {
    return { id: unitId, status: "ready", createdAt: Date.now(), metadata: {} };
  }
}

describe("SwarmScheduler", () => {
  describe("batch create", () => {
    it("creates all requested units and tracks them", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider, { concurrency: 5 });

      const specs: SwarmUnitSpec[] = Array.from({ length: 12 }, () => ({}));
      const { units, failures } = await scheduler.createBatch(specs);

      expect(units).toHaveLength(12);
      expect(failures).toHaveLength(0);
      expect(scheduler.trackedCount).toBe(12);
      expect(scheduler.trackedUnitIds().sort()).toEqual(units.map((u) => u.id).sort());
    });

    it("returns an empty result for an empty request without calling the provider", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider);

      const result = await scheduler.createBatch([]);

      expect(result).toEqual({ units: [], failures: [] });
      expect(provider.createBatchSizes).toHaveLength(0);
    });
  });

  describe("batch destroy", () => {
    it("destroys requested units and untracks them", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider, { concurrency: 5 });

      const { units } = await scheduler.createBatch(Array.from({ length: 6 }, () => ({})));
      const { destroyed, failures } = await scheduler.destroyBatch(units.map((u) => u.id));

      expect(destroyed).toHaveLength(6);
      expect(failures).toHaveLength(0);
      expect(scheduler.trackedCount).toBe(0);
    });

    it("destroyAll tears down everything currently tracked", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider, { concurrency: 5 });

      await scheduler.createBatch(Array.from({ length: 4 }, () => ({})));
      const { destroyed } = await scheduler.destroyAll();

      expect(destroyed).toHaveLength(4);
      expect(scheduler.trackedCount).toBe(0);
    });
  });

  describe("partial-failure cleanup", () => {
    it("keeps units from a partially-failed create batch trackable and destroyable", async () => {
      const provider = new MockSwarmProvider();
      const specs: SwarmUnitSpec[] = Array.from({ length: 4 }, () => ({}));
      provider.failSpecs.add(specs[1]);
      provider.failSpecs.add(specs[3]);

      const scheduler = new SwarmScheduler(provider, { concurrency: 10 });
      const { units, failures } = await scheduler.createBatch(specs);

      expect(units).toHaveLength(2);
      expect(failures).toHaveLength(2);
      // The successfully created units are not silently dropped — they're
      // tracked and can still be destroyed even though the batch as a whole
      // partially failed.
      expect(scheduler.trackedCount).toBe(2);

      const { destroyed, failures: destroyFailures } = await scheduler.destroyAll();
      expect(destroyed.sort()).toEqual(units.map((u) => u.id).sort());
      expect(destroyFailures).toHaveLength(0);
      expect(scheduler.trackedCount).toBe(0);
    });

    it("keeps a unit tracked if its destroy call fails, so it can be retried", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider, { concurrency: 10 });

      const { units } = await scheduler.createBatch(Array.from({ length: 3 }, () => ({})));
      const flaky = units[0].id;
      provider.failUnitIds.add(flaky);

      const first = await scheduler.destroyBatch(units.map((u) => u.id));
      expect(first.destroyed).toHaveLength(2);
      expect(first.failures).toEqual([{ unitId: flaky, error: "mock destroy failure" }]);
      // Not silently forgotten — still tracked so it can be leak-checked or retried.
      expect(scheduler.trackedUnitIds()).toEqual([flaky]);

      provider.failUnitIds.delete(flaky);
      const second = await scheduler.destroyBatch([flaky]);
      expect(second.destroyed).toEqual([flaky]);
      expect(scheduler.trackedCount).toBe(0);
    });

    it("keeps creating later groups after an earlier group's provider call throws entirely", async () => {
      const provider = new MockSwarmProvider();
      const originalCreateBatch = provider.createBatch.bind(provider);
      let callCount = 0;
      provider.createBatch = async (specs: SwarmUnitSpec[]) => {
        callCount += 1;
        if (callCount === 1) {
          throw new Error("provider unavailable");
        }
        return originalCreateBatch(specs);
      };

      const scheduler = new SwarmScheduler(provider, { concurrency: 2 });
      const { units, failures } = await scheduler.createBatch(
        Array.from({ length: 4 }, () => ({}))
      );

      // First group of 2 hard-failed at the provider boundary, second group
      // of 2 succeeded — a whole-group throw doesn't stop later groups.
      expect(units).toHaveLength(2);
      expect(failures).toHaveLength(2);
      expect(scheduler.trackedCount).toBe(2);
    });
  });

  describe("concurrency cap", () => {
    it("never sends the provider a create batch larger than the configured cap", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider, { concurrency: 3 });

      await scheduler.createBatch(Array.from({ length: 10 }, () => ({})));

      expect(provider.createBatchSizes.every((size) => size <= 3)).toBe(true);
      expect(provider.createBatchSizes).toEqual([3, 3, 3, 1]);
    });

    it("never sends the provider a destroy batch larger than the configured cap", async () => {
      const provider = new MockSwarmProvider();
      const scheduler = new SwarmScheduler(provider, { concurrency: 4 });

      const { units } = await scheduler.createBatch(Array.from({ length: 9 }, () => ({})));
      await scheduler.destroyBatch(units.map((u) => u.id));

      expect(provider.destroyBatchSizes.every((size) => size <= 4)).toBe(true);
      expect(provider.destroyBatchSizes).toEqual([4, 4, 1]);
    });

    it("uses a sane positive default concurrency when none is configured", () => {
      expect(DEFAULT_CONCURRENCY).toBeGreaterThan(0);
      const provider = new MockSwarmProvider();
      expect(() => new SwarmScheduler(provider)).not.toThrow();
    });

    it("rejects a concurrency less than 1", () => {
      const provider = new MockSwarmProvider();
      expect(() => new SwarmScheduler(provider, { concurrency: 0 })).toThrow();
    });
  });
});
