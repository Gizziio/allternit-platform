# Checkpoint — ao/ba-0b-commrails (Bot Agents BA-0b + BA-1)

## Goal
Rename the Rails crate to CommRails and ship a live Desktop rail (no seed bots).

## Just did
- BA-0b: `rails/` → `commrails/`, package `allternit-commrails`, bins `allternit-commrails` + `-service` + nested `commrails`. One-release shims (old bin names, `/api/rails`, `ALLTERNIT_RAILS_*`, `commrails/compat`). `cargo test -p allternit-commrails` 5/5.
- BA-1: seed sessions dropped; `GET /api/commrails/visibility` (+ `/api/rails` alias) from PeerRegistry; Sessions + Needs you panels in ShellRail. vitest `commrails-store.test.ts` 6/6.
- PR #284 opened. Merging origin/main to make the merge commit clean.

## Next
- Push merge, `gh pr merge 284 --merge`.
- Do not start BA-3 (brain bind) in this PR.

## Open questions
- None for this PR. Live ao-engine pane states (blocked vs idle) still need a later HTTP bridge; peers only this phase.
