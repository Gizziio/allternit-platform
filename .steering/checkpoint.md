# Steering Checkpoint — session/gwrobust (RESUMED 2026-09-24)

> **Next agent: read `docs/specs/gateway-hardening/HANDOFF.md` — it is the complete handoff. This checkpoint is a summary; the HANDOFF is authoritative.**

## Goal
Close P0 gaps from the gateway gap analysis (brain: Products/GatewayGapAnalysis.md): failover health, verification, fenced stubs + console control plane. Spec: docs/specs/gateway-hardening/plan.md (written, in worktree, uncommitted).

## State when paused (2026-09-19, weekly quota limit reached)

**Done & verified (uncommitted, safe in worktree):**
- Console pages COMPLETE: `surfaces/platform.allternit.com` — `src/lib/gateway-routing-policy.ts`, `src/pages/console/gateway/RoutingPolicyPage.tsx` (with live resolve-preview widget), `RouteCredentialsPage.tsx`, routes in `App.tsx`, "Gateway" nav group in `src/components/console-ui/navConfig.ts`. Verified: `npx tsc --noEmit` clean, `pnpm build` green. No new deps. Caveat found: GET provider-routing returns only own-tenant row; null policy doesn't mean no policy applies (global row may) — page surfaces this honestly.

**Partial (uncommitted, UNVERIFIED — agent cancelled mid-run, tests NOT confirmed):**
- P0.1 + P0.4 Rust edits present in worktree: `cmd/allternit-api/src/llm_gateway/{failover.rs, embeddings.rs, images.rs, realtime_audio.rs, translate.rs, metrics.rs}` dirty. Likely cooldown tracker + fenced fakes, but MUST be reviewed and `cargo test -p allternit-api llm_gateway` run before trusting/committing.

**Not started:**
- P0.3 wire conformance harness (agent cancelled before work).
- P0.2 streaming failover retry-hint event.
- CommRails DAG (`allternit-commrails plan new`) — CLI binary built OK at .shared-target; DAG not yet created.
- No commits, no PR, no ledger attestation, no cleanup. Session lifecycle steps 4–9 all pending.

## Resume order next session
1. Review dirty Rust files; run cargo tests (CARGO_TARGET_DIR=.shared-target); finish/fix P0.1+P0.4, then commit.
2. CommRails DAG for remaining nodes (P0.3, P0.2).
3. P0.3 conformance harness, P0.2 retry-hint.
4. Then lifecycle: push, PR, merge, attest in agent-ledger, cleanup worktree, git-discipline-check.

## Open questions (unchanged)
- Streaming failover: hint-event (chosen in spec) vs gateway resume — P0.2 implements hint path.
- Fake endpoints: 501 + allternit.not_configured chosen; escape env ALLTERNIT_GATEWAY_ALLOW_FAKE_PROVIDERS=1.

## Resume progress (2026-09-24)
- Fetched origin; fast-forwarded branch to origin/main (80c7f08d5); checkpoint conflict resolved (kept gwrobust copy).
- Rust diff reviewed by subagent: meets P0.1 + P0.4 spec. Fixed one real gap: proxy.rs collect() now classifies upstream HTTP 429 as `rate_limit_error` (previously dead code — cooldowns never triggered on 429).
- Tests green: `cargo test -p allternit-api llm_gateway` 215/0; `--test wire_conformance` 8/0. Disk-full flake resolved.
- wire_conformance.rs = substantial partial P0.3 (missing BYOK attach/strip + residency 451 cases).
- Next: commit logical chunks (console pages, P0.1/P0.4, harness, spec), then finish P0.3 cases + P0.2 retry_hint, CommRails DAG, landing lifecycle.

## Resume progress 2 (2026-09-24, late)
- P0.3 COMPLETE: BYOK attach/strip + residency 451 cases; wire_conformance 10/10 (commit 82b8b2d).
- P0.2 COMPLETE: allternit.retry_hint SSE event on stream failure (failover.rs owns policy, proxy.rs owns wire); llm_gateway tests 222/0 (commit 6a330adba).
- DAG dag_821592: n_2713 DONE, n_3879 DONE, n_2309 (landing) READY.
- Next: PR → merge → sync main → ledger attestation → desktop rebuild (allternit-api sidecar affected) → worktree cleanup → git-discipline-check.
