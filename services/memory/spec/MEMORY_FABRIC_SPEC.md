# Allternit Memory Fabric Specification

**Version**: 0.1.0  
**Crate**: `allternit-memory-fabric`  
**Path**: `services/memory/data/memory-fabric`

---

## Purpose

This specification defines the unified memory/data fabric for the Allternit
platform. It standardizes how Rust services store, retrieve, query, and audit
memory, and how they integrate with the TypeScript Memory Agent.

---

## `MemoryProvider` Trait

Every memory backend must implement:

```rust
#[async_trait]
pub trait MemoryProvider: Send + Sync {
    async fn store(&self, key: &str, value: Value) -> Result<(), MemoryError>;
    async fn store_entry(&self, entry: MemoryEntry) -> Result<(), MemoryError>;
    async fn retrieve(&self, key: &str) -> Result<Option<Value>, MemoryError>;
    async fn retrieve_entry(&self, key: &str) -> Result<Option<MemoryEntry>, MemoryError>;
    async fn query(&self, query: &MemoryQuery) -> Result<Vec<MemoryEntry>, MemoryError>;
    async fn delete(&self, key: &str) -> Result<(), MemoryError>;
    async fn exists(&self, key: &str) -> Result<bool, MemoryError>;
    fn backend_type(&self) -> BackendType;
    fn capabilities(&self) -> MemoryCapabilities;
    async fn capabilities_async(&self) -> MemoryCapabilities;
    async fn stats(&self) -> Result<HashMap<String, Value>, MemoryError>;
    async fn ping(&self) -> Result<bool, MemoryError>;
}
```

Implementations must be `Send + Sync` and must return `MemoryError` for all
recoverable failures.

---

## Data Types

### `MemoryEntry`

```rust
pub struct MemoryEntry {
    pub id: String,
    pub key: String,
    pub value: Value,
    pub tags: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
    pub expires_at: Option<u64>,
    pub tenant_id: Option<String>,
    pub session_id: Option<String>,
    pub embedding: Option<Vec<f32>>,
}
```

### `MemoryQuery`

```rust
pub struct MemoryQuery {
    pub query: String,
    pub filters: HashMap<String, Value>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
    pub sort_by: Option<String>,
    pub ascending: Option<bool>,
    pub min_similarity: Option<f32>,
    pub tags: Vec<String>,
    pub tenant_id: Option<String>,
    pub session_id: Option<String>,
}
```

### `BackendType`

```rust
pub enum BackendType {
    SimpleInMemory,
    Redis,
    Qdrant,
    Sqlite,
    AdvancedFabric,
    MemoryAgentHttp,
    Custom(String),
}
```

---

## Ledger Format

The `HistoryLedger` writes one JSON object per line (JSONL) to the configured
path. Each line is a `LedgerEntry`:

```json
{
  "id": "<uuid>",
  "prev_hash": "<hex-sha256-or-null>",
  "content_hash": "<hex-sha256>",
  "content": { "op": "store", "key": "...", "value": ..., "timestamp": 1234567890 },
  "timestamp": 1234567890
}
```

### Hash algorithm

```rust
let canonical = serde_json::to_string(&content)?;
let hash = hex::encode(sha2::Sha256::digest(canonical));
```

### Integrity verification

A ledger is valid when:

1. Every entry's `content_hash` matches the recomputed hash of its `content`.
2. The first entry's `prev_hash` is `null`.
3. Each subsequent entry's `prev_hash` equals the previous entry's
   `content_hash`.

---

## Routing Rules

Rules are evaluated in priority order (highest first). The first matching rule
selects the backend. If no rule matches, `default_backend` is used.

| Condition | Semantics |
|-----------|-----------|
| `TagMatch { tag }` | `query.tags.contains(tag)` |
| `TenantSpecific { tenant_id }` | `query.tenant_id == Some(tenant_id)` |
| `SessionSpecific { session_id }` | `query.session_id == Some(session_id)` |
| `PersistenceRequired { required }` | Any registered provider has `persistent == required` |
| `PerformanceRequirement { max_latency_ms }` | Any registered provider meets latency |
| `SizeThreshold { max_size_bytes }` | Reserved; currently always matches |

Fallbacks are evaluated in declaration order when the selected backend's
`ping()` returns false and `fallback_enabled` is true.

---

## `MemoryFabric` Entry Point

```rust
pub struct MemoryFabric {
    plane: MemoryPlane,
    ledger: Arc<std::sync::Mutex<HistoryLedger>>,
}
```

`MemoryFabric` is the recommended interface for Rust services. It:

- Delegates reads/writes to the configured `MemoryPlane`.
- Appends an audit event to the `HistoryLedger` for every mutating operation.
- Exposes `verify_ledger()` for integrity checks.

---

## Integration with TypeScript Memory Agent

The Rust `MemoryAgentAdapter` implements `MemoryProvider` by translating calls
into HTTP requests to the TypeScript agent:

| Trait method | HTTP mapping |
|--------------|--------------|
| `store_entry` | `POST /api/ingest` |
| `query` | `GET /api/search?q={query}&limit={limit}` |
| `delete` | `DELETE /api/memory/{id}` |
| `stats` | `GET /stats` |

The adapter's `backend_type()` returns `BackendType::MemoryAgentHttp`.

---

## Error Contract

All errors are returned as `MemoryError`:

```rust
pub enum MemoryError {
    Io(std::io::Error),
    Serialization(serde_json::Error),
    NotFound(String),
    PermissionDenied(String),
    Validation(String),
    Connection(String),
    Timeout(String),
    CapacityExceeded(String),
    Backend(String),
    History(HistoryError),
}
```

Callers must not panic on `MemoryError`; they should log, degrade, or return a
service-level error.

---

## Versioning

This is version **0.1.0** of the fabric. Backwards-incompatible changes to the
`MemoryProvider` trait, `MemoryEntry` schema, or ledger format will be gated
behind a new major version and a migration path.
