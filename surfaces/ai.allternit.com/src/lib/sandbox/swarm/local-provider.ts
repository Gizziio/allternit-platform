/**
 * LocalSwarmProvider
 *
 * In-process SwarmProvider for work that doesn't need sandbox isolation.
 * A persona-conditioned LLM call plus a memory read/write has no arbitrary
 * code execution to isolate, so spinning up an E2B microVM per unit per
 * round would add pure latency for zero isolation benefit. A "unit" here is
 * a lightweight in-memory record; `createBatch`/`destroyBatch` are
 * synchronous bookkeeping, and `runBatch` fans work out with the same
 * bounded worker-pool discipline as `E2BSwarmProvider` (via the shared
 * `mapWithConcurrency` helper — nothing external to spin up or tear down).
 */

import { createModuleLogger } from '@/lib/logger';

import { mapWithConcurrency } from "./concurrency";
import { DEFAULT_CONCURRENCY } from "./scheduler";
import type {
  SwarmBatchCreateResult,
  SwarmBatchDestroyResult,
  SwarmProvider,
  SwarmUnit,
  SwarmUnitRunFn,
  SwarmUnitRunResult,
  SwarmUnitSpec,
} from "./types";

const logger = createModuleLogger('SwarmSandbox');

/** Internal fan-out cap used if this provider is called directly, without `SwarmScheduler` in front. */
const DEFAULT_INTERNAL_CONCURRENCY = DEFAULT_CONCURRENCY;

export interface LocalSwarmProviderOptions {
  /** Internal fan-out cap for this provider's own concurrency (see above). */
  concurrency?: number;
}

let unitSequence = 0;
function nextUnitId(): string {
  unitSequence += 1;
  return `local-${Date.now().toString(36)}-${unitSequence}`;
}

export class LocalSwarmProvider implements SwarmProvider {
  private readonly concurrency: number;
  private readonly units = new Map<string, SwarmUnit>();

  constructor(options: LocalSwarmProviderOptions = {}) {
    this.concurrency = options.concurrency ?? DEFAULT_INTERNAL_CONCURRENCY;
  }

  async createBatch(specs: SwarmUnitSpec[]): Promise<SwarmBatchCreateResult> {
    const units: SwarmUnit[] = specs.map((spec) => {
      const unit: SwarmUnit = {
        id: nextUnitId(),
        status: "ready",
        createdAt: Date.now(),
        metadata: spec.metadata ?? {},
      };
      this.units.set(unit.id, unit);
      return unit;
    });

    // In-process bookkeeping has nothing external to fail against — always
    // fully succeeds, so `failures` is always empty here.
    return { units, failures: [] };
  }

  async runBatch<T>(
    units: SwarmUnit[],
    fn: SwarmUnitRunFn<T>
  ): Promise<SwarmUnitRunResult<T>[]> {
    if (units.length === 0) return [];

    const settled = await mapWithConcurrency(units, this.concurrency, (unit) => fn(unit));

    return settled.map((result, index) => {
      const unitId = units[index].id;
      if (result.status === "fulfilled") {
        return { unitId, status: "fulfilled" as const, value: result.value };
      }
      return { unitId, status: "rejected" as const, error: result.reason };
    });
  }

  async destroyBatch(unitIds: string[]): Promise<SwarmBatchDestroyResult> {
    const destroyed: string[] = [];
    const failures: SwarmBatchDestroyResult["failures"] = [];

    for (const unitId of unitIds) {
      if (this.units.delete(unitId)) {
        destroyed.push(unitId);
      } else {
        failures.push({ unitId, error: `Unit ${unitId} was not found (already destroyed?)` });
      }
    }

    if (failures.length > 0) {
      logger.warn(
        { failed: failures.length, destroyed: destroyed.length },
        "Some local units were already gone on destroy"
      );
    }

    return { destroyed, failures };
  }

  async status(unitId: string): Promise<SwarmUnit> {
    const unit = this.units.get(unitId);
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }
    return unit;
  }
}
