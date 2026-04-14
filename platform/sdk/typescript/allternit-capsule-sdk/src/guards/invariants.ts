/**
 * Invariants Guard
 *
 * Runtime validation of capsule invariants.
 */

import type { CapsuleId, SpaceId } from '../core/ids.js';
import type { StagePreset } from '../core/index.js';
import type { StageState } from '../controllers/StageController.js';

// ============================================================================
// Stage Invariants
// ============================================================================

export interface InvariantViolation {
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

const STAGE_INVARIANTS = [
  {
    name: 'single-active-stage',
    validate: (state: StageState): InvariantViolation | null => {
      if (state.active && !state.capsuleId) {
        return {
          rule: 'single-active-stage',
          message: 'Active stage must have a capsuleId',
          severity: 'error',
        };
      }
      return null;
    },
  },
  {
    name: 'valid-preset',
    validate: (state: StageState): InvariantViolation | null => {
      const validPresets: StagePreset[] = [0.5, 0.7, 1.0];
      if (!validPresets.includes(state.preset)) {
        return {
          rule: 'valid-preset',
          message: `Invalid stage preset: ${state.preset}`,
          severity: 'error',
        };
      }
      return null;
    },
  },
];

export function validateStageState(state: StageState): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  for (const invariant of STAGE_INVARIANTS) {
    const violation = invariant.validate(state);
    if (violation) {
      violations.push(violation);
    }
  }

  return violations;
}

// ============================================================================
// Presentation Invariants
// ============================================================================

export function validatePresentation(
  capsuleId: CapsuleId,
  spaceId: SpaceId,
  isActive: boolean,
  presentation: 'capsule' | 'stage'
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (presentation === 'stage' && !isActive) {
    violations.push({
      rule: 'presentation-consistency',
      message: `Capsule ${capsuleId} reports stage presentation but is not active`,
      severity: 'warning',
    });
  }

  return violations;
}

// ============================================================================
// Lifecycle Invariants
// ============================================================================

export function validateLifecycle(
  capsuleId: CapsuleId,
  phase: string,
  hasError: boolean
): InvariantViolation[] {
  const violations: InvariantViolation[] = [];

  if (phase !== 'error' && hasError) {
    violations.push({
      rule: 'lifecycle-error-consistency',
      message: `Capsule ${capsuleId} has error but phase is ${phase}, not 'error'`,
      severity: 'warning',
    });
  }

  return violations;
}

// ============================================================================
// Guard Runner
// ============================================================================

export interface GuardContext {
  capsuleId: CapsuleId;
  spaceId: SpaceId;
}

export type GuardFn = (context: GuardContext) => InvariantViolation[];

export function runGuards(
  guards: GuardFn[],
  context: GuardContext
): InvariantViolation[] {
  const allViolations: InvariantViolation[] = [];

  for (const guard of guards) {
    const violations = guard(context);
    allViolations.push(...violations);
  }

  return allViolations;
}

// ============================================================================
// Report Violations
// ============================================================================

export function reportViolations(
  violations: InvariantViolation[],
  source: string
): void {
  for (const violation of violations) {
    const logFn = violation.severity === 'error' ? console.error : console.warn;
    logFn(`[Guard:${source}] ${violation.rule}: ${violation.message}`);
  }
}
