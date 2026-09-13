# Checkpoint — session/cu20-teachbatch

**Goal:** Land spec `stagehand-batch-fork` deferrals A/B/C. All code + smoke done; landing in progress.

**Done:**
- A `c7c2e50c3` record→teach→batch compilation; B `45f5e280b` auto page binding + contract v1.1; C `f57a81859` flake fix (`audit_api_returns_rows_with_bot_filter`: unguarded ALLTERNIT_COMPUTER_USE_DIR mutations now hold the shared test lock; note origin/main independently locked the snapshot test — resolved taking theirs) + approval_id surfaced on batch-grant events + RunWorkflowBody.batch_page_url.
- Merge origin/main landed `fc13b21e7` (checkpoint restored from /tmp/cu20-checkpoint-mine.md).
- **Live smoke 8/8 + 5/5 PASS** (tmp-cu20-smoke/smoke.py): leg 1 compiled batch — ONE grant (approval_id surfaced, handoff-approved at /api/aci/handoff/:id/approve), sidecar executed 3/3 in real Chrome, Rust receipt `completed` 3/3 via /api/aci/batch/receipts/:id, ledger opened/closed, steps via=batch. Leg 2 under ALLTERNIT_WORKFLOW_BATCH=0 — no batch events, no approvals, 3 per-step steps ok via browser.cdp. Env notes: venv needed `playwright` pip install; runtime needed `pnpm install && pnpm run build`; routes are under /api.
- Python suites post-merge: 69 passed, 0 failed.

**Next:** aci_ x4 background run finishing (bash-eszu44ju), then ≥3 clean post-merge runs → push → PR → merge → attestation+LEDGER via detached worktree → cleanup (worktrees incl. allternit-cu20-baseline, branch local+remote, tmp-cu20-smoke).

**Open questions:** None.
