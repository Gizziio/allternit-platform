/**
 * Swarm Sandbox Tier — core types
 *
 * Provider-agnostic types for creating, running, and destroying large numbers
 * of ephemeral execution contexts ("swarm units") concurrently. This module
 * knows nothing about what a caller stuffs into a unit's metadata bag — no
 * "persona", "simulation round", or other product-layer concepts belong here.
 */

/** Lifecycle status of a single swarm unit. */
export type SwarmUnitStatus =
  | "pending"
  | "creating"
  | "ready"
  | "running"
  | "error"
  | "destroyed";

/**
 * One ephemeral execution context. The `metadata` bag is caller-defined and
 * opaque to this module — the product layer decides what goes in it.
 */
export interface SwarmUnit {
  id: string;
  status: SwarmUnitStatus;
  createdAt: number;
  /** Caller-defined payload. Opaque to the swarm tier. */
  metadata: Record<string, unknown>;
}

/** Request to create one swarm unit. */
export interface SwarmUnitSpec {
  /** Underlying provider template/image identifier, if applicable. */
  template?: string;
  /** Wall-clock timeout for the unit's lifetime, in milliseconds. */
  timeoutMs?: number;
  /** Environment variables to inject into the unit. */
  envs?: Record<string, string>;
  /** Caller-defined payload, carried through to the resulting `SwarmUnit`. */
  metadata?: Record<string, unknown>;
}

/** Why a single unit failed to create, within a larger batch request. */
export interface SwarmUnitCreationFailure {
  spec: SwarmUnitSpec;
  error: string;
}

/** Result of a batch create call — always partial-success shaped. */
export interface SwarmBatchCreateResult {
  units: SwarmUnit[];
  failures: SwarmUnitCreationFailure[];
}

/** Why a single unit failed to destroy, within a larger batch request. */
export interface SwarmUnitDestructionFailure {
  unitId: string;
  error: string;
}

/** Result of a batch destroy call — always partial-success shaped. */
export interface SwarmBatchDestroyResult {
  destroyed: string[];
  failures: SwarmUnitDestructionFailure[];
}

/** Work to run against a single unit. */
export type SwarmUnitRunFn<T> = (unit: SwarmUnit) => Promise<T>;

/** Outcome of running work against a single unit within a batch. */
export type SwarmUnitRunResult<T> =
  | { unitId: string; status: "fulfilled"; value: T }
  | { unitId: string; status: "rejected"; error: string };

/**
 * A pluggable backend for the swarm tier. `E2BSwarmProvider` is the sole
 * implementation for now — keep this interface thin so a future provider
 * swap doesn't require touching call sites.
 */
export interface SwarmProvider {
  /** Create many units concurrently. Never throws for per-unit failures. */
  createBatch(specs: SwarmUnitSpec[]): Promise<SwarmBatchCreateResult>;
  /** Run `fn` against many units concurrently, isolating per-unit failures. */
  runBatch<T>(
    units: SwarmUnit[],
    fn: SwarmUnitRunFn<T>
  ): Promise<SwarmUnitRunResult<T>[]>;
  /** Destroy many units concurrently. Never throws for per-unit failures. */
  destroyBatch(unitIds: string[]): Promise<SwarmBatchDestroyResult>;
  /** Fetch the current status of a single unit. */
  status(unitId: string): Promise<SwarmUnit>;
}
