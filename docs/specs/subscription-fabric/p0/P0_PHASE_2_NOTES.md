---
status: done
files_changed:
  - platform/packages/subscription-fabric-contracts/src/task.ts
  - platform/packages/subscription-fabric-contracts/src/routing.ts
  - platform/packages/subscription-fabric-contracts/src/events.ts
  - platform/packages/subscription-fabric-contracts/src/index.ts
  - platform/packages/subscription-fabric-contracts/test/fixtures.ts
  - platform/packages/subscription-fabric-contracts/test/roundtrip.test.ts
  - platform/packages/subscription-fabric-contracts/test/negative.test.ts
  - platform/packages/subscription-fabric-contracts/test/schema-guard.test.ts
  - platform/packages/subscription-fabric-contracts/test/events.test.ts
  - platform/packages/subscription-fabric-contracts/package.json
  - platform/packages/subscription-fabric-contracts/tsconfig.json
  - pnpm-lock.yaml
deviations:
  - "tsconfig gained `references: [{ path: ../replies-contract }]` and build/typecheck changed from `tsc`/`tsc --noEmit` to `tsc -b`; without a project reference the TS `ReplyEvent` import resolves to a `.ts` file outside this package's rootDir and tsc fails with TS6059. Mirrors the existing replies-reducer/provider-adapters pattern."
  - "RejectReason extended beyond the eleven names listed in §A2 with `account_disabled` (implied by Account.enabled, §S3) and `policy_denied` (§A9 explicitly calls policy_denied a router rejection, not an adapter error)."
  - "The `reply` AdapterEvent variant validates through a permissive `z.custom<ReplyEvent>` because @allternit/replies-contract owns that union and ships no zod schema. It round-trips verbatim; deep-field validation stays replies-contract's job."
  - "`artifact.partial`'s optional Uint8Array `preview` is not JSON-serializable, so it is excluded from the JSON round-trip fixture and covered by a direct-parse assertion instead."
  - "`Task.approval_id` presence-is-required-when-external_publish is left as a runtime rule (no `.refine()`), per the task's own guidance."
remaining:
  - none
verify:
  - "pnpm install → PASS (peer-dependency warnings only; pre-existing and unrelated)"
  - "pnpm -F @allternit/subscription-fabric-contracts build → PASS (tsc -b, exit 0)"
  - "CI=1 pnpm -F @allternit/subscription-fabric-contracts test → PASS (4 files, 41 tests)"
  - "grep -ri 'chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic' .../src .../test → no matches (exit 1, gate clean)"
---

# P0 Phase 2 — task/routing/events/index + tests

Phase 1 files were built on as-is; no Phase 1 source file was modified.

## What landed

**`src/task.ts`** — §S4 `Task`, `TaskStatus` (11 members, with the `provider_running` /
`partial` / `needs_user` semantics in comments), `TaskAttempt`, `TaskInput` (4-variant
`z.discriminatedUnion("type")`), plus §S7 `FailureClass` (23 members: SPEC §31 base minus
`selector_not_found`, plus the §A9 additions) and `TaskError`.

**`src/routing.ts`** — §A2 `CapabilityRouter` (TS-only interface), `RouteDecision`,
`RouteCandidate`, `RejectedRoute`, `RejectReason`, and `FabricSnapshot` (accounts,
manifests, pools, `session_health` keyed by `account_id`, `captured_at`).

**`src/events.ts`** — the §A1 `AdapterEvent` 11-variant union verbatim (`reply` carries a
`@allternit/replies-contract` `ReplyEvent`), `ProbeResult`, `ResumeToken`, `ReconcileResult`,
and the `SubscriptionAdapter` / `ExecutionContext` interfaces. The six SDK-owned
collaborators (`PageLease`, `ArtifactSink`, `Pacer`, `SelectorResolver`, `RedactingLogger`,
`AdapterRuntime`) are declared here as minimal opaque interfaces, each tagged
`// implemented by @allternit/subscription-adapter-sdk (P2)`.

**`src/index.ts`** — named re-exports grouped by module, no `export *`.

## Layering note

`routing.ts` is imported by `task.ts` at runtime (`route_decision` nests `RouteDecision`),
so the dependency runs one way only: `routing.ts` type-imports `Task`/`TaskAttempt` from
`task.ts`, which erases at compile time. No runtime cycle.

## Test coverage

- `roundtrip.test.ts` — parse → `JSON.stringify` → parse deep-equal for CapabilityDef,
  AdapterManifest, Account, QuotaPool, Task (all 4 input variants), Artifact, ThreadMapping,
  RouteDecision, and every one of the 11 AdapterEvent variants.
- `negative.test.ts` — unknown enum members, the folded `selector_not_found`, malformed
  `CapabilityId` (`"nodot"`, `"too.many.dots"`), malformed event payloads, unknown task input
  variant, unknown `submission_state`.
- `schema-guard.test.ts` — pins every public union member list (TaskStatus, FailureClass,
  SessionHealth, RejectReason, ArtifactType, ReconcileOutcome, the 11 AdapterEvent tags).
- `events.test.ts` — `never`-default exhaustiveness over `AdapterEvent` and `TaskInput`, the
  small-contract round-trips, and a minimal `SubscriptionAdapter` implementation that proves
  the interface is satisfiable.

Fixtures use only `*_example_*` identifiers, so the provider-name gate is clean by construction.
