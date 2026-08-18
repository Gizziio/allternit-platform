/**
 * Ralph Loop Deprecation Registry
 *
 * Documents every Ralph-named type, event, UI label, route, and pattern
 * discovered in this codebase and their replacement mapping.
 *
 * ## Status (W2-001–W2-005)
 *
 * Ralph was the original loop architecture in Allternit Agent System Rails.
 * It is now DEPRECATED as the canonical execution model. Per D-003, goal /
 * plan / task / attempt / validation / policy strategies govern all new work.
 *
 * ### What to do with Ralph artifacts
 *
 * | Category               | Action                                                    |
 * |------------------------|-----------------------------------------------------------|
 * | UI labels ("Ralph")    | Remove from all product-facing surfaces                   |
 * | Type aliases           | Add `@deprecated` JSDoc; keep read compatibility          |
 * | Historical events      | Map to compatibility projections (not canonical taxonomy) |
 * | Execution code         | Delete only after Wave 2 runtime parity is evidenced      |
 * | Tests                  | Migrate to goal/task contracts; keep historical read tests|
 * | Docs / cookbooks       | Mark deprecated; rewrite against goal/task runtime        |
 * | Archive                | Leave in place; do not resurrect                          |
 *
 * @module ralph-deprecation
 */

// ============================================================================
// W2-001: Discovered Ralph-named artifacts
// ============================================================================

/**
 * Surface inventory as of 2026-08-16 audit.
 *
 * The prior version of this registry under-counted Ralph artifacts. The
 * following list is the authoritative inventory for Wave 2 deprecation.
 */
export const RALPH_AUDIT_RESULTS = {
  /** Files with Ralph terminology in doc comments or copy only (safe to update) */
  /** Product-facing web surface paths where Ralph terminology was removed (W2-003) */
  resolvedWebSurface: [
    {
      path: 'surfaces/ai.allternit.com/src/lib/bots/bot-prompt-augmentation.ts',
      action: 'Doc comment updated: "Ralph loop" → "goal/task loop"',
    },
    {
      path: 'surfaces/ai.allternit.com/src/capsules/browser/receiptService.ts',
      action: 'Doc comment updated: "Ralph Loop decision making" → "goal/task loop decision making"',
    },
    {
      path: 'surfaces/ai.allternit.com/src/plugins/fileSystem.ts',
      action: 'Slash commands renamed: ralph-loop → agent-loop, cancel-ralph → cancel-agent-loop',
    },
  ] as { path: string; action: string }[],

  /** Files with Ralph terminology in doc comments or copy only (remaining) */
  docCommentOnly: [] as string[],

  /** Files with Ralph in product-facing UI strings */
  uiLabels: [] as string[],

  /** Files with Ralph-named TypeScript types or runtime modules */
  namedTypes: [
    'domains/kernel/core/src/operator/dak/ralph.ts',
    'cmd/gizzi-code/src/runtime/verification/integration/loop-integration.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/loop/ralph.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/loop/no-stop-scheduler.ts',
  ] as string[],

  /** Files with Ralph-named API routes or persisted events */
  apiRoutes: [] as string[],

  /** Files with Ralph-named persisted events or ledger records */
  persistedEvents: [
    'rails/docs/runner/runner_mutations.json',
    'rails/src/wih/types.rs',
  ] as string[],

  /** Documentation and cookbooks that describe Ralph as canonical */
  documentation: [
    'domains/agent/cookbooks/ralph-loop.md',
    'domains/agent/cookbooks/policy-injection.md',
    'domains/agent/AGENTS.md',
    'domains/agent/prompts/prompt-packs-index.md',
    'domains/agent/prompts/prompt-packs-index-2.md',
    'domains/agent/prompts/formats/wih-scheme.md',
    'domains/agent/prompts/formats/prompt-format-spec-v1.md',
    'domains/agent/prompts/formats/dag-schema.md',
    'domains/agent/Allternit_Rails_Ownership_Map_v1.md',
    'domains/agent/roles/roles/orchestrator.md',
    'domains/agent/BridgeSpec_AgentRunner_RailsRunner_v2.md',
    'rails/docs/architecture/README.md',
    'rails/docs/architecture/layers/work/README.md',
    'rails/docs/runner/README.md',
    'docs/agent-tasks/COMMRAILS_PROTOCOL_INTEGRATION.md',
    'docs/archive/bridge-rails-runner.md',
    'docs/Core_System/02-Target/SPEC-Target-DAK-Runner.md',
    'docs/Core_System/02-Target/SPEC-Target-Bridge-Rails-Runner.md',
    'docs/Core_System/02-Target/SPEC-Target-Agent-Runner.md',
    'docs/Core_System/02-Target/ARCHITECTURE.md',
    'docs/Core_System/02-Target/SYSTEM_LAW.md',
    'docs/Core_System/01-Reality/review-protocol.md',
  ] as string[],

  /** Archived code that references Ralph (no action; remains in archive) */
  archive: [
    'archive/ts-orphans/ars-contexta/src/index.ts',
    'archive/agent-swarm/packs/templates/orch/orchestrator_loop.j2',
    'archive/agent-swarm/packs/templates/roles/builder.j2',
    'docs/archive/Restored_Context/04_Roadmaps_and_Plans/active_P5_PRODUCTION_READINESS_DAG.md',
    'docs/archive/Restored_Context/04_Roadmaps_and_Plans/need-to-finish-files_P3_P4_DAG_ADDENDUM.md',
    'docs/archive/Restored_Context/04_Roadmaps_and_Plans/active_P3_P4_DAG_ADDENDUM.md',
    'docs/archive/Restored_Context/04_Roadmaps_and_Plans/active_AGENT_FOLDER_DAG_ADDENDUM.md',
    'docs/archive/Restored_Context/04_Roadmaps_and_Plans/need-to-finish-files_P5_PRODUCTION_READINESS_DAG.md',
    'docs/archive/Restored_Context/02_UI_and_Frontend/spec_review-protocol.md',
    'docs/archive/Restored_Context/02_UI_and_Frontend/inbox_YOUDAG_SEMI_FORMAL_VERIFICATION_FULL_BUILD.md',
    'docs/archive/Restored_Context/01_Core_Laws_and_Arch/architecture-plans_Allternit_ROADMAP_FROM_SESSIONS.md',
    'docs/archive/Restored_Context/01_Core_Laws_and_Arch/need-to-finish-files_Allternit_AGENT_RAILS_SYSTEMS_COMPREHENSIVE_GUIDE.md',
    'docs/archive/Restored_Context/01_Core_Laws_and_Arch/architecture-plans_gap_matrix.md',
    'docs/archive/Restored_Context/01_Core_Laws_and_Arch/architecture-plans_agent-runner-GAPS.md',
    'docs/archive/Restored_Context/01_Core_Laws_and_Arch/AGENT_SYSTEM_AUDIT_AND_PACKAGING_PROPOSAL.md',
  ] as string[],

  /** Tests covering Ralph behavior */
  tests: [
    'domains/kernel/core/src/tests/operator-e2e.test.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/tests/compliance/ralph-loop-compliance.md',
    'bin/verify-phase3-approval.sh',
  ] as string[],

  /** Supporting DAK runner implementations that embed Ralph loop logic */
  dakRunners: [
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/index.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/operator-daemon.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/runner/agent-runner.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/dag/executor.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/dag/types.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/daemon.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/src/mcp-server.ts',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/README.md',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/ARCHITECTURE.md',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/docs/API-REFERENCE.md',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/docs/AGENTS-INTEGRATION.md',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/docs/INTEGRATION-GUIDE.md',
    'infrastructure/chrome-stream/agent-systems/allternit-dak-runner/docs/IMPLEMENTATION-SUMMARY.md',
    'domains/kernel/core/src/dak-provider.ts',
  ] as string[],
} as const;

