# Steering checkpoint — session/cu17-batchgate

**Goal:** P1 of spec `stagehand-batch-fork` — batch grant gate (Rust), gateway-routed sidecar inference + Browserbase URL scrub, ActionIntent coverage (dialogs/tabs/files) + screenshot hashing. Slices committed, verified, merged with origin/main; landing in PR #430.

**Done (this session, branch `session/cu17-batchgate`):**
- `5bc039aa2` Slice 1: Rust batch grant gate (`cmd/allternit-api/src/aci_batch.rs`) — batch descriptor over the 11-action whitelist, one SHA-256-bound single-use expiring grant per batch (reusing `aci_approvals`), auto/one-grant/per-step enforcement plans, JSONL batch receipts written before dispatch (audit-before-act), routes `POST /api/aci/batch` + `GET /api/aci/batch/receipts/:id`, sidecar `actBatch` transport. 19 new tests; aci suites 51→70.
- `f49d2bf5c` Slice 2: sidecar client-model callback routes through the allternit gateway (`/v1/chat/completions`, Bearer `ALLTERNIT_GATEWAY_KEY`, A://C default model, fail-closed); direct-provider mode removed; `DEFAULT_BROWSERBASE_URL` scrubbed (built service worker grep-clean). Smoke 6/6.
- `a74d8bfa9` Slice 3: ActionIntent coverage — tab.open/focus/close (SDK BrowserContext), dialog.accept/dismiss (host-side raw CDP; extension protocol has no dialog op), file.upload (sandbox containment + base64), download listing (Browser.setDownloadBehavior pinned), screenshot SHA-256 at capture. Smoke 11/11; `@allternit/browser` vitest 89/89.
- `1990fd8f0` Fix: sidecar NDJSON client slice-timeout bug (found by live smoke).
- `32225f0b9` Merge origin/main (console-be-p9 era). `.steering/checkpoint.md` conflict resolved theirs — this rewrite restores cu17 state.

**Verification evidence (all green):** cargo aci 70/0 (baseline 51/0); runtime typecheck+build green; smoke 11/11; vitest 89/89; **live gated-batch smoke 11/11** on a real gateway (`ALLTERNIT_API_PORT=8123`, `ALLTERNIT_LOCAL_DEV_BYPASS=1`) + real Chrome: grant→approve→execute→receipt, replay/tamper denied, halt position recorded; `release-preflight.mjs` 35/0.

**Next:** push `32225f0b9` (updates PR #430), wait checks, `gh pr merge 430 --merge`, record merge SHA, ledger attestation `agent-ledger/summaries/2026-09-12-HHMM-cu17-batchgate-kimi-*.md` + LEDGER.md line via detached worktree push to main, then worktree/branch cleanup.

**Open questions:** none. Note for later sessions: port 8013 is occupied by a long-running gateway owned by another session; use `ALLTERNIT_API_PORT` to boot your own.
