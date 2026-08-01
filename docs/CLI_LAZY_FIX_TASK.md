# FIX TASK — rails CLI lazy startup

You are the executor. `.steering/spec.md` is the source of truth (R1–R3 +
Gherkin). This is a small, surgical bug fix — resist expanding it.

## Context (verified)

`rails/src/bin/allternit-rails.rs` `main()` eagerly builds Ledger, Leases,
ReceiptStore, Index, Vault, Gate for EVERY subcommand (~lines 386-430).
Leases/Index use sqlx SQLite and can abort startup with SQLITE_CANTOPEN,
breaking even subcommands that never touch them (`ticket ready`,
`graph insights`). Confirmed independently by two prior executors.

## Workflow rules

1. Update `.steering/checkpoint.md` at checkpoints; [steering] is authoritative.
2. Done → `docs/CLI_LAZY_FIX_NOTES.md` with YAML frontmatter, then
   `touch docs/CLI_LAZY_FIX_NOTES.sentinel`.
3. Then commit: `git add rails .steering docs && git commit -m "fix(rails): lazy-init SQLite stores in CLI startup"`.
   A gate reviews; fix and retry if blocked.

## Approach guidance

- Laziness per subcommand: restructure main() so SQLite-backed stores
  (Leases, Index) — and Gate/Vault if they depend on them — are only built
  for the subcommands that need them (match on the parsed command BEFORE
  constructing; construct per-branch or via lazy accessors like OnceCell/
  async OnceCell already in the dependency tree — check Cargo.toml first,
  no new crates).
- R2: ensure the sqlx connect uses create-if-missing (check
  `SqliteConnectOptions` — `create_if_missing(true)` — in Leases/Index and
  the new mail index from E2 for consistency; fix all three if flag absent).
- R3 verification: script or test — in a fresh temp dir, run
  `allternit-rails ticket ready`, assert exit 0 AND that
  `.allternit/leases/` + `.allternit/index/` were NOT created. Run a
  SQLite-needing subcommand in another fresh dir, assert the db is created
  and exit 0. Record exact commands + output in NOTES.
- `cargo test -p allternit-agent-system-rails` must pass.

## Constraints

- No behavior change to any subcommand's output.
- Surgical: only bin/allternit-rails.rs + the connect-options fixes.
