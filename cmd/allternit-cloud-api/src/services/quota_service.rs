//! Runtime quota enforcement for pairing, devices, relay sockets, and bandwidth.
//!
//! Quotas are keyed by Clerk user id. The service creates a `user_runtime_quotas`
//! row lazily from the default `plan_tiers` row. Admins can override individual
//! quota fields without changing the tier.

use crate::error::ApiError;
use chrono::{Datelike, Timelike, Utc};
use sqlx::SqlitePool;
use std::sync::Arc;
use tracing::debug;
use uuid::Uuid;

/// Effective quota values for a single user.
#[derive(Debug, Clone)]
pub struct UserQuota {
    pub user_id: String,
    pub plan_tier_id: String,
    pub max_active_devices: i64,
    pub max_pairings_per_day: i64,
    pub max_relay_sockets: i64,
    pub max_relay_mb_per_day: i64,
    pub max_hosted_runtime_hours_monthly: i64,
    pub can_create_hosted_runtime: bool,
    pub max_hosted_runtimes: i64,
    pub max_hosted_runtime_memory_mb: i64,
    pub hard_spend_cap_usd: Option<f64>,
}

/// Service that reads and enforces user-level runtime quotas.
#[derive(Debug, Clone)]
pub struct QuotaService {
    db: SqlitePool,
    default_tier_id: String,
}

impl QuotaService {
    pub fn new(db: SqlitePool) -> Self {
        Self {
            db,
            default_tier_id: std::env::var("DEFAULT_PLAN_TIER")
                .unwrap_or_else(|_| "free".to_string()),
        }
    }

    /// Ensure a quota row exists for the user, creating it from the default tier
    /// if necessary. Returns the effective quota.
    pub async fn ensure_quota(&self, user_id: &str) -> Result<UserQuota, ApiError> {
        if let Some(quota) = self.get_quota(user_id).await? {
            return Ok(quota);
        }
        self.create_quota_from_tier(user_id, &self.default_tier_id)
            .await
    }

    /// Get the current effective quota for a user, if one exists.
    pub async fn get_quota(&self, user_id: &str) -> Result<Option<UserQuota>, ApiError> {
        let row = sqlx::query_as::<_, UserQuotaRow>(
            r#"
            SELECT
                q.user_id,
                q.plan_tier_id,
                q.max_active_devices,
                q.max_pairings_per_day,
                q.max_relay_sockets,
                q.max_relay_mb_per_day,
                q.max_hosted_runtime_hours_monthly,
                q.can_create_hosted_runtime,
                q.max_hosted_runtimes,
                q.max_hosted_runtime_memory_mb,
                q.hard_spend_cap_usd
            FROM user_runtime_quotas q
            WHERE q.user_id = ?
            "#,
        )
        .bind(user_id)
        .fetch_optional(&self.db)
        .await?;
        Ok(row.map(UserQuota::from))
    }

    /// Create a quota row for a user by copying the named tier.
    async fn create_quota_from_tier(
        &self,
        user_id: &str,
        tier_id: &str,
    ) -> Result<UserQuota, ApiError> {
        sqlx::query(
            r#"
            INSERT INTO user_runtime_quotas (
                user_id, plan_tier_id,
                max_active_devices, max_pairings_per_day, max_relay_sockets,
                max_relay_mb_per_day, max_hosted_runtime_hours_monthly,
                can_create_hosted_runtime, max_hosted_runtimes,
                max_hosted_runtime_memory_mb, hard_spend_cap_usd
            )
            SELECT ?, id,
                max_active_devices, max_pairings_per_day, max_relay_sockets,
                max_relay_mb_per_day, max_hosted_runtime_hours_monthly,
                can_create_hosted_runtime, max_hosted_runtimes,
                max_hosted_runtime_memory_mb, hard_spend_cap_usd
            FROM plan_tiers
            WHERE id = ?
            ON CONFLICT(user_id) DO UPDATE SET
                plan_tier_id = excluded.plan_tier_id,
                max_active_devices = excluded.max_active_devices,
                max_pairings_per_day = excluded.max_pairings_per_day,
                max_relay_sockets = excluded.max_relay_sockets,
                max_relay_mb_per_day = excluded.max_relay_mb_per_day,
                max_hosted_runtime_hours_monthly = excluded.max_hosted_runtime_hours_monthly,
                can_create_hosted_runtime = excluded.can_create_hosted_runtime,
                max_hosted_runtimes = excluded.max_hosted_runtimes,
                max_hosted_runtime_memory_mb = excluded.max_hosted_runtime_memory_mb,
                hard_spend_cap_usd = excluded.hard_spend_cap_usd
            "#,
        )
        .bind(user_id)
        .bind(tier_id)
        .execute(&self.db)
        .await?;

        self.get_quota(user_id)
            .await?
            .ok_or_else(|| ApiError::Internal("Failed to initialize user quota".to_string()))
    }

