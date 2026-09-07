//! Inference provider pools: per-pool monthly budget circuit breaker and the
//! free-tier pool policy.
//!
//! Every chat completion is upstream spend. Each configured upstream provider
//! gets one `inference_pools` row (seeded at startup by [`ensure_seeded`] from
//! the same env vars `main.rs` uses to construct providers), and
//! `settle_inference` tags every usage row with the pool so month-to-date
//! consumption can be summed per pool. The route handler calls
//! [`InferencePoolService::check_pool_available`] before dispatch: a disabled
//! pool 503s, a pool at 80% of budget warns (REVENUE marker, rate-limited to
//! one log per 5 minutes), a pool at 100% 403s.
//!
//! Free-tier policy (v1, inert by default): `FREE_TIER_POOL_POLICY=cheap_only`
//! restricts users without a `user_credits` row (the same definition the free
//! inference allowance uses) to pools whose provider_id is listed in
//! `FREE_POOL_PROVIDERS`. Default `open` keeps today's behavior. `kind='byok'`
//! and `rate_limit_rpm` are reserved for later phases.

use sqlx::{FromRow, PgPool};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tracing::{debug, warn};

use crate::error::ApiError;

/// Upstream providers that can be configured: (pool provider id, enabling env
/// key). Must mirror the provider construction in main.rs.
const KNOWN_PROVIDERS: &[(&str, &str)] = &[
    ("openrouter", "OPENROUTER_API_KEY"),
    ("together", "TOGETHER_API_KEY"),
    ("fireworks", "FIREWORKS_API_KEY"),
    ("deepinfra", "DEEPINFRA_API_KEY"),
    ("groq", "GROQ_API_KEY"),
];

const DEFAULT_MONTHLY_BUDGET_USD: f64 = 100.0;
const BUDGET_WARN_FRACTION: f64 = 0.8;
const BUDGET_WARN_COOLDOWN: Duration = Duration::from_secs(300);

#[derive(Debug, Clone, FromRow)]
pub struct PoolRow {
    pub id: String,
    pub provider_id: String,
    pub kind: String,
    pub monthly_budget_usd: Option<f64>,
    pub rate_limit_rpm: Option<i32>,
    pub priority: i32,
    pub enabled: bool,
}

/// Free-tier pool restriction (`FREE_TIER_POOL_POLICY`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FreeTierPoolPolicy {
    /// Default: free users reach any pool (current behavior).
    Open,
    /// Free users may only use pools whose provider_id is in FREE_POOL_PROVIDERS.
    CheapOnly,
}

/// Read the free-tier pool policy from env. Unknown values are `open`.
pub fn free_tier_pool_policy() -> FreeTierPoolPolicy {
    match std::env::var("FREE_TIER_POOL_POLICY").as_deref() {
        Ok("cheap_only") => FreeTierPoolPolicy::CheapOnly,
        _ => FreeTierPoolPolicy::Open,
    }
}

/// The provider ids free users may use under `cheap_only` (`FREE_POOL_PROVIDERS`,
/// comma-separated).
fn free_pool_providers() -> Vec<String> {
    std::env::var("FREE_POOL_PROVIDERS")
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .collect()
}

/// Free-tier pool gate. `free_user` is exactly the free-allowance definition:
/// no `user_credits` row. Paid users and the `open` policy always pass;
/// `cheap_only` blocks free users on pools not on the economy list (and on
/// unseeded/unknown pools, which are by definition not listed).
pub fn check_free_tier_pool(
    policy: FreeTierPoolPolicy,
    free_user: bool,
    pool: Option<&PoolRow>,
) -> Result<(), ApiError> {
    if !free_user || policy == FreeTierPoolPolicy::Open {
        return Ok(());
    }
    let allowed = pool
        .map(|pool| free_pool_providers().contains(&pool.provider_id))
        .unwrap_or(false);
    if allowed {
        Ok(())
    } else {
        Err(ApiError::Forbidden(
            "Free tier uses economy models — add credits for frontier models.".to_string(),
        ))
    }
}

