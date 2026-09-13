# Plan — session/cu17-batchgate (P1 of stagehand-batch-fork)

Spec: `Allternit Brain/Research/specs/stagehand-batch-fork.md` (P1: batch grant gate).
Worktree: `/Users/joe/Desktop/allternit-workspace/allternit-cu17`, branch `session/cu17-batchgate` from `origin/main` (P0 = PR #415 already merged).

## Slice 1 — Batch grant gate (Rust)
- [ ] 1.1 Read `aci_safety.rs` (enforce_confirmation, ConfirmationClass), `aci_approvals.rs` (hash_action_payload, grant request/approval/redeem), entry routes (computer_routes.rs, tool_routes.rs, computer_ws.rs). Baseline `cargo test` counts for affected crates (aci suites ~40).
- [ ] 1.2 Batch descriptor type: canonical JSON of {origin/session binding, ordered steps[]}; each step = whitelisted browser action (method + element ref/xpath + args). 11-action vocabulary from vendored protocol. Reject non-whitelist steps.
- [ ] 1.3 `aci_approvals`: batch-descriptor hash variant — single-use, expiring, hash-bound like action grants; reuse request/approval flow shape.
- [ ] 1.4 `enforce_confirmation` batch path: enforced once per batch pre-dispatch; ConfirmationClass decides batch-eligible vs per-step (conservative default: not clearly reversible → per-step).
- [ ] 1.5 Batch receipt: descriptor hash, grant id, per-step outcomes, halt-at-first-failure position; audit row before dispatch.
- [ ] 1.6 Invocation route under `/api/aci/*` (request batch grant + execute approved batch through sidecar provider). Thin, no planning logic.
- [ ] 1.7 Cargo tests: granted batch executes; tampered descriptor rejected; expired grant rejected; replay rejected; reversible-auto vs risky-per-step fallback; receipt contents + ordering. No regressions vs baseline.
- [ ] 1.8 Commit slice 1.

## Slice 2 — Gateway-routed inference + scrub
- [ ] 2.1 Read `Infra/model-routing.md` (Brain) + gateway Responses/Completions routes under `/api/agents/v1/*`.
- [ ] 2.2 Wire sidecar client-model callback → allternit gateway; model from env + routing policy; fail-closed if gateway unreachable; keep `--mock-model`.
- [ ] 2.3 Scrub inert Browserbase URL constant in built service worker (find source, remove/replace, rebuild, grep built artifact, update VENDORED.md).
- [ ] 2.4 typecheck + build green; smoke still 6/6.
- [ ] 2.5 Commit slice 2.

## Slice 3 — ActionIntent coverage + screenshot hashing
- [ ] 3.1 Check vendored runtime capabilities for dialog accept/dismiss, tab open/switch/close, file upload/download (do NOT invent actions).
- [ ] 3.2 Add intents to remote-provider.ts; downloads land in run-scoped sandbox dir.
- [ ] 3.3 SHA-256 screenshot outputs at capture time; record hash in step/receipt metadata.
- [ ] 3.4 Extend smoke script with new intents (mock-model OK); 100% pass.
- [ ] 3.5 `npx vitest run` for `@allternit/browser` green.
- [ ] 3.6 Commit slice 3.

## Verification (all before report)
- [ ] V1 cargo tests green, no regressions (report numbers).
- [ ] V2 `pnpm run typecheck` + `pnpm run build` green; smoke 100%.
- [ ] V3 `@allternit/browser` vitest green.
- [ ] V4 Live gated-batch smoke scripted + run: request grant → approve → execute batch on local test page → receipt correct.
- [ ] V5 `node scripts/release-preflight.mjs` from repo root; report score; confirm pre-existing failures if not 26/0.

## Landing
- [ ] L1 Push branch, `gh pr create` (summary + evidence), wait checks, `gh pr merge --merge`; record PR + merge SHA.
- [ ] L2 Attestation `agent-ledger/summaries/2026-09-12-HHMM-cu17-batchgate-kimi-<topic>.md` + LEDGER.md line, committed on main via detached worktree from origin/main + `git push origin HEAD:main`.
- [ ] L3 Remove worktree, delete session branch local+remote, verify clean state.

## Boundaries
- No Python ACU planning-loop changes (P2), no pricing/billing, no client-comms, no desktop release path files. If Slice 1 design would break an existing public contract → STOP and report.
