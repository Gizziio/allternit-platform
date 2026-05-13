# Option B: Foundation Rebuild — sqlx + Shared Schema Crate

**Status**: Documented for future execution. NOT current work.
**Estimated effort**: ~80-100 hours.
**Trigger**: When moving to multi-tenant cloud / PostgreSQL, or when team has 3+ weeks of dedicated backend time.

---

## Why This Exists

The current backend uses `rusqlite` with hand-written SQL and hand-written row structs (`AgentRow`, `ArtifactRow`). This works for a desktop/SQLite product but has limits:
- SQL typos are caught at runtime, not compile time
- Row structs can drift from the actual DB schema
- No connection pooling — SQLite file is opened/closed per request
- Two schema sources (Prisma in Next.js, raw SQL in Rust `db.rs`)
- `tokio::task::spawn_blocking` adds thread-pool overhead per DB call

This document is the blueprint for when we decide to fix those limitations.

---

## Target Architecture

```
allternit-db-schema/          ← NEW crate
  ├── migrations/
  │   ├── V1__initial_schema.sql
  │   └── V2__add_fts5.sql
  ├── src/
  │   └── lib.rs              ← Re-exports types, constants
  └── schema.sql              ← Single source of truth

allternit-api/
  ├── Cargo.toml              ← depends on allternit-db-schema
  └── src/
      └── ...                 ← Uses sqlx, not rusqlite
```

---

## Step 1: Switch from rusqlite to sqlx

### Dependencies

```toml
[dependencies]
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite", "uuid", "chrono"] }
# Remove: rusqlite
```

### Dev Tooling

```bash
cargo install sqlx-cli
export DATABASE_URL="sqlite://$HOME/data/allternit.db"
sqlx database create
sqlx migrate run
```

### Why sqlx

| Feature | Benefit |
|---------|---------|
| `query_as!()` | Compile-time SQL validation — typos caught by `cargo check` |
| Async-native | Remove ALL `tokio::task::spawn_blocking` wrappers |
| Connection pool | `SqlitePool` reuses connections, eliminates open/close overhead |
| Migrations | `sqlx migrate` built-in, no `refinery` needed |
| Database-agnostic | Swap SQLite → PostgreSQL by changing `DATABASE_URL` |

---

## Step 2: Create `allternit-db-schema` Crate

This crate becomes the **single source of truth** for the database schema.

### `schema.sql`

One SQL file that defines every table, index, trigger, and FTS virtual table.
Both Rust (`sqlx migrate`) and Next.js (Drizzle) read this file.

### `src/lib.rs`

```rust
//! Shared database schema constants and types.

pub const MIGRATIONS: &[&str] = &[
    include_str!("../migrations/V1__initial_schema.sql"),
    include_str!("../migrations/V2__add_fts5.sql"),
];

// Re-export table names, column names for compile-time safety
pub mod tables {
    pub const ARTIFACTS: &str = "artifacts";
    pub const ARTIFACT_SECTIONS: &str = "artifact_sections";
    // ...
}
```

### Next.js Integration

Replace Prisma with Drizzle:

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './schema.ts',        // Generated from schema.sql
  dialect: 'sqlite',
  dbCredentials: { url: 'file:./data/allternit.db' },
});
```

Use `drizzle-kit introspect` or a codegen script to generate `schema.ts` from `schema.sql`.

---

## Step 3: Generate Types from Schema

Instead of hand-written structs:

```rust
// OLD — hand-written, can drift
struct AgentRow {
    id: String,
    name: String,
    // ... 20 fields
}

// NEW — generated from DB at compile time
let agents = sqlx::query_as!(
    Agent,
    "SELECT id, name, description, type, model, provider, ... FROM agents WHERE user_id = ?",
    user_id
)
.fetch_all(&pool)
.await?;
```

`sqlx prepare` generates `.sqlx/` files that allow offline compilation (CI doesn't need DB).

---

## Step 4: Migrate Route Files

Every route file needs rewriting from rusqlite to sqlx. Example transformation:

### Before (rusqlite)
```rust
async fn list_agents(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || {
        let conn = db.connect()?;
        let mut stmt = conn.prepare("SELECT ...")?;
        stmt.query_map(...)?.collect::<Result<Vec<_>, _>>()
    }).await;
    // ...
}
```

### After (sqlx)
```rust
async fn list_agents(State(state): State<Arc<AppState>>) -> Result<Json<Vec<Agent>>, ApiError> {
    let agents = sqlx::query_as!(
        Agent,
        "SELECT id, name, description, type, model, provider, ... FROM agents WHERE user_id = ?",
        user_id
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(agents))
}
```

### Key changes per file:
1. Remove `tokio::task::spawn_blocking`
2. Replace `rusqlite::params![]` with sqlx positional params
3. Replace hand-written structs with `sqlx::query_as!` or derive macros
4. Return `Result<Json<T>, ApiError>` instead of `impl IntoResponse`

---

## Step 5: Connection Pooling

```rust
// In main.rs
let pool = SqlitePool::connect(&db_url).await?;
```

Pool options:
- `max_connections: 10` (SQLite handles concurrency via WAL)
- `acquire_timeout: 5s`

---

## Step 6: PostgreSQL Migration Path

When ready for cloud/multi-tenant:

1. Change `DATABASE_URL` from `sqlite://...` to `postgres://...`
2. Run `sqlx migrate run` (same migrations, PostgreSQL syntax)
3. Data migration: export SQLite → import PostgreSQL (one-time script)
4. Zero code changes in route handlers

This is the killer feature of sqlx. The query strings stay the same if written to standard SQL.

---

## Effort Estimate

| Task | Hours |
|------|-------|
| Set up sqlx + tooling | 4 |
| Create `allternit-db-schema` crate | 6 |
| Convert `db.rs` + migrations | 4 |
| Convert auth module | 3 |
| Convert artifact routes | 6 |
| Convert agent routes | 5 |
| Convert conversation routes | 4 |
| Convert workflow routes | 4 |
| Convert cowork routes | 5 |
| Convert memory routes | 4 |
| Convert remaining routes | 8 |
| Update tests | 6 |
| Update Next.js to Drizzle | 8 |
| CI/CD updates | 4 |
| Buffer / debugging | 15 |
| **Total** | **~90** |

---

## Risks

| Risk | Mitigation |
|------|------------|
| sqlx build time increase | Use `sqlx prepare` for offline builds in CI |
| Query syntax differences (SQLite vs PG) | Write ANSI SQL, test on both in CI |
| Big-bang rewrite introduces bugs | Do it in a branch, run full integration test suite before merge |
| Next.js Drizzle migration | Keep Prisma during transition, migrate incrementally |

---

## Decision Log

- **2026-05-06**: Decided to defer Option B. Current rusqlite backend is functional for desktop/local-first use case. Option A (hardening) delivers A+ faster.
- **Revisit when**: Multi-tenant cloud launch, or team has 3+ dedicated weeks.
