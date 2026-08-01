# Steering checkpoint

<!-- The working agent maintains this file. The Stop hook consults the steering
     agent ONLY when this file's content changes since the last review. Update it
     at meaningful checkpoints: a subtask finished, a design decision made,
     before a risky change. Remove questions once they are answered. -->

## Goal

Phase B2 of the rails graph track (spec: `.steering/spec.md`, B2-R1 + B2-R2 with
Gherkin acceptance): expose B1's `GraphAnalytics::compute_insights` as a robot
surface — three HTTP endpoints under `/api/rails/graph/` (`insights`, `triage`,
`impact/:ticket_id`) plus `rails graph` CLI subcommands printing identical JSON,
with shared view-model builders in `rails/src/graph/views.rs`. HOW:
`docs/RAILS_GRAPH_B2_TASK.md`.

## Just did

All B2 pieces complete and verified: `cargo test -p
allternit-agent-system-rails` (67 lib + 5 invariants + 1 doc-test, 0
failed), `cargo build -p allternit-api` compiles, `cargo test -p
allternit-api --lib rails::tests` passes (diamond over HTTP incl. 404/400).
`docs/RAILS_GRAPH_B2_NOTES.md` written + sentinel touched. Deviations
recorded in NOTES: GraphAnalytics shared via RailsState field; handler test
added (precedent exists); CLI smoke blocked by a PRE-EXISTING SQLite
startup failure that also breaks `ticket ready` on this repo.

## Next

Commit: `git add rails cmd .steering docs && git commit -m "feat(rails):
graph robot surface — HTTP + CLI insights/triage/impact (B2)"`.

## Open questions

- (none)
