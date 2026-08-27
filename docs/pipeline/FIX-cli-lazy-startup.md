# Steering spec — rails CLI lazy startup fix

<!-- Small bug-fix phase. Source of truth. -->

## Context

`rails/src/bin/allternit-rails.rs` `main()` (lines ~386-430) eagerly constructs
Ledger, Leases, ReceiptStore, Index, Vault, and Gate for EVERY subcommand —
including ones that need none of the SQLite-backed stores (`ticket ready`,
`graph insights`, `mail *` reads). Two independent executors confirmed the
result: any CLI invocation can abort with `SQLITE_CANTOPEN` from
`Leases::new`/`Index::new` (sqlx opening `.allternit/*/…db`), making the
entire CLI surface — including the A1/B2 commands just shipped — unusable in
some environments.

## Requirements

- [ ] R1: WHEN any CLI subcommand runs, THE SYSTEM SHALL construct only the
  stores that subcommand actually uses: SQLite-backed stores (Leases, Index)
  and any other heavy subsystems SHALL be initialized lazily (on first use by
  the invoked subcommand), not in `main()` before dispatch.
- [ ] R2: WHEN a SQLite-backed store IS initialized, THE SYSTEM SHALL open its
  database with create-if-missing semantics (dir + db file), so a fresh
  checkout or new workspace never fails with SQLITE_CANTOPEN.
- [ ] R3: WHEN `allternit-rails ticket ready` and `allternit-rails graph
  insights` run in a fresh temp directory, THE SYSTEM SHALL exit 0 (or a
  domain-appropriate empty result) without initializing Leases/Index at all —
  verified by a test or scripted check that observes no `.allternit/leases/`
  or `.allternit/index/` directory created.

## Out of scope

- Behavior changes to any subcommand's output; refactoring the Gate/Vault
  wiring beyond what laziness requires.

## Acceptance (Gherkin)

- Scenario: light subcommands stay light
  Given a fresh temp directory
  When `allternit-rails ticket ready` runs
  Then it exits 0 and neither `.allternit/leases/` nor `.allternit/index/`
  exists afterward.
- Scenario: heavy subcommands self-heal
  Given a fresh temp directory
  When a subcommand that needs the index runs
  Then the db file is created on demand and the command succeeds.
