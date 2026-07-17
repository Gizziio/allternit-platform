/**
 * Swarm Sandbox Tier — public exports.
 *
 * See README.md for usage. This module is standalone: it doesn't depend on
 * anything in `@/lib/sandbox` outside this directory, and it has no concept
 * of what a caller puts in a unit's metadata bag.
 */

export type {
  SwarmUnit,
  SwarmUnitStatus,
  SwarmUnitSpec,
  SwarmUnitCreationFailure,
  SwarmUnitDestructionFailure,
  SwarmBatchCreateResult,
  SwarmBatchDestroyResult,
  SwarmUnitRunFn,
  SwarmUnitRunResult,
  SwarmProvider,
} from "./types";

export { E2BSwarmProvider } from "./e2b-provider";
export type { E2BSwarmProviderOptions } from "./e2b-provider";

export { LocalSwarmProvider } from "./local-provider";
export type { LocalSwarmProviderOptions } from "./local-provider";

export { SwarmScheduler, DEFAULT_CONCURRENCY } from "./scheduler";
export type { SwarmSchedulerOptions } from "./scheduler";

export { mapWithConcurrency } from "./concurrency";
