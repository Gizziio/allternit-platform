/**
 * E2B-backed SwarmProvider.
 *
 * The E2B SDK has no native bulk endpoint — `Sandbox.create` / `Sandbox.kill`
 * operate on one sandbox at a time. "Batch" here means fanning those single
 * calls out concurrently (bounded, not `Promise.all` over an unbounded array)
 * rather than looping over them serially.
 */

import { Sandbox } from "e2b";

import { createModuleLogger } from '@/lib/logger';

import { mapWithConcurrency } from "./concurrency";
import type {
  SwarmBatchCreateResult,
  SwarmBatchDestroyResult,
  SwarmProvider,
  SwarmUnit,
  SwarmUnitCreationFailure,
  SwarmUnitDestructionFailure,
  SwarmUnitRunFn,
  SwarmUnitRunResult,
  SwarmUnitSpec,
} from "./types";

const logger = createModuleLogger('SwarmSandbox');

/**
 * Internal fan-out cap used if this provider is called directly, without
 * `SwarmScheduler` in front applying its own (configurable) cap.
 */
const DEFAULT_INTERNAL_CONCURRENCY = 20;

/**
 * E2B sandbox metadata is a flat `Record<string, string>`; the swarm tier's
 * metadata bag is arbitrary JSON. Serialize it into one field going in and
 * parse it back out coming back.
 */
const METADATA_KEY = "swarmMetadata";

export interface E2BSwarmProviderOptions {
  /** E2B API key. Defaults to the `E2B_API_KEY` env var. */
  apiKey?: string;
  /** Sandbox template/image to use when a spec doesn't set one. */
  defaultTemplate?: string;
  /** Internal fan-out cap for this provider's own concurrency (see above). */
  concurrency?: number;
}

function encodeMetadata(metadata?: Record<string, unknown>): Record<string, string> {
  if (!metadata || Object.keys(metadata).length === 0) return {};
  return { [METADATA_KEY]: JSON.stringify(metadata) };
}

function decodeMetadata(raw: Record<string, string> | undefined): Record<string, unknown> {
  const encoded = raw?.[METADATA_KEY];
  if (!encoded) return {};
  try {
    return JSON.parse(encoded) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export class E2BSwarmProvider implements SwarmProvider {
  private readonly apiKey?: string;
  private readonly defaultTemplate?: string;
  private readonly concurrency: number;

  constructor(options: E2BSwarmProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.E2B_API_KEY;
    this.defaultTemplate = options.defaultTemplate;
    this.concurrency = options.concurrency ?? DEFAULT_INTERNAL_CONCURRENCY;

    if (!this.apiKey) {
      logger.warn(
        "E2B_API_KEY is not set — E2BSwarmProvider will fail on first use. Set it in the environment or pass { apiKey }."
      );
    }
  }

  async createBatch(specs: SwarmUnitSpec[]): Promise<SwarmBatchCreateResult> {
    if (specs.length === 0) return { units: [], failures: [] };

    logger.debug({ count: specs.length }, "Creating swarm unit batch");

    const settled = await mapWithConcurrency(specs, this.concurrency, async (spec) => {
      const createOpts = {
        apiKey: this.apiKey,
        timeoutMs: spec.timeoutMs,
        envs: spec.envs,
        metadata: encodeMetadata(spec.metadata),
      };
      const template = spec.template ?? this.defaultTemplate;
      const sandbox = template
        ? await Sandbox.create(template, createOpts)
        : await Sandbox.create(createOpts);

      const unit: SwarmUnit = {
        id: sandbox.sandboxId,
        status: "ready",
        createdAt: Date.now(),
        metadata: spec.metadata ?? {},
      };
      return unit;
    });

    const units: SwarmUnit[] = [];
    const failures: SwarmUnitCreationFailure[] = [];

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        units.push(result.value);
      } else {
        failures.push({ spec: specs[index], error: result.reason });
      }
    });

    if (failures.length > 0) {
      logger.warn(
        { failed: failures.length, succeeded: units.length },
        "Some units failed to create in batch"
      );
    }

    return { units, failures };
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
    if (unitIds.length === 0) return { destroyed: [], failures: [] };

    logger.debug({ count: unitIds.length }, "Destroying swarm unit batch");

    const settled = await mapWithConcurrency(unitIds, this.concurrency, async (unitId) => {
      const killed = await Sandbox.kill(unitId, { apiKey: this.apiKey });
      if (!killed) {
        throw new Error(`Sandbox ${unitId} was not found (already destroyed?)`);
      }
      return unitId;
    });

    const destroyed: string[] = [];
    const failures: SwarmUnitDestructionFailure[] = [];

    settled.forEach((result, index) => {
      if (result.status === "fulfilled") {
        destroyed.push(result.value);
      } else {
        failures.push({ unitId: unitIds[index], error: result.reason });
      }
    });

    if (failures.length > 0) {
      logger.warn(
        { failed: failures.length, destroyed: destroyed.length },
        "Some units failed to destroy in batch"
      );
    }

    return { destroyed, failures };
  }

  async status(unitId: string): Promise<SwarmUnit> {
    const info = await Sandbox.getInfo(unitId, { apiKey: this.apiKey });
    return {
      id: info.sandboxId,
      status: info.state === "running" ? "running" : "ready",
      createdAt: info.startedAt.getTime(),
      metadata: decodeMetadata(info.metadata),
    };
  }
}
