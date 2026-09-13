# Attestation — session/dag-surface-v3 (PR #485)

**When:** 2026-09-13 ~15:00–17:55 local · **Agent:** kimi-code · **Branch:** `session/dag-surface-v3` · **Merged:** `51fbe2fece5a7935b370a9a9938778bd45b47f8d` · **DAG:** `dag_866360` / `wih_4749` (closed + vaulted)

## What was done

v3 of the DAG todo surface (approved plan) — four commits on the platform + one on the Brain vault:

1. `feat(api)` — close status whitelist (DONE|FAILED, normalized; lowercase `failed` was previously written verbatim and missed the WIH-closed filter at commrails/src/wih/mod.rs:23); `POST /dags/:dag_id/nodes` via `mutate_with_decision` (no prompt needed).
2. `fix(api)` — **renumbered duplicate migrations V142–V144 → V168–V170.** Found during smoke: merge `5737b3fbc` introduced duplicate migration versions, making EVERY allternit-api boot on main panic at db.rs:20 (fresh: UNIQUE violation; existing: applied-mismatch). Verified fix: fresh-db boot applies all 167; real Brain db copy boots clean and takes V168–V170. **Main was unbootable before this.**
3. `feat(surfaces)` — Fail… button (reason prompt → FAILED close), **+ Add task** inline input per dag section, `N blocked` badge in the bot deck header (needsYou count, fail-closed).
4. `feat(gizzi-code)` — `x` = fail-close key; footer `j/k move · t take · d done · x fail · esc blur`; `closeWih` status param.
5. Brain vault `d6b9887` — `Ops/scripts/lib/rails-dag-sync.js` + hooks in `research-cycle-queue.js event` and `ingest-research.js`: queue status transitions and new ingests now sync dag_505836 (status map incl. landed→DONE/dropped→FAILED, title-prefix rewrites, CreateNode for new items, idempotent, fail-soft, `RAILS_DAG_SYNC=0` opt-out).

## Verification evidence

- API smoke: `failed`→FAILED normalized; `bogus`→400; node add 201 + bad parent 400; wrong-agent 403 regression.
- Web: vitest 12/12, tsc 0 err, vite build green.
- gizzi-code: typecheck 0 err; 12 unit tests; **full suite 1342 pass after dep repair** (see incidents).
- Brain: dry-run + real run (created + RUNNING node for live item `rq-20260913-007`) + idempotent no-op second run.
- Release lock: preflight 36/0; production bundle build green.

## Incidents / honest deferrals

- **Parallel-install dependency corruption**: the web and TUI subagents each ran pnpm install in the same worktree (root + cmd/gizzi-code); the root install pruned zod from the shared store, breaking 106/106 tests with `Cannot find module 'zod/v4'`. Reproduced, root-caused, fixed with a root `pnpm install --frozen-lockfile`; suite then green. Not a code defect — but a lesson: parallel agents must not run package installs in the same worktree.
- Two pre-existing test flakes observed once each (checkpoint age-math; reply-timeout) — unrelated, reproduced on stashed tree by the subagent.
- Migration fix caution: `embed_migrations!` doesn't rerun cargo on dir changes (needed `touch db.rs`); flagged as a possible build.rs follow-up — NOT done here.
- Who-needs-you per-node join remains v4 (needs ao-engine correlation key); v3 ships the count badge only.
- Desktop rebuild skipped per standing practice (preflight + production compile green).
