/**
 * SwarmScheduler
 *
 * Sits in front of a `SwarmProvider`. Responsibilities:
 * - Bounded concurrency: never more than `concurrency` create/destroy calls
 *   in flight against the provider at once, regardless of how large a single
 *   logical request is.
 * - Batching: chunks a logical "create N units" request into provider-sized
 *   batch calls instead of firing N unbounded single calls.
 * - Cleanup guarantees: every unit that's actually created gets tracked
 *   immediately, so it can always be destroyed later — including units from
 *   a batch that partially failed to create — and a unit that fails to
 *   destroy stays tracked (not silently dropped) so a retry can still find it.
 */

import { createModuleLogger } from '@/lib/logger';

import type {
  SwarmBatchCreateResult,
  SwarmBatchDestroyResult,
  SwarmProvider,
  SwarmUnit,
  SwarmUnitSpec,
} from "./types";

const logger = createModuleLogger('SwarmSandbox');

/**
 * Sane default: bounded enough to stay well under typical provider
 * concurrency/rate limits without extra configuration. Tune via
 * `SwarmSchedulerOptions.concurrency` for your plan/quota.
 */
export const DEFAULT_CONCURRENCY = 10;

export interface SwarmSchedulerOptions {
  /** Max in-flight create/destroy calls against the provider at once. */
  concurrency?: number;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class SwarmScheduler {
  private readonly provider: SwarmProvider;
  private readonly concurrency: number;
  /** Units this scheduler has created and not yet (successfully) destroyed. */
  private readonly tracked = new Map<string, SwarmUnit>();

  constructor(provider: SwarmProvider, options: SwarmSchedulerOptions = {}) {
    this.provider = provider;
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

    if (this.concurrency < 1) {
      throw new Error("SwarmScheduler concurrency must be >= 1");
    }
  }

  /** Number of units currently tracked as created-but-not-destroyed. */
  get trackedCount(): number {
    return this.tracked.size;
  }

  /** Ids of all units currently tracked as created-but-not-destroyed. */
  trackedUnitIds(): string[] {
    return [...this.tracked.keys()];
  }

  /**
   * Create `specs.length` units, batched to the provider in groups of at
   * most `concurrency`. A failed group doesn't stop later groups. Every unit
   * that's actually created is tracked immediately, so it can be destroyed
   * later even if other specs in the same call failed.
   */
  async createBatch(specs: SwarmUnitSpec[]): Promise<SwarmBatchCreateResult> {
    if (specs.length === 0) return { units: [], failures: [] };

    const groups = chunk(specs, this.concurrency);
    const units: SwarmUnit[] = [];
    const failures: SwarmBatchCreateResult["failures"] = [];

    for (const group of groups) {
      let result: SwarmBatchCreateResult;
      try {
        result = await this.provider.createBatch(group);
      } catch (error) {
        result = {
          units: [],
          failures: group.map((spec) => ({
            spec,
            error: error instanceof Error ? error.message : String(error),
          })),
        };
      }

      for (const unit of result.units) {
        this.tracked.set(unit.id, unit);
      }
      units.push(...result.units);
      failures.push(...result.failures);
    }

    logger.info(
      { requested: specs.length, created: units.length, failed: failures.length },
      "Batch create complete"
    );

    return { units, failures };
  }

  /**
   * Destroy specific units, batched in groups of at most `concurrency`.
   * Units that are actually destroyed are untracked; units that fail to
   * destroy stay tracked so a later retry (or `destroyAll`) can still find
   * and clean them up — nothing created is silently forgotten.
   */
  async destroyBatch(unitIds: string[]): Promise<SwarmBatchDestroyResult> {
    if (unitIds.length === 0) return { destroyed: [], failures: [] };

    const groups = chunk(unitIds, this.concurrency);
    const destroyed: string[] = [];
    const failures: SwarmBatchDestroyResult["failures"] = [];

    for (const group of groups) {
      let result: SwarmBatchDestroyResult;
      try {
        result = await this.provider.destroyBatch(group);
      } catch (error) {
        result = {
          destroyed: [],
          failures: group.map((unitId) => ({
            unitId,
            error: error instanceof Error ? error.message : String(error),
          })),
        };
      }

      for (const unitId of result.destroyed) {
        this.tracked.delete(unitId);
      }
      destroyed.push(...result.destroyed);
      failures.push(...result.failures);
    }

    if (failures.length > 0) {
      logger.warn(
        { destroyed: destroyed.length, failed: failures.length },
        "Batch destroy had failures — failed units remain tracked for retry"
      );
    }

    return { destroyed, failures };
  }

  /** Destroy every unit this scheduler currently tracks as alive. */
  async destroyAll(): Promise<SwarmBatchDestroyResult> {
    return this.destroyBatch(this.trackedUnitIds());
  }
}
