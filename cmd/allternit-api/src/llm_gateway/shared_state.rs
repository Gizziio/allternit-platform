//! Shared cross-process gateway state (P2.9), backed by SQLite.
//!
//! The gateway's failover cooldown tracker ([`super::failover::CooldownTracker`])
//! and the per-key/per-org RPM limiters ([`super::auth`]) are historically
//! in-memory per process, which breaks down the moment a second replica
//! serves traffic: replica A's cooldown is invisible to replica B, and each
//! replica admits a full rate-limit window. This module moves both into the
//! node's existing SQLite database (`DbHandle`) so every replica pointed at
//! the same database file shares the state.
//!
//! Backend choice: the gap note allowed Redis or SQLite. SQLite is chosen
//! because the gateway already owns exactly one authoritative SQLite database
//! per deployment and every replica attaches to it — no new service, no new
//! credentials, no new failure mode. The stores are small interfaces, so a
//! Redis backend can be added later without touching call sites.
//!
//! Env gate: `GATEWAY_SHARED_STATE=sqlite` enables the shared stores;
//! anything else (including unset) keeps today's pure in-memory behavior, so
//! single-process deployments are byte-for-byte unchanged. `main` calls
//! [`init`] when the gate is on.
//!
//! Performance pattern: both stores are write-through to SQLite with a
//! short-TTL in-memory L1 in front of reads, so the request hot path stays
//! fast (one cached lookup per key; one UPSERT per request for the
//! rate limiter, which must be authoritative to mean anything cross-process).
//!
//! Failure pattern: every DB error is fail-open — a hiccup logs a warning,
//! bumps [`db_error_count`], and behaves as "no cooldown" / "request
//! allowed". Steering and rate limiting are best-effort; the request path
//! never hard-fails because the state database did.

use rusqlite::OptionalExtension;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use tracing::warn;

use crate::db::DbHandle;

/// Fixed rate-limit bucket width (one minute — the limiters are per-minute).
pub const RATE_WINDOW_MS: i64 = 60_000;

/// How long an L1 cooldown read stays valid before the next read goes back
/// to SQLite. 250ms keeps fallback selection hot without letting a
/// replica-set cooldown go unnoticed for a meaningful fraction of the
/// shortest (5s) cooldown.
const COOLDOWN_L1_TTL: Duration = Duration::from_millis(250);

/// Count of fail-open events (DB errors absorbed by the shared stores).
/// Exposed for tests and diagnostics; `metrics.rs` export is deferred while
/// that file is owned by concurrent work.
static DB_ERRORS: AtomicU64 = AtomicU64::new(0);

/// Number of DB errors the shared stores have absorbed (fail-open events).
pub fn db_error_count() -> u64 {
    DB_ERRORS.load(Ordering::Relaxed)
}

fn note_db_error(context: &str, error: &dyn std::fmt::Display) {
    DB_ERRORS.fetch_add(1, Ordering::Relaxed);
    warn!(%context, error = %error, "shared gateway state DB error; failing open");
}

/// Injectable wall clock, epoch milliseconds. Stored timestamps are epoch ms
/// because `Instant` is process-local and meaningless across replicas.
type Clock = Arc<dyn Fn() -> i64 + Send + Sync>;

fn system_epoch_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn system_clock() -> Clock {
    Arc::new(system_epoch_ms)
}

/// Whether shared state is enabled: `GATEWAY_SHARED_STATE=sqlite`.
pub fn enabled() -> bool {
    parse_enabled(std::env::var("GATEWAY_SHARED_STATE").ok().as_deref())
}

fn parse_enabled(value: Option<&str>) -> bool {
    matches!(value, Some("sqlite"))
}

/// Process-wide shared state, installed by [`init`] at startup when the env
/// gate is on.
pub struct SharedState {
    pub cooldowns: SqliteCooldownStore,
    pub rate_limiter: SharedRateLimiter,
}

static SHARED: once_cell::sync::OnceCell<SharedState> = once_cell::sync::OnceCell::new();

/// Install the process-wide shared stores from the node's database. No-op
/// (returns false) when the env gate is off; idempotent-safe (second call
/// keeps the first install, matching the single-startup call in `main`).
pub fn init(db: DbHandle) -> bool {
    if !enabled() {
        return false;
    }
    let state = SharedState {
        cooldowns: SqliteCooldownStore::new(db.clone()),
        rate_limiter: SharedRateLimiter::new(db),
    };
    let _ = SHARED.set(state);
    true
}