    /// Enforce the active runtime device cap. Call inside a transaction around
    /// the device insert for correctness.
    pub async fn check_active_device_cap(
        &self,
        user_id: &str,
        quota: &UserQuota,
    ) -> Result<(), ApiError> {
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM runtime_devices WHERE user_id = ? AND revoked_at IS NULL",
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;

        if count >= quota.max_active_devices {
            return Err(ApiError::Forbidden(format!(
                "Active runtime limit reached ({}/{}). Revoke an existing runtime or upgrade your plan.",
                count, quota.max_active_devices
            )));
        }
        Ok(())
    }

    /// Record a pairing creation and enforce the daily pairing cap.
    pub async fn record_pairing_created(
        &self,
        user_id: &str,
        quota: &UserQuota,
    ) -> Result<(), ApiError> {
        let today = Utc::now().date_naive();
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO user_pairing_usage (id, user_id, usage_date, pairings_created)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(user_id, usage_date) DO UPDATE SET
                pairings_created = pairings_created + 1,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(today)
        .execute(&self.db)
        .await?;

        let created: i64 = sqlx::query_scalar(
            "SELECT pairings_created FROM user_pairing_usage WHERE user_id = ? AND usage_date = ?",
        )
        .bind(user_id)
        .bind(today)
        .fetch_one(&self.db)
        .await?;

        if created > quota.max_pairings_per_day {
            return Err(ApiError::Forbidden(format!(
                "Daily pairing limit reached ({}/{}). Try again tomorrow or upgrade your plan.",
                created, quota.max_pairings_per_day
            )));
        }
        Ok(())
    }

    /// Record a pairing approval. Used to distinguish created vs approved counts.
    pub async fn record_pairing_approved(&self, user_id: &str) -> Result<(), ApiError> {
        let today = Utc::now().date_naive();
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO user_pairing_usage (id, user_id, usage_date, pairings_approved)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(user_id, usage_date) DO UPDATE SET
                pairings_approved = pairings_approved + 1,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(today)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Count currently open relay sockets across all of a user's runtimes.
    pub async fn count_open_relay_sockets(&self, user_id: &str) -> Result<i64, ApiError> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM runtime_devices d
            JOIN runtime_relay_sockets s ON s.runtime_id = d.id
            WHERE d.user_id = ? AND s.closed_at IS NULL
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;
        Ok(count)
    }

    /// Enforce the daily relay socket cap and the concurrent socket cap.
    pub async fn check_relay_socket_allowed(
        &self,
        user_id: &str,
        quota: &UserQuota,
    ) -> Result<(), ApiError> {
        let today = Utc::now().date_naive();
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO user_relay_usage (id, user_id, usage_date, sockets_opened)
            VALUES (?, ?, ?, 1)
            ON CONFLICT(user_id, usage_date) DO UPDATE SET
                sockets_opened = sockets_opened + 1,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(today)
        .execute(&self.db)
        .await?;

        let opened: i64 = sqlx::query_scalar(
            "SELECT sockets_opened FROM user_relay_usage WHERE user_id = ? AND usage_date = ?",
        )
        .bind(user_id)
        .bind(today)
        .fetch_one(&self.db)
        .await?;

        if opened > quota.max_relay_sockets {
            return Err(ApiError::Forbidden(format!(
                "Daily relay socket limit reached ({}/{}). Upgrade your plan for more.",
                opened, quota.max_relay_sockets
            )));
        }

        let concurrent = self.count_open_relay_sockets(user_id).await?;
        if concurrent >= quota.max_relay_sockets {
            return Err(ApiError::Forbidden(format!(
                "Concurrent relay socket limit reached ({}/{}). Close another socket or upgrade your plan.",
                concurrent, quota.max_relay_sockets
            )));
        }
        Ok(())
    }

