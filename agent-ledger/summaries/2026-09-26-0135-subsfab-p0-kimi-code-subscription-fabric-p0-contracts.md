# Attestation — session/subsfab-p0 — Subscription Fabric P0 contracts package

**Date:** 2026-09-26 ~01:35 CDT
**Agent:** Kimi Code (orchestrator) + kimi CLI executors on glm-5.3-flash (Phase 1) and deepseek-flash-latest (Phase 2), per Eoj's directive (codex/agy ao-spawns unavailable)
**PR:** #736 — merged as merge commit `7a7da51a8` (merge, not squash)
**Branch:** `session/subsfab-p0`, cut from `origin/main` @ `cd766a971`

## What was done

P0 of the Subscription Capability Fabric (IMPLEMENTATION_PLAN §2): the canonical contracts package `platform/packages/subscription-fabric-contracts/` (`@allternit/subscription-fabric-contracts`), a zod + TS transcription of the normative schemas in `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` §S1–S7 and §A1–A2:

- `capability.ts` (CapabilityId, CapabilityDef, ArtifactType incl. `html_app`, ModelClass, Sensitivity, branded ProviderId, minimal JSONSchema), `manifest.ts` (§S2 + §A5 PacingProfile), `account.ts`/`quota.ts` (§S3, HARDENING SessionHealth union), `artifact.ts` (§S5), `thread.ts` (§S6)
- `task.ts` (§S4 + §S7; FailureClass = SPEC §31 minus `selector_not_found` folded per §A9, plus §A9 additions = 23 members), `routing.ts` (§A2 pure-router types + FabricSnapshot), `events.ts` (§A1: 11-variant AdapterEvent union verbatim, SubscriptionAdapter/ExecutionContext; reply events carry `@allternit/replies-contract` ReplyEvent via tsc project reference)
- `test/`: vitest — round-trips for every schema (incl. all 11 AdapterEvent variants), negative tests, union-member schema guards, exhaustiveness checks
- Phase briefs + executor/reviewer notes: `docs/specs/subscription-fabric/p0/`

## How it was verified (P0 gate, run by orchestrator independently of executor claims)

- `pnpm -F @allternit/subscription-fabric-contracts build` → PASS (tsc -b)
- `CI=1 pnpm -F @allternit/subscription-fabric-contracts test` → PASS (41/41)
- Provider-name-literal gate grep over `src/` + `test/` → zero matches
- Every schema file read and checked field-by-field against the normative sections; executor deviations (tsc -b project reference, RejectReason +2 justified members, z.custom for ReplyEvent, Uint8Array preview excluded from JSON round-trip) reviewed and accepted — all documented in `p0/P0_PHASE_2_NOTES.md`

## Incidents / honest deferrals

- **glm executor (Phase 1) completed the code well but failed process compliance**: stalled, then drifted to an unrelated append (`docs/plans/2026-02-21-v3-stable-delta.md` — never landed; footprint verified clean via git status) and was killed. Orchestrator completed the Phase 1 review directly and wrote its NOTES file (documented inside the file). Reviewer fixes: stripped `REVIEW_CLAUDE.md` filename from header comments (trips the provider-literal gate), added `.max(500)` to `QuotaSignal.raw_excerpt`.
- **Transient fork-table exhaustion**: a burst of ~2,500 short-lived `allternit-rails` processes blocked all forks for ~2 minutes, then self-resolved before parentage could be captured. Origin unknown — watch for recurrence.
- **DAG gate skipped** (owner waiver, 2026-09-26; `allternit-commrails` CLI not on PATH).
- **Desktop rebuild skipped**: new package is unreferenced by anything the desktop bundles.
- kimi executors need `zsh -ic` launch wrapping to inherit `OPENROUTER_API_KEY` from `~/.zshrc`; plain ao-spawn misses it. Recorded for future orchestration.

## Next

P1 — Subscription Gateway skeleton + store + security (incl. D12 completion-push spine and the 7788 port-table addition) per IMPLEMENTATION_PLAN §2, fresh session worktree.