/// The process-wide shared stores, when [`init`] installed them.
pub fn get() -> Option<&'static SharedState> {
    SHARED.get()
}

// ─── Cooldown store ─────────────────────────────────────────────────────────

struct CooldownL1Entry {
    fetched_at: Instant,
    /// Raw `cooldown_until_ms` from the row, or None (no active cooldown).
    expiry_ms: Option<i64>,
}

/// SQLite-backed (provider_id, model_id) → cooldown store. Read-through with
/// a 250ms L1, write-through on record/clear, fail-open on DB errors.
#[derive(Clone)]
pub struct SqliteCooldownStore {
    db: DbHandle,
    clock: Clock,
    l1: Arc<RwLock<HashMap<(String, String), CooldownL1Entry>>>,
}

impl std::fmt::Debug for SqliteCooldownStore {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SqliteCooldownStore")
            .field("db", &self.db)
            .finish_non_exhaustive()
    }
}

impl SqliteCooldownStore {
    pub fn new(db: DbHandle) -> Self {
        Self::with_clock(db, system_clock())
    }

    /// Clock-injected constructor for tests (no sleeping).
    pub fn with_clock(db: DbHandle, clock: Clock) -> Self {
        Self {
            db,
            clock,
            l1: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn now_ms(&self) -> i64 {
        (self.clock)()
    }

    fn l1_get(&self, key: &(String, String)) -> Option<Option<i64>> {
        let cache = self.l1.read().expect("cooldown L1 poisoned");
        let entry = cache.get(key)?;
        (entry.fetched_at.elapsed() < COOLDOWN_L1_TTL).then_some(entry.expiry_ms)
    }

    fn l1_put(&self, key: (String, String), expiry_ms: Option<i64>) {
        self.l1.write().expect("cooldown L1 poisoned").insert(
            key,
            CooldownL1Entry {
                fetched_at: Instant::now(),
                expiry_ms,
            },
        );
    }

    fn l1_invalidate(&self, key: &(String, String)) {
        self.l1
            .write()
            .expect("cooldown L1 poisoned")
            .remove(key);
    }

    /// Current active cooldown expiry (epoch ms) for the provider/model, or
    /// None when healthy. Fail-open: DB errors return None.
    pub fn cooling_until(&self, provider_id: &str, model_id: &str) -> Option<i64> {
        let key = (provider_id.to_string(), model_id.to_string());
        let now = self.now_ms();
        let cached = self.l1_get(&key);
        let expiry = match cached {
            Some(value) => value,
            None => {
                let value = self.read_row(&key, now);
                self.l1_put(key, value);
                value
            }
        };
        expiry.filter(|expiry| *expiry > now)
    }

    fn read_row(&self, key: &(String, String), now: i64) -> Option<i64> {
        let result = self.db.connect().and_then(|conn| {
            conn.query_row(
                "SELECT cooldown_until_ms FROM gateway_cooldowns
                 WHERE provider_id = ?1 AND model_id = ?2 AND cooldown_until_ms > ?3",
                rusqlite::params![key.0, key.1, now],
                |row| row.get::<_, i64>(0),
            )
            .optional()
        });
        match result {
            Ok(value) => value,
            Err(err) => {
                note_db_error("cooldown read", &err);
                None
            }
        }
    }

    /// Write-through: record a cooldown expiring at `until_ms` (epoch).
    /// Fail-open: DB errors are logged and absorbed; the L1 is invalidated so
    /// the next read retries the database rather than serving a stale hit.
    pub fn record_cooldown(&self, provider_id: &str, model_id: &str, until_ms: i64, reason: &str) {
        let key = (provider_id.to_string(), model_id.to_string());
        let result = self.db.connect().and_then(|conn| {
            conn.execute(
                "INSERT INTO gateway_cooldowns (provider_id, model_id, cooldown_until_ms, reason, updated_at)
                 VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
                 ON CONFLICT(provider_id, model_id) DO UPDATE SET
                     cooldown_until_ms = excluded.cooldown_until_ms,
                     reason = excluded.reason,
                     updated_at = CURRENT_TIMESTAMP",
                rusqlite::params![key.0, key.1, until_ms, reason],
            )
            .map(|_| ())
        });
        match result {
            Ok(()) => self.l1_put(key, Some(until_ms)),
            Err(err) => {
                note_db_error("cooldown write", &err);
                self.l1_invalidate(&key);
            }
        }
    }

    /// Write-through: clear any cooldown for the provider/model (a success
    /// outcome clears the record, mirroring the in-memory tracker).
    pub fn clear(&self, provider_id: &str, model_id: &str) {
        let key = (provider_id.to_string(), model_id.to_string());
        let result = self.db.connect().and_then(|conn| {
            conn.execute(
                "DELETE FROM gateway_cooldowns WHERE provider_id = ?1 AND model_id = ?2",
                rusqlite::params![key.0, key.1],
            )
            .map(|_| ())
        });
        match result {
            Ok(()) => self.l1_put(key, None),
            Err(err) => {
                note_db_error("cooldown clear", &err);
                self.l1_invalidate(&key);
            }
        }
    }
}

// ─── Rate limiter ───────────────────────────────────────────────────────────

/// SQLite-backed fixed-window (one-minute) rate limiter. The counter itself
/// is authoritative in the database — one atomic UPSERT ... RETURNING per
/// request — because an approximate cross-process limiter is no limiter at
/// all. The L1 is a *denial* cache only: once a scope is over its limit for
/// the current window, further requests are rejected from memory until the
/// window ends instead of hammering the database.
///
/// Semantics note: the in-memory limiters use a sliding window; the shared
/// limiter uses fixed one-minute buckets (the standard shape for shared RPM
/// counters). Fixed windows admit up to ~2× the limit across a boundary —
/// acceptable for abuse steering, and documented here deliberately.
#[derive(Clone)]
pub struct SharedRateLimiter {
    db: DbHandle,
    clock: Clock,
    /// scope → denied-until epoch ms.
    denials: Arc<RwLock<HashMap<String, i64>>>,
}

impl SharedRateLimiter {
    pub fn new(db: DbHandle) -> Self {
        Self::with_clock(db, system_clock())
    }

    /// Clock-injected constructor for tests (no sleeping).
    pub fn with_clock(db: DbHandle, clock: Clock) -> Self {
        Self {
            db,
            clock,
            denials: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Record one request for `scope` against `limit` (requests per minute).
    /// Returns false when the request should be rejected. Fail-open: DB
    /// errors allow the request.
    pub fn check_and_record(&self, scope: &str, limit: usize) -> bool {
        let now = (self.clock)();
        if let Some(&until) = self
            .denials
            .read()
            .expect("rate-limit denial cache poisoned")
            .get(scope)
        {
            if until > now {
                return false;
            }
        }

        let window_start = now - now.rem_euclid(RATE_WINDOW_MS);
        let result = self.db.connect().and_then(|conn| {
            let count = conn.query_row(
                "INSERT INTO gateway_rate_limit_buckets (scope, window_start_ms, count, updated_at)
                 VALUES (?1, ?2, 1, CURRENT_TIMESTAMP)
                 ON CONFLICT(scope, window_start_ms) DO UPDATE SET
                     count = count + 1,
                     updated_at = CURRENT_TIMESTAMP
                 RETURNING count",
                rusqlite::params![scope, window_start],
                |row| row.get::<_, i64>(0),
            )?;
            if count == 1 {
                // First request of a fresh window: prune this scope's
                // expired buckets so the table stays O(active windows).
                conn.execute(
                    "DELETE FROM gateway_rate_limit_buckets WHERE scope = ?1 AND window_start_ms < ?2",
                    rusqlite::params![scope, window_start],
                )?;
            }
            Ok(count)
        });

        match result {
            Ok(count) => {
                if count as usize > limit.max(1) {
                    self.denials
                        .write()
                        .expect("rate-limit denial cache poisoned")
                        .insert(scope.to_string(), window_start + RATE_WINDOW_MS);
                    false
                } else {
                    true
                }
            }
            Err(err) => {
                note_db_error("rate limit check", &err);
                true
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixed_clock(ms: i64) -> Clock {
        Arc::new(move || ms)
    }

    #[test]
    fn env_gate_parsing() {
        assert!(!parse_enabled(None));
        assert!(!parse_enabled(Some("")));
        assert!(!parse_enabled(Some("redis")));
        assert!(!parse_enabled(Some("SQLite")));
        assert!(parse_enabled(Some("sqlite")));
    }

    #[test]
    fn cooldown_store_round_trip_and_expiry() {
        let db = DbHandle::new_memory().unwrap();
        let store = SqliteCooldownStore::with_clock(db, fixed_clock(10_000));

        assert_eq!(store.cooling_until("openai", "gpt-4o"), None);
        store.record_cooldown("openai", "gpt-4o", 15_000, "rate_limited");
        assert_eq!(store.cooling_until("openai", "gpt-4o"), Some(15_000));

        // An expiry at/behind the clock is not a cooldown.
        let store_later = SqliteCooldownStore::with_clock(
            store.db.clone(),
            fixed_clock(15_000),
        );
        assert_eq!(store_later.cooling_until("openai", "gpt-4o"), None);
    }

    #[test]
    fn cooldown_visible_across_two_store_instances() {
        // Two stores on one database simulate two replicas.
        let db = DbHandle::new_memory().unwrap();
        let replica_a = SqliteCooldownStore::with_clock(db.clone(), fixed_clock(1_000));
        let replica_b = SqliteCooldownStore::with_clock(db, fixed_clock(1_500));

        replica_a.record_cooldown("anthropic", "claude", 31_000, "failure_streak");
        assert_eq!(replica_b.cooling_until("anthropic", "claude"), Some(31_000));

        // A clear on one replica is visible to the other (fresh read: B's L1
        // holds the value for 250ms, so read through a third store).
        replica_a.clear("anthropic", "claude");
        let replica_c = SqliteCooldownStore::with_clock(replica_a.db.clone(), fixed_clock(1_500));
        assert_eq!(replica_c.cooling_until("anthropic", "claude"), None);
    }

    #[test]
    fn cooldown_record_overwrites_with_latest_expiry() {
        let db = DbHandle::new_memory().unwrap();
        let writer = SqliteCooldownStore::with_clock(db.clone(), fixed_clock(0));
        writer.record_cooldown("kimi", "k3", 5_000, "rate_limited");
        writer.record_cooldown("kimi", "k3", 30_000, "failure_streak");
        let reader = SqliteCooldownStore::with_clock(db, fixed_clock(1_000));
        assert_eq!(reader.cooling_until("kimi", "k3"), Some(30_000));
    }

    #[test]
    fn stores_fail_open_on_db_error() {
        // A DbHandle whose directory has been deleted: every connect() fails.
        let dir2 = tempfile::tempdir().unwrap();
        let db2 = DbHandle::new(dir2.path().join("state.db")).unwrap();
        let cooldowns = SqliteCooldownStore::with_clock(db2.clone(), fixed_clock(0));
        let limiter = SharedRateLimiter::with_clock(db2, fixed_clock(0));
        drop(dir2); // every subsequent connect() now fails

        assert_eq!(cooldowns.cooling_until("openai", "gpt-4o"), None);
        cooldowns.record_cooldown("openai", "gpt-4o", 5_000, "rate_limited");
        cooldowns.clear("openai", "gpt-4o");
        assert!(limiter.check_and_record("gwkey:k1", 1));
        assert!(db_error_count() >= 4);
    }

    #[test]
    fn rate_limit_counters_shared_across_instances() {
        let db = DbHandle::new_memory().unwrap();
        let replica_a = SharedRateLimiter::with_clock(db.clone(), fixed_clock(100_000));
        let replica_b = SharedRateLimiter::with_clock(db, fixed_clock(100_000));

        // Limit 3: A takes two, B takes the third, then both are denied.
        assert!(replica_a.check_and_record("gworg:org1", 3));
        assert!(replica_a.check_and_record("gworg:org1", 3));
        assert!(replica_b.check_and_record("gworg:org1", 3));
        assert!(!replica_b.check_and_record("gworg:org1", 3));

        // Denial is L1-cached on B but the DB row also blocks A.
        assert!(!replica_a.check_and_record("gworg:org1", 3));

        // A different scope is unaffected; the next window resets.
        assert!(replica_a.check_and_record("gworg:org2", 3));
        let next_window = SharedRateLimiter::with_clock(
            replica_a.db.clone(),
            fixed_clock(100_000 + RATE_WINDOW_MS),
        );
        assert!(next_window.check_and_record("gworg:org1", 3));
    }

    #[test]
    fn old_buckets_are_pruned_on_new_window() {
        let db = DbHandle::new_memory().unwrap();
        let first = SharedRateLimiter::with_clock(db.clone(), fixed_clock(60_000));
        assert!(first.check_and_record("gwkey:k9", 10));
        let second = SharedRateLimiter::with_clock(db.clone(), fixed_clock(120_000));
        assert!(second.check_and_record("gwkey:k9", 10));

        let conn = db.connect().unwrap();
        let rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM gateway_rate_limit_buckets WHERE scope = 'gwkey:k9'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(rows, 1, "previous window bucket must be pruned");
    }
}
