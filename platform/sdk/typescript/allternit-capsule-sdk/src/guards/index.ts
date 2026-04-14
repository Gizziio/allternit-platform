/**
 * Guards Module Exports
 *
 * Runtime validation and guardrails.
 */

export type {
  InvariantViolation,
  GuardContext,
  GuardFn,
} from './invariants.js';

export {
  validateStageState,
  validatePresentation,
  validateLifecycle,
  runGuards,
  reportViolations,
} from './invariants.js';

export type { ActionGuard } from './actionGuard.js';

export {
  createActionGuard,
  filterRegisteredActions,
  getRegisteredAction,
} from './actionGuard.js';