pub struct InferencePoolService {
    db: PgPool,
    /// Last time the 80% budget warning fired (request rate would spam logs
    /// otherwise).
    last_budget_warn: Mutex<Option<Instant>>,
}

impl InferencePoolService {
    pub fn new(db: PgPool) -> Self {
        Self {
            db,
            last_budget_warn: Mutex::new(None),
        }
    }

    /// Idempotently insert one pool row per *configured* provider (env key set
    /// and non-empty). Existing rows are never updated: an operator may have
    /// tuned the budget in the DB, and re-seeding must not clobber that.
    /// Returns the provider ids with pools after seeding (for startup logs).
    pub async fn ensure_seeded(&self) -> Result<Vec<String>, ApiError> {
        let mut seeded = Vec::new();
        for (provider_id, env_key) in KNOWN_PROVIDERS {
            let configured = std::env::var(env_key)
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false);
            if !configured {
                continue;
            }
            sqlx::query(
                r#"
                INSERT INTO inference_pools (id, provider_id, monthly_budget_usd)
                VALUES ($1, $2, $3)
                ON CONFLICT (provider_id) DO NOTHING
                "#,
            )
            .bind(format!("pool_{provider_id}"))
            .bind(*provider_id)
            .bind(pool_budget_usd(provider_id))
            .execute(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;
            seeded.push(provider_id.to_string());
        }
        Ok(seeded)
    }

    /// The pool for a provider id, if seeded.
    pub async fn pool_for_provider(&self, provider_id: &str) -> Result<Option<PoolRow>, ApiError> {
        sqlx::query_as::<_, PoolRow>(
            r#"
            SELECT id, provider_id, kind, monthly_budget_usd, rate_limit_rpm, priority, enabled
            FROM inference_pools
            WHERE provider_id = $1
            "#,
        )
        .bind(provider_id)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)
    }

    /// Month-to-date upstream spend for one pool. Rows with NULL wholesale
    /// (catalog-priced fallbacks, pre-pool rows) count as 0 — the breaker is a
    /// safety net for known-cost traffic, not an estimator; the reconciliation
    /// script watches total wholesale separately.
    pub async fn month_consumption_usd(&self, pool_id: &str) -> Result<f64, ApiError> {
        sqlx::query_scalar::<_, f64>(
            r#"
            SELECT COALESCE(SUM(wholesale_cost_usd), 0)
            FROM inference_usage
            WHERE pool_id = $1 AND created_at >= date_trunc('month', NOW())
            "#,
        )
        .bind(pool_id)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)
    }

    /// The budget circuit breaker: disabled pools and exhausted budgets 403,
    /// the 80% threshold warns once per cooldown.
    pub async fn check_pool_available(&self, pool: &PoolRow) -> Result<(), ApiError> {
        if !pool.enabled {
            return Err(ApiError::Forbidden(format!(
                "The {} model family is temporarily unavailable.",
                pool.provider_id
            )));
        }
        let Some(budget) = pool.monthly_budget_usd else {
            return Ok(());
        };
        if budget <= 0.0 {
            return Ok(());
        }
        let consumption = self.month_consumption_usd(&pool.id).await?;
        if consumption >= budget {
            return Err(ApiError::Forbidden(
                "Inference pool budget reached for this model family — try again next month or choose another model."
                    .to_string(),
            ));
        }
        if consumption >= budget * BUDGET_WARN_FRACTION {
            let mut last = self.last_budget_warn.lock().unwrap();
            let should_log = last
                .map(|instant| instant.elapsed() >= BUDGET_WARN_COOLDOWN)
                .unwrap_or(true);
            if should_log {
                *last = Some(Instant::now());
                warn!(
                    "REVENUE: inference pool {} ({}) at ${:.2} of ${:.2} monthly budget ({:.0}%)",
                    pool.id,
                    pool.provider_id,
                    consumption,
                    budget,
                    consumption / budget * 100.0
                );
            } else {
                debug!(
                    pool = %pool.id,
                    "inference pool over 80% of monthly budget (warning suppressed by cooldown)"
                );
            }
        }
        Ok(())
    }
}

