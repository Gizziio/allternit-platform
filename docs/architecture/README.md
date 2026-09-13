# Allternit Agent/Cowork Architecture Index

This directory contains the canonical architecture documentation for the A:// coordination model and the Cowork/Bot execution stack.

## Start here

### `A_PROTOCOL.md`

**Normative architecture contract.**

Defines:

- what A:// is and is not;
- Al versus the `a://` protocol namespace;
- principal identity;
- addressing;
- intent/run concepts;
- delegation;
- attribution;
- conformance;
- terminology rules;
- implemented/partial/planned boundaries.

If another document disagrees with this one about A:// semantics, reconcile the conflict explicitly rather than silently keeping two models.

### `FABRIC_TRANSPORT.md`

**Normative execution-ownership contract for the current worker transport.**

Defines:

- worker authentication;
- capability eligibility;
- atomic claim;
- leases and generations;
- heartbeat/renew/expiry;
- restart recovery;
- approval-to-lease binding;
- attributed completion;
- stable error vocabulary;
- conformance/failure recovery test.

Fabric Transport is an implementation layer under A://. It is not synonymous with A:// itself.

### `COWORK_A_PROTOCOL_ARCHITECTURE.md`

**Product/runtime architecture.**

Defines the relationship between:

- Al / A:// user-facing identity;
- Gizzi;
- user-created bots;
- Cowork;
- reach surfaces;
- memory/connector boundaries;
- model and compute independence.

## Developer guide

See:

```text
docs/development/A_PROTOCOL_DEVELOPER_GUIDE.md
```

Use it when adding a worker, bot type, trigger, connector, protected action, or Cowork view.

## Canonical code entry points

### Worker-facing HTTP transport

```text
cmd/allternit-api/src/rails/fabric_transport_routes.rs
```

### Transport types and wire errors

```text
infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/transport.rs
```

### Canonical persisted execution operations

```text
infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/sqlite_store.rs
```

### Run/job state machine and runtime manager

```text
infrastructure/executor/cowork/cowork/allternit-cowork-runtime/src/run.rs
```

### Startup, rehydration, and sweeper wiring

```text
cmd/allternit-api/src/main.rs
```

### Schema migrations

```text
cmd/allternit-api/migrations/V149__cowork_principals.sql
cmd/allternit-api/migrations/V150__cowork_job_lease_columns.sql
cmd/allternit-api/migrations/V151__cowork_event_attribution.sql
cmd/allternit-api/migrations/V155__cowork_approval_bindings.sql
```

## Runtime truth hierarchy

When implementation surfaces disagree, use this hierarchy:

```text
canonical persisted run/job state
 -> current valid Fabric Transport lease
 -> attributed run events / ledger
 -> Cowork UI projection
 -> conversational/model narration
```

A model response is never authoritative proof that work was dispatched, executed, approved, or completed.

## Terminology lock

Use:

- **A://** — branded mark / user-facing Coworker name; pronounced Al.
- **Al** — persistent user-facing principal/persona.
- **`a://`** — internal protocol namespace.
- **Fabric Transport** — worker/lease transport.
- **CommRails** — peer/message transport.
- **Cowork** — control room.
- **Gizzi** — code/terminal technical worker.
- **Bot** — independently permissioned persistent worker principal.

Do not reintroduce older `A:// dispatcher` naming for the HTTP/runtime worker transport. Historical commits may use it, but current terminology is **Fabric Transport**.

## Documentation change policy

Any PR changing one of the following should update the relevant documentation in the same change:

- principal model or address format;
- worker authentication;
- capability vocabulary/semantics;
- run/job lifecycle;
- lease rules;
- approval scope;
- attribution;
- error codes;
- route paths;
- source-of-truth storage;
- Al/Gizzi/Bot responsibility boundaries;
- Cowork's control-room contract.

## Conformance principle

The critical rule is:

> A component that only stores an `a://` identifier is not A:// conformant.

A:// conformance is behavioral. Identity, execution ownership, policy, attribution, recovery, and result semantics must actually be implemented for the declared role.