    /// Record that a relay socket opened. Returns the socket record id so the
    /// caller can close it later.
    pub async fn open_relay_socket(
        &self,
        runtime_id: &str,
        socket_path: &str,
    ) -> Result<String, ApiError> {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO runtime_relay_sockets (id, runtime_id, socket_path) VALUES (?, ?, ?)",
        )
        .bind(&id)
        .bind(runtime_id)
        .bind(socket_path)
        .execute(&self.db)
        .await?;
        Ok(id)
    }

    /// Record that a relay socket closed and add its egress to usage.
    pub async fn close_relay_socket(
        &self,
        socket_id: &str,
        egress_bytes: i64,
    ) -> Result<(), ApiError> {
        sqlx::query(
            "UPDATE runtime_relay_sockets SET closed_at = CURRENT_TIMESTAMP, egress_bytes = ? WHERE id = ?",
        )
        .bind(egress_bytes)
        .bind(socket_id)
        .execute(&self.db)
        .await?;
        Ok(())
    }

    /// Record egress bytes for a user and enforce the daily bandwidth cap.
    pub async fn record_relay_egress(
        &self,
        user_id: &str,
        quota: &UserQuota,
        bytes: i64,
    ) -> Result<(), ApiError> {
        if bytes <= 0 {
            return Ok(());
        }
        let today = Utc::now().date_naive();
        let id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO user_relay_usage (id, user_id, usage_date, egress_bytes)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, usage_date) DO UPDATE SET
                egress_bytes = egress_bytes + excluded.egress_bytes,
                updated_at = CURRENT_TIMESTAMP
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(today)
        .bind(bytes)
        .execute(&self.db)
        .await?;

        let total_bytes: i64 = sqlx::query_scalar(
            "SELECT egress_bytes FROM user_relay_usage WHERE user_id = ? AND usage_date = ?",
        )
        .bind(user_id)
        .bind(today)
        .fetch_one(&self.db)
        .await?;

        let mb = total_bytes / (1024 * 1024);
        if mb > quota.max_relay_mb_per_day as i64 {
            return Err(ApiError::Forbidden(format!(
                "Daily relay bandwidth limit reached ({} MB / {} MB). Upgrade your plan for more.",
                mb, quota.max_relay_mb_per_day
            )));
        }
        Ok(())
    }

    /// Check whether the user has hit their hard spend cap.
    /// Computes the current month spend from run_costs plus relay egress.
    pub async fn check_spend_cap(&self, user_id: &str, quota: &UserQuota) -> Result<(), ApiError> {
        let cap = match quota.hard_spend_cap_usd {
            Some(cap) if cap > 0.0 => cap,
            _ => return Ok(()),
        };

        let now = Utc::now();
        let month_start = now
            .with_day(1)
            .unwrap_or(now)
            .with_hour(0)
            .unwrap_or(now)
            .with_minute(0)
            .unwrap_or(now)
            .with_second(0)
            .unwrap_or(now);

        let run_cost: f64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(rc.total_cost), 0)
            FROM run_costs rc
            JOIN runs r ON rc.run_id = r.id
            WHERE r.owner_id = ? AND rc.started_at >= ?
            "#,
        )
        .bind(user_id)
        .bind(month_start)
        .fetch_one(&self.db)
        .await
        .unwrap_or(0.0);

        let relay_egress_mb: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(u.egress_bytes), 0) / (1024 * 1024)
            FROM user_relay_usage u
            WHERE u.user_id = ? AND u.usage_date >= ?
            "#,
        )
        .bind(user_id)
        .bind(month_start.date_naive())
        .fetch_one(&self.db)
        .await
        .unwrap_or(0);

        // Relay bandwidth is not directly billed today, but we include a nominal
        // $0.02/MB placeholder so a runaway socket cannot silently spend nothing.
        let relay_cost = relay_egress_mb as f64 * 0.02;
        let hosted_cost = crate::services::hosted_usage_summary(&self.db, user_id)
            .await
            .map(|summary| summary.estimated_cost_usd)
            .unwrap_or(0.0);
        let current = run_cost + relay_cost + hosted_cost;

        if current >= cap {
            return Err(ApiError::Forbidden(format!(
                "Monthly spend cap reached (${:.2} / ${:.2}). Contact support to raise the cap.",
                current, cap
            )));
        }
        debug!(
            user_id = %user_id,
            current = %current,
            cap = %cap,
            "Spend cap check passed"
        );
        Ok(())
    }

    /// True if the quota allows creating hosted runtimes.
    pub fn can_create_hosted_runtime(&self, quota: &UserQuota) -> bool {
        quota.can_create_hosted_runtime
    }

    /// Enforce the paid entitlement, per-user instance count, machine-size
    /// ceiling, and monthly runtime-hour allowance before provisioning.
    pub async fn check_hosted_runtime_creation(
        &self,
        user_id: &str,
        quota: &UserQuota,
        requested_memory_mb: i64,
    ) -> Result<(), ApiError> {
        if !quota.can_create_hosted_runtime || quota.max_hosted_runtimes <= 0 {
            return Err(ApiError::Forbidden(
                "Your plan does not include hosted runtimes. Upgrade to a hosted compute plan."
                    .to_string(),
            ));
        }
        if requested_memory_mb <= 0
            || requested_memory_mb > quota.max_hosted_runtime_memory_mb
            || !matches!(requested_memory_mb, 512 | 1024 | 2048)
        {
            return Err(ApiError::Forbidden(format!(
                "Your {} plan allows hosted runtimes up to {} MB.",
                quota.plan_tier_id, quota.max_hosted_runtime_memory_mb
            )));
        }

        let active_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) FROM hosted_runtime_instances
            WHERE user_id = ? AND status NOT IN ('destroying', 'destroyed')
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await?;
        if active_count >= quota.max_hosted_runtimes {
            return Err(ApiError::Forbidden(format!(
                "Hosted runtime limit reached ({}/{}). Destroy an existing runtime or upgrade your plan.",
                active_count, quota.max_hosted_runtimes
            )));
        }

        self.check_hosted_runtime_hours(user_id, quota).await
    }

    /// Prevent a stopped machine from starting once its monthly allowance is
    /// exhausted. A value of zero means the tier has no hosted entitlement,
    /// not unlimited usage.
    pub async fn check_hosted_runtime_hours(
        &self,
        user_id: &str,
        quota: &UserQuota,
    ) -> Result<(), ApiError> {
        if quota.max_hosted_runtime_hours_monthly <= 0 {
            return Err(ApiError::Forbidden(
                "Your plan has no hosted runtime hours available.".to_string(),
            ));
        }
        let usage = crate::services::hosted_usage_summary(&self.db, user_id).await?;
        let limit_seconds = quota.max_hosted_runtime_hours_monthly * 3600;
        if usage.total_seconds >= limit_seconds {
            return Err(ApiError::Forbidden(format!(
                "Monthly hosted runtime allowance reached ({} hours).",
                quota.max_hosted_runtime_hours_monthly
            )));
        }
        Ok(())
    }
}

