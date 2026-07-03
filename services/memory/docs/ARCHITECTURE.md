# Memory & Data Fabric Architecture

## Goals

1. Provide a single, well-defined Rust interface for storing, retrieving, and
   querying memory across the Allternit platform.
2. Make memory backends pluggable (in-memory, Redis, Qdrant, SQLite, HTTP agent).
3. Guarantee auditability through an append-only, cryptographically chained
   ledger.
4. Keep the TypeScript Memory Agent as the long-term semantic-memory
   implementation while exposing it to Rust via the same trait.

---

## Components

### `allternit-memory-fabric`

The canonical crate is located at `services/memory/data/memory-fabric`.

#### Core traits

- **`MemoryProvider`** — async trait implemented by every backend.
- **`MemoryPlane`** — implements `MemoryProvider` by routing operations to
  registered backends.
- **`MemoryRouter`** — selects backends using rules, performance thresholds,
  and fallback logic.

#### Data types

- **`MemoryEntry`** — standardized memory record with metadata, tags, embedding.
- **`MemoryQuery`** — portable query structure.
- **`BackendType`** — enum of supported backends.
- **`MemoryCapabilities`** / **`PerformanceCharacteristics`** — capability
  discovery.

#### Ledger

- **`HistoryLedger`** — append-only JSONL file with SHA-256 content hashes and
  `prev_hash` chaining.
- **`LedgerEntry`** — individual ledger record.

The ledger was adapted from the original `allternit-history` crate and is now
part of the fabric.

#### Built-in providers

- **`InMemoryProvider`** — fast, non-persistent provider for tests and simple
  deployments.

### Top-level `services/memory` crate

- Exposes a simple HTTP-enabled memory service.
- Implements `MemoryProvider` for an in-memory store.
- Provides `MemoryAgentAdapter`, an HTTP client to the TypeScript Memory Agent
  that also implements `MemoryProvider`.

### `services/memory/observation`

- Axum service that records GUI/system observations.
- Writes observations into the fabric's `HistoryLedger`.

### TypeScript Memory Agent (`services/memory/agent/`)

- Always-on agent using Ollama/Qwen for local LLM inference.
- Stores memories in SQLite with vector embeddings.
- Exposes an HTTP API consumed by the Rust `MemoryAgentAdapter`.

---

## Data Flow

```
Rust Service
    │
    ▼
┌─────────────────┐
│ MemoryPlane     │
│ (router + rules)│
└────────┬────────┘
         │
    ┌────┴────┬────────────┐
    ▼         ▼            ▼
InMemory  TypeScript     Future:
Provider    Agent         Redis / Qdrant / SQLite
(SQLite + Ollama)
    │         │
    ▼         ▼
┌─────────────────────┐
│ HistoryLedger       │
│ (audit log, JSONL)  │
└─────────────────────┘
```

Every mutating operation (`store`, `store_entry`, `delete`) is recorded as a
JSON event in the `HistoryLedger`. The ledger can be verified independently
with `HistoryLedger::verify_integrity()`.

---

## Routing Logic

`MemoryRouter::determine_backend` evaluates rules in priority order:

1. `TagMatch` — route by memory tag.
2. `TenantSpecific` / `SessionSpecific` — route by tenant or session.
3. `PersistenceRequired` — route to a persistent backend.
4. `PerformanceRequirement` — route by latency/throughput.
5. `SizeThreshold` — reserved for size-based routing.

If no rule matches, the configured `default_backend` is used. If the preferred
backend fails `ping`, fallbacks are tried when `fallback_enabled` is true.

---

## Error Handling

All fabric operations return `Result<T, MemoryError>`. Errors include IO,
serialization, not-found, connection, validation, and history-integrity errors.
This lets callers handle memory failures uniformly regardless of backend.

---

## Future Work

- Implement persistent providers (Redis, Qdrant, SQLite) inside the fabric.
- Migrate the experimental `state/memory` advanced memory service onto the
  fabric once its missing SDK/policy/router dependencies are available.
- Add schema versioning and migration support to the ledger.
- Add telemetry hooks for provider latency and fallback events.
