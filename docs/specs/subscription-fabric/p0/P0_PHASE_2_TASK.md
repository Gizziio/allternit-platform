# P0 Phase 2 Task — subscription-fabric-contracts: task/routing/events/index + tests

You are building Phase 2 of 2 of `platform/packages/subscription-fabric-contracts/` (`@allternit/subscription-fabric-contracts`). Phase 1 is complete and reviewed: the package scaffolding and `src/{capability,manifest,account,quota,artifact,thread}.ts` already exist. **Build on them as-is — do not rewrite Phase 1 files.** If you find a genuine defect in a Phase 1 file, fix the minimal line and record it under `deviations`.

## Normative sources (read first, transcribe faithfully)

- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — §S4 Task (lines 219–286), §S7 Errors (lines 344–357), §A1 Adapter interface + AdapterEvent union (lines 361–417), §A2 Router interface (lines 418–442). These are binding: field names, optionality, union members.
- §A9 failure taxonomy (lines 518–537) and SPEC.md §31 (line 1224) for `FailureClass`.

## Exact deliverables

1. `src/task.ts` — §S4: `Task`, `TaskStatus` (exact union, including the comment semantics: `provider_running` = detached; `partial` = text ok but artifact failed; `needs_user` pauses, does not fail), `TaskAttempt`, `TaskInput` (4-variant union). Also `FailureClass` and `TaskError` (§S7):
   - `FailureClass` = SPEC §31 base list **minus** `selector_not_found` (folded into `provider_ui_changed` per §A9: `auth_required, quota_exhausted, rate_limited, provider_ui_changed, provider_error, artifact_generation_failed, download_failed, network_error, user_intervention_required, unsupported_capability`) **plus** §A9 additions (`challenge_presented, account_restricted, submission_ambiguous, model_downgraded, content_refused, stalled, timeout, output_truncated, profile_locked, worker_crashed, artifact_expired, approval_required, policy_denied`).
   - `TaskError` per §S7 (`class`, `scope`, `retryable`, `fallback_eligible`, `cooldown_s`, `user_action`, `detail`, `evidence_ref`).
2. `src/routing.ts` — §A2: `CapabilityRouter` (interface, TS-only — no zod needed for method signatures), `RouteDecision`, `RouteCandidate`, `RejectReason` (union of machine-readable reasons: e.g. `capability_not_offered, plan_lacks_capability, adapter_disabled, pool_exhausted, pool_cooling_down, pool_degraded, health_not_ready, sensitivity_blocked, metered_not_allowed, approval_required, ui_drift` — extend if the spec implies more), `FabricSnapshot` (the pure-router input: `accounts`, `manifests`, `pools`, `session_health` by account, `captured_at` — minimal, consistent with §A2's "pure function over a snapshot").
3. `src/events.ts` — §A1: the `AdapterEvent` discriminated union **verbatim** (11 variants: `submitted, reply, progress, artifact.partial, artifact.ready, model.observed, quota.signal, needs_user, detached, done, error`), `ProbeResult` (minimal: `ok`, `checks: Array<{ key, critical, ok, detail? }>`, `observed_at`), `ResumeToken` (opaque: `token`, `adapter_id`, `attempt_no`, `issued_at`, `poll_after_s`), `ReconcileResult` (`outcome: acknowledged | duplicate | not_found | ambiguous`, optional `provider_thread_id`, optional `detail`), plus the `SubscriptionAdapter` and `ExecutionContext` interfaces from §A1 (TS interfaces, not zod). `reply` events carry `ReplyEvent` from `@allternit/replies-contract` — add `"@allternit/replies-contract": "workspace:*"` to package.json dependencies and import its type. For `ExecutionContext`'s SDK-owned collaborators (`PageLease`, `ArtifactSink`, `Pacer`, `SelectorResolver`, `RedactingLogger`, `AdapterRuntime`) declare minimal interfaces here in events.ts with a one-line comment `// implemented by @allternit/subscription-adapter-sdk (P2)` — they are boundary contracts, the SDK implements them later.
4. `src/index.ts` — re-export everything (named exports, no `export *` conflicts; group by module).
5. `test/` — vitest tests (`"test": "vitest --passWithNoTests"` must exist in package.json):
   - **Round-trip tests**: for each zod schema, a valid fixture parses, and `schema.parse(x)` → JSON.stringify → parse again yields deep-equal. Include at least: CapabilityDef, AdapterManifest, Account, QuotaPool, Task (all 4 TaskInput variants), Artifact, ThreadMapping, RouteDecision, and every AdapterEvent variant.
   - **Negative tests**: unknown enum member rejected; `Task` with `side_effects: external_publish` semantics noted (approval_id presence is a runtime rule — only test it if you encode a `.refine()`, otherwise leave it); malformed `CapabilityId` (`"nodot"`) rejected.
   - **Schema-version guard**: a snapshot test (or explicit literal test) pinning each schema's type name list / union members so an accidental member removal fails loudly.
   - Fixtures live inline in test files or `test/fixtures.ts`. **No provider-name literals in fixtures either** — use `prov_example`, `acct_example_01`, etc. (see hard gate).

## Hard gates (checked in review)

- **No provider-name literals anywhere in the package**: `grep -ri "chatgpt\|claude\|kimi\|gemini\|grok\|deepseek\|openai\|anthropic" platform/packages/subscription-fabric-contracts/src platform/packages/subscription-fabric-contracts/test` must return nothing.
- The `AdapterEvent` and `Task` unions compile and are exhaustive-tested.
- From the repo root: `pnpm install` (pnpm only, never npm), then `pnpm -F @allternit/subscription-fabric-contracts build` and `pnpm -F @allternit/subscription-fabric-contracts test` — **both must pass before you finish.** This is the P0 verify gate; do not declare done without it.
- **No git operations. No dev servers.**

## Completion sentinel

When finished, write `docs/specs/subscription-fabric/p0/P0_PHASE_2_NOTES.md` starting with YAML frontmatter:

```yaml
---
status: done|blocked
files_changed: [list of paths]
deviations: [what + why, or none]
remaining: [items, or none]
verify: [exact commands run + pass/fail]
---
```

then prose notes. That file existing = done.