/** Flat list of every discovered path for quick verification. */
export const ALL_RALPH_PATHS: string[] = [
  ...RALPH_AUDIT_RESULTS.docCommentOnly,
  ...RALPH_AUDIT_RESULTS.uiLabels,
  ...RALPH_AUDIT_RESULTS.namedTypes,
  ...RALPH_AUDIT_RESULTS.apiRoutes,
  ...RALPH_AUDIT_RESULTS.persistedEvents,
  ...RALPH_AUDIT_RESULTS.documentation,
  ...RALPH_AUDIT_RESULTS.archive,
  ...RALPH_AUDIT_RESULTS.tests,
  ...RALPH_AUDIT_RESULTS.dakRunners,
];

// ============================================================================
// W2-002, W2-003: Deprecation markers and replacement mapping
// ============================================================================

/**
 * Historical event type prefixes emitted by older Ralph-based runners.
 * These are NEVER the canonical event taxonomy going forward.
 * They must be mapped to compatibility projections (W2-004) for read
 * compatibility until the migration support window ends.
 */
export const LEGACY_RALPH_EVENT_PREFIXES = [
  'RailsLoopIteration',
  'RailsLoopStart',
  'RailsLoopEnd',
  'RailsLoopEscalation',
] as const;

export type LegacyRalphEventPrefix = typeof LEGACY_RALPH_EVENT_PREFIXES[number];

/**
 * Map legacy Ralph event type → canonical Wave 2 event type.
 * Used by compatibility projection handlers (W2-004).
 */
export const RALPH_TO_CANONICAL_EVENT_MAP: Record<LegacyRalphEventPrefix, string> = {
  RailsLoopIteration: 'task.attempt.started',
  RailsLoopStart: 'goal.activated',
  RailsLoopEnd: 'goal.completed',
  RailsLoopEscalation: 'goal.blocked',
};

/**
 * Guard: return true if an event type is a legacy Ralph event.
 * Use this in projection/ingestion code to route to the compat handler.
 */
export function isLegacyRalphEvent(eventType: string): boolean {
  return LEGACY_RALPH_EVENT_PREFIXES.some((prefix) => eventType.startsWith(prefix));
}

/**
 * Map a legacy Ralph event type to its canonical equivalent, or return
 * the original type unchanged if it is already canonical.
 */
export function toCanonicalEventType(eventType: string): string {
  for (const [legacy, canonical] of Object.entries(RALPH_TO_CANONICAL_EVENT_MAP)) {
    if (eventType.startsWith(legacy)) return canonical;
  }
  return eventType;
}

// ============================================================================
// W2-004: Read compatibility window
// ============================================================================

/**
 * The compatibility read window ends when all persisted historical Ralph events
 * have been migrated or the migration support deadline has passed.
 * Until then, keep the legacy prefix constants and toCanonicalEventType bridge.
 */
export const RALPH_COMPAT_WINDOW_END = '2027-08-16';

// ============================================================================
// W2-005: Deletion gate
// ============================================================================

/**
 * Obsolete Ralph execution code may only be deleted after Wave 2 runtime parity
 * is evidenced in the implementation tracker. The gate is intentionally strict:
 * deletion before parity risks losing historical run compatibility.
 */
export const RALPH_DELETION_GATE = {
  /** All Wave 2 contract schemas must be implemented and typechecked. */
  contractsImplemented: true,
  /** Goal/plan/task runtime must execute at least one end-to-end flow. */
  runtimeParityEvidence: false,
  /** Historical Ralph events must have compatibility projection tests. */
  compatProjectionTests: false,
  /** Migration support deadline has passed. */
  deadlinePassed: false,
} as const;
