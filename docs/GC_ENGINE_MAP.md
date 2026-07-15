# GC Engine — Wiring Map

Analysis produced by the orchestrating session on 2026-07-14. Read this before the task spec.

## Goal

Replace the honest-empty `execute_gc()` stub in `cmd/allternit-api/src/agent_operations_routes.rs`
with the real GC analyzer engine, AND add multi-tenant project scoping so the engine operates on
a user's chosen codebase instead of implicitly scanning wherever the API server happens to run.

## Current state (confirmed by reading the code, not assumed)

- `cmd/allternit-api/src/agent_operations_routes.rs`: all `/agents/operations/gc/*` routes exist
  and are wired into the router. `execute_gc(conn, user_id, agent)` currently inserts a zero-issue
  row into `gc_runs` and returns an honest empty result — this was deliberately fixed earlier today
  to remove fabricated/synthetic data. Do not reintroduce synthetic numbers.
- `cmd/allternit-api/migrations/V18__agent_operations.sql`: `gc_policies` has **no `user_id` or
  `project_id` column at all** — six global rows, one set for the whole server. `gc_runs` has
  `user_id` but no project/repo reference. This is the core bug: nothing says *which codebase* is
  being analyzed.
- `domains/governance/garbage-collection/gc-agents/` — a real Rust crate, package name
  `allternit-gc-agents` (see its `Cargo.toml`), already a member of the root workspace and already
  aliased in `[workspace.dependencies]` at root `Cargo.toml:215`
  (`allternit-gc-agents = { path = "domains/governance/garbage-collection/gc-agents" }`).
  `cmd/allternit-api/Cargo.toml` does **not** yet depend on it — that's one line to add:
  `allternit-gc-agents = { workspace = true }` under `[dependencies]`, following the existing
  pattern used for other local crates in that file (e.g. `allternit-cowork-runtime`,
  `allternit-session-manager`).
  The crate has not been touched since the initial commit (2026-03) — verify it still compiles
  standalone before wiring it in; current `tree-sitter`/`tree-sitter-typescript`/`tree-sitter-rust`
  pinned versions may have drifted from what's in the workspace lockfile.
- `spec/governance/gc-agents.md` is **not tracked at HEAD** but exists in the initial commit:
  `git show 2f7f0f30:spec/governance/gc-agents.md`. It documents the six agents' intended detection
  logic, the entropy score formula, and score thresholds (0-10 healthy, 11-50 warning/auto-fix PR,
  51-100 critical/block merge, 100+ emergency). Use it as the reference for what each agent should
  actually detect, but the crate's real implementation in `src/lib.rs`/`agents.rs`/`entropy.rs` is
  the source of truth for exact behavior — read both.
- `cmd/allternit-api/src/vm_session_routes.rs` — existing, tested mechanism for "run something
  against a user-supplied repo": `CreateVmSessionRequest.git_remote: Option<String>` triggers a
  clone into an isolated workspace (`build_bootstrap_script` ~line 925-940 for the VM path,
  ~line 1061-1085 for the local-exec fallback path). Reuse this pattern/these helpers rather than
  writing a second git-clone implementation.
- `cowork_projects` table (`V1__baseline_schema.sql` ~line 507): `id, user_id, title, description,
  instructions, metadata, created_at, updated_at`. No repo/git_remote field yet — this is the
  closest existing "project" concept and the natural place to add one.
- GitHub OAuth connector already works (`cmd/allternit-api/src/connector_routes.rs`) — out of scope
  for this pass; a plain `git_remote` URL column is enough for v1. A repo-picker UI on top of the
  connector is future work.

## Why this matters (the point of the task)

Without project scoping, wiring the real crate in naively would make every user's "Run GC agent"
button scan the same one codebase (the API server's own working directory) — meaningless for a
multi-tenant product. The schema and route changes below are not optional polish; they're the
actual point of this task.

## Non-goals for this phase

- No real-time progress streaming for long analysis runs (synchronous response is fine for v1).
- No project-picker UI — a single resolved project (first available, or explicitly created one) is
  acceptable for v1 with a `TODO` comment marking where a real picker goes.
- No changes to the Evaluation Harness / Factory Task routes — GC only.
- No auto-fix execution (`issuesFixed` may remain 0 if the crate's auto-fix isn't wired) — finding
  and reporting real issues is the bar for this phase, not auto-remediation.