/// Monthly budget for one provider: `POOL_BUDGET_USD_<PROVIDER>` (provider id
/// uppercased, non-alnum → _), else `INFERENCE_DEFAULT_MONTHLY_BUDGET_USD`,
/// else 100.
fn pool_budget_usd(provider_id: &str) -> f64 {
    let provider_key: String = provider_id
        .to_uppercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
        .collect();
    std::env::var(format!("POOL_BUDGET_USD_{provider_key}"))
        .ok()
        .and_then(|value| value.trim().parse::<f64>().ok())
        .or_else(|| {
            std::env::var("INFERENCE_DEFAULT_MONTHLY_BUDGET_USD")
                .ok()
                .and_then(|value| value.trim().parse::<f64>().ok())
        })
        .filter(|value| *value >= 0.0)
        .unwrap_or(DEFAULT_MONTHLY_BUDGET_USD)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    /// Guards env mutation (provider keys, budgets, free-tier policy).
    static ENV_LOCK: StdMutex<()> = StdMutex::new(());

    async fn test_pool() -> PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let schema_for_hook = schema.clone();
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap();
        sqlx::query("DROP TABLE IF EXISTS inference_usage CASCADE")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query("DROP TABLE IF EXISTS inference_pools CASCADE")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE inference_pools (
                id TEXT PRIMARY KEY,
                provider_id TEXT NOT NULL UNIQUE,
                kind TEXT NOT NULL DEFAULT 'pay_per_token',
                monthly_budget_usd DOUBLE PRECISION,
                rate_limit_rpm INTEGER,
                priority INTEGER NOT NULL DEFAULT 100,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE inference_usage (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                model TEXT NOT NULL,
                prompt_tokens BIGINT NOT NULL,
                completion_tokens BIGINT NOT NULL,
                cost_usd DOUBLE PRECISION NOT NULL,
                wholesale_cost_usd DOUBLE PRECISION,
                estimated BOOLEAN NOT NULL DEFAULT FALSE,
                pool_id TEXT REFERENCES inference_pools(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_usage(pool: &PgPool, pool_id: &str, wholesale_usd: f64) {
        sqlx::query(
            r#"
            INSERT INTO inference_usage (id, user_id, model, prompt_tokens, completion_tokens, cost_usd, wholesale_cost_usd, pool_id)
            VALUES ($1, 'user_1', 'gpt-4o', 0, 0, $2, $2, $3)
            "#,
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .bind(wholesale_usd)
        .bind(pool_id)
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn seeding_is_idempotent_and_never_overwrites_operator_budgets() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("TOGETHER_API_KEY", "test-key");
        let db = test_pool().await;
        let service = InferencePoolService::new(db.clone());

        let seeded = service.ensure_seeded().await.unwrap();
        assert!(seeded.contains(&"together".to_string()));
        let pool = service.pool_for_provider("together").await.unwrap().unwrap();
        assert_eq!(pool.monthly_budget_usd, Some(100.0), "default budget");
        assert_eq!(pool.kind, "pay_per_token");
        assert!(pool.enabled);

        // Operator tunes the budget in the DB; re-seeding must not clobber it.
        sqlx::query("UPDATE inference_pools SET monthly_budget_usd = 42.0 WHERE provider_id = 'together'")
            .execute(&db)
            .await
            .unwrap();
        let seeded_again = service.ensure_seeded().await.unwrap();
        assert_eq!(seeded_again.len(), seeded.len());
        let pool = service.pool_for_provider("together").await.unwrap().unwrap();
        assert_eq!(pool.monthly_budget_usd, Some(42.0), "operator budget survives re-seed");
        let rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM inference_pools")
            .fetch_one(&db)
            .await
            .unwrap();
        assert_eq!(rows, seeded.len() as i64, "re-seed inserts nothing new");

        std::env::remove_var("TOGETHER_API_KEY");
    }

    #[tokio::test]
    async fn seeding_uses_per_provider_budget_env_then_default_env() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("TOGETHER_API_KEY", "test-key");
        std::env::set_var("POOL_BUDGET_USD_TOGETHER", "250.5");
        let db = test_pool().await;
        let service = InferencePoolService::new(db.clone());
        service.ensure_seeded().await.unwrap();
        let pool = service.pool_for_provider("together").await.unwrap().unwrap();
        assert_eq!(pool.monthly_budget_usd, Some(250.5));
        std::env::remove_var("POOL_BUDGET_USD_TOGETHER");

        // Default env applies when no per-provider override exists.
        std::env::set_var("INFERENCE_DEFAULT_MONTHLY_BUDGET_USD", "77");
        let db2 = test_pool().await;
        let service2 = InferencePoolService::new(db2.clone());
        service2.ensure_seeded().await.unwrap();
        let pool = service2.pool_for_provider("together").await.unwrap().unwrap();
        assert_eq!(pool.monthly_budget_usd, Some(77.0));
        std::env::remove_var("INFERENCE_DEFAULT_MONTHLY_BUDGET_USD");
        std::env::remove_var("TOGETHER_API_KEY");
    }

    #[tokio::test]
    async fn circuit_breaker_passes_under_80_warns_at_80_and_blocks_at_100() {
        let db = test_pool().await;
        let service = InferencePoolService::new(db.clone());
        sqlx::query(
            "INSERT INTO inference_pools (id, provider_id, monthly_budget_usd) VALUES ('pool_t', 'together', 100.0)",
        )
        .execute(&db)
        .await
        .unwrap();
        let pool = service.pool_for_provider("together").await.unwrap().unwrap();

        insert_usage(&db, "pool_t", 79.0).await;
        assert!(
            service.check_pool_available(&pool).await.is_ok(),
            "79% of budget passes"
        );

        insert_usage(&db, "pool_t", 1.0).await;
        assert!(
            service.check_pool_available(&pool).await.is_ok(),
            "80% of budget passes (warn only)"
        );

        insert_usage(&db, "pool_t", 20.0).await;
        let error = service.check_pool_available(&pool).await.unwrap_err();
        assert!(
            error.to_string().contains("Inference pool budget reached"),
            "100% of budget blocks: {error}"
        );
    }

    #[tokio::test]
    async fn circuit_breaker_blocks_disabled_and_ignores_unlimited_pools() {
        let db = test_pool().await;
        let service = InferencePoolService::new(db.clone());
        sqlx::query(
            "INSERT INTO inference_pools (id, provider_id, monthly_budget_usd, enabled) VALUES
                ('pool_off', 'groq', 100.0, FALSE),
                ('pool_inf', 'openrouter', NULL, TRUE)",
        )
        .execute(&db)
        .await
        .unwrap();

        let off = service.pool_for_provider("groq").await.unwrap().unwrap();
        let error = service.check_pool_available(&off).await.unwrap_err();
        assert!(error.to_string().contains("temporarily unavailable"), "{error}");

        let unlimited = service.pool_for_provider("openrouter").await.unwrap().unwrap();
        insert_usage(&db, "pool_inf", 1_000_000.0).await;
        assert!(
            service.check_pool_available(&unlimited).await.is_ok(),
            "NULL budget is unlimited"
        );
    }

    #[tokio::test]
    async fn month_consumption_ignores_null_wholesale_and_last_month() {
        let db = test_pool().await;
        let service = InferencePoolService::new(db.clone());
        sqlx::query(
            "INSERT INTO inference_pools (id, provider_id) VALUES ('pool_t', 'together')",
        )
        .execute(&db)
        .await
        .unwrap();
        insert_usage(&db, "pool_t", 10.0).await;
        // NULL wholesale counts as 0 (documented in month_consumption_usd).
        sqlx::query(
            "INSERT INTO inference_usage (id, user_id, model, prompt_tokens, completion_tokens, cost_usd, wholesale_cost_usd, pool_id)
             VALUES ($1, 'user_1', 'gpt-4o', 0, 0, 5.0, NULL, 'pool_t')",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .execute(&db)
        .await
        .unwrap();
        // Last month does not count.
        sqlx::query(
            "INSERT INTO inference_usage (id, user_id, model, prompt_tokens, completion_tokens, cost_usd, wholesale_cost_usd, pool_id, created_at)
             VALUES ($1, 'user_1', 'gpt-4o', 0, 0, 999.0, 999.0, 'pool_t', date_trunc('month', NOW()) - INTERVAL '1 day')",
        )
        .bind(uuid::Uuid::new_v4().to_string())
        .execute(&db)
        .await
        .unwrap();
        let consumption = service.month_consumption_usd("pool_t").await.unwrap();
        assert!((consumption - 10.0).abs() < 1e-9, "got {consumption}");
    }

    #[test]
    fn free_tier_policy_open_allows_anything() {
        let pool = PoolRow {
            id: "pool_t".to_string(),
            provider_id: "openrouter".to_string(),
            kind: "pay_per_token".to_string(),
            monthly_budget_usd: None,
            rate_limit_rpm: None,
            priority: 100,
            enabled: true,
        };
        assert!(check_free_tier_pool(FreeTierPoolPolicy::Open, true, Some(&pool)).is_ok());
        assert!(check_free_tier_pool(FreeTierPoolPolicy::Open, true, None).is_ok());
        assert!(check_free_tier_pool(FreeTierPoolPolicy::Open, false, None).is_ok());
    }

    #[test]
    fn free_tier_policy_cheap_only_restricts_free_users_to_listed_pools() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("FREE_POOL_PROVIDERS", "deepinfra, together");
        let cheap = PoolRow {
            id: "pool_d".to_string(),
            provider_id: "deepinfra".to_string(),
            kind: "pay_per_token".to_string(),
            monthly_budget_usd: None,
            rate_limit_rpm: None,
            priority: 100,
            enabled: true,
        };
        let frontier = PoolRow {
            provider_id: "openrouter".to_string(),
            ..cheap.clone()
        };

        // Free users: listed pools pass, others (and unseeded) 403.
        assert!(check_free_tier_pool(FreeTierPoolPolicy::CheapOnly, true, Some(&cheap)).is_ok());
        let error =
            check_free_tier_pool(FreeTierPoolPolicy::CheapOnly, true, Some(&frontier)).unwrap_err();
        assert!(error.to_string().contains("Free tier uses economy models"), "{error}");
        assert!(check_free_tier_pool(FreeTierPoolPolicy::CheapOnly, true, None).is_err());
        // Paid users are never restricted.
        assert!(check_free_tier_pool(FreeTierPoolPolicy::CheapOnly, false, Some(&frontier)).is_ok());
        assert!(check_free_tier_pool(FreeTierPoolPolicy::CheapOnly, false, None).is_ok());
        std::env::remove_var("FREE_POOL_PROVIDERS");
    }

    #[test]
    fn free_tier_policy_env_parsing() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var("FREE_TIER_POOL_POLICY");
        assert_eq!(free_tier_pool_policy(), FreeTierPoolPolicy::Open);
        std::env::set_var("FREE_TIER_POOL_POLICY", "cheap_only");
        assert_eq!(free_tier_pool_policy(), FreeTierPoolPolicy::CheapOnly);
        std::env::set_var("FREE_TIER_POOL_POLICY", "garbage");
        assert_eq!(free_tier_pool_policy(), FreeTierPoolPolicy::Open, "unknown values are open");
        std::env::remove_var("FREE_TIER_POOL_POLICY");
    }
}