#[derive(Debug, sqlx::FromRow)]
struct UserQuotaRow {
    user_id: String,
    plan_tier_id: String,
    max_active_devices: i64,
    max_pairings_per_day: i64,
    max_relay_sockets: i64,
    max_relay_mb_per_day: i64,
    max_hosted_runtime_hours_monthly: i64,
    can_create_hosted_runtime: i64,
    max_hosted_runtimes: i64,
    max_hosted_runtime_memory_mb: i64,
    #[sqlx(default)]
    hard_spend_cap_usd: Option<f64>,
}

impl From<UserQuotaRow> for UserQuota {
    fn from(row: UserQuotaRow) -> Self {
        Self {
            user_id: row.user_id,
            plan_tier_id: row.plan_tier_id,
            max_active_devices: row.max_active_devices,
            max_pairings_per_day: row.max_pairings_per_day,
            max_relay_sockets: row.max_relay_sockets,
            max_relay_mb_per_day: row.max_relay_mb_per_day,
            max_hosted_runtime_hours_monthly: row.max_hosted_runtime_hours_monthly,
            can_create_hosted_runtime: row.can_create_hosted_runtime != 0,
            max_hosted_runtimes: row.max_hosted_runtimes,
            max_hosted_runtime_memory_mb: row.max_hosted_runtime_memory_mb,
            hard_spend_cap_usd: row.hard_spend_cap_usd,
        }
    }
}

/// Helper to share a quota service reference.
pub type SharedQuotaService = Arc<QuotaService>;
