# PHASE E1 TASK — rails mail: identities + typed envelopes + inbox/outbox

You are the executor. `.steering/spec.md` (Phase E1: R1–R4 + acceptance) is the
source of truth — read it first, including the EXPLICIT NON-GOAL and BUILDER
NOTES in R2. They are binding.

## Workflow rules (mandatory)

1. Update `.steering/checkpoint.md` at checkpoints; `[steering]` messages are
   authoritative.
2. Done + verified → `docs/RAILS_MAIL_E1_NOTES.md` with YAML frontmatter
   (`status`, `files_changed`, `deviations`, `remaining`), then
   `touch docs/RAILS_MAIL_E1_NOTES.sentinel`.
3. Then commit: `git add rails cmd .steering docs && git commit -m "feat(rails): mail identities, typed envelopes, per-agent inbox/outbox (E1)"`.
   A gate reviews; fix and retry if blocked.

## Binding constraints from the steered spec

- EXPLICIT NON-GOAL: do NOT touch `mail_share`/`share_asset`/
  `MailAssetShared` or its ReceiptRecord side effect (mod.rs:651-715). The
  discovery pipeline's `wih:pipeline-*` traffic flows through it and must
  work byte-for-byte as today.
- Inbox/outbox projections MUST skip non-`MessageSent` event types — the real
  `wih:pipeline-*` threads contain only `MailAssetShared` events with no
  from/to fields; a projection that assumes typed envelopes will break.
- E1-R4 requires CONSOLIDATING the thread-validation/default pattern inlined
  at three call sites (mail_send mod.rs:548, mail_share mod.rs:665,
  mail_decide mod.rs:742) into ONE shared helper; default thread becomes
  `mail:general`; validation accepts `dag:`/`wih:`/`mail:` prefixes. Do not
  spot-fix one site. (The helper is shared infrastructure — mail_share keeps
  its behavior, just calls the same helper.)

## Build (per spec R1-R4)

- `rails/src/mail/agents.rs`: agent registry — `AgentRegistered` ledger
  events, projection under `.allternit/mail/agents/`, idempotent register.
- `rails/src/mail/types.rs`: typed envelope (from_agent, to_agents, subject,
  importance, ack_required, body_path) + backward-compatible send path.
- Message bodies as files under `.allternit/mail/messages/`.
- HTTP: agents register/list, typed send, inbox/:agent_id, outbox/:agent_id —
  following existing handler conventions (XxxRequest structs, Json errors).
  Handler tests: use the office_cli_routes.rs oneshot precedent (the B2
  executor used it — see cmd/allternit-api handler tests).

## Verification (required)

- `cargo test -p allternit-agent-system-rails` passes (new unit tests:
  registry idempotency, typed+legacy send coexistence, inbox skips
  MailAssetShared events, thread-id consolidation incl. mail:general default).
- `cargo build -p allternit-api` compiles. Record both in NOTES.
- Verify the pipeline's share path still works: POST a test share to
  `wih:pipeline-probe` via the running dev API (localhost:8013) or document
  why not possible from the worktree.
