//! Hosted Fly Machine lifecycle and metering.
//!
//! A usage session is opened whenever a hosted machine starts and closed when
//! it stops. The background reconciler also enforces inactivity and monthly
//! runtime-hour limits, so a browser disconnect or API restart cannot leave a
//! paid machine running forever.

use crate::{
    error::ApiError,
    services::{FlyMachineState, FlyRuntimeService},
    ApiState,
};
use chrono::{DateTime, Datelike, Timelike, Utc};
use sqlx::{FromRow, SqlitePool};
use std::{sync::Arc, time::Duration};
use tracing::{debug, error, info, warn};
use uuid::Uuid;

#[derive(Debug, Clone, Default)]
pub struct HostedUsageSummary {
    pub total_seconds: i64,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, FromRow)]
struct LifecycleRow {
    id: String,
    user_id: String,
    fly_machine_id: Option<String>,
    status: String,
    memory_mb: i64,
    idle_timeout_minutes: i64,
    last_activity_at: Option<DateTime<Utc>>,
}

fn month_start() -> DateTime<Utc> {
    let now = Utc::now();
    now.with_day(1)
        .unwrap_or(now)
        .with_hour(0)
        .unwrap_or(now)
        .with_minute(0)
        .unwrap_or(now)
        .with_second(0)
        .unwrap_or(now)
        .with_nanosecond(0)
        .unwrap_or(now)
}

/// Return this month's closed plus currently-open hosted runtime usage.
pub async fn hosted_usage_summary(
    db: &SqlitePool,
    user_id: &str,
) -> Result<HostedUsageSummary, ApiError> {
    let row: (i64, f64) = sqlx::query_as(
        r#"
        SELECT
            COALESCE(SUM(
                CASE WHEN ended_at IS NULL
                    THEN MAX(0, CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER))
                    ELSE COALESCE(duration_seconds, 0)
                END
            ), 0),
            COALESCE(SUM(
                CASE WHEN ended_at IS NULL
                    THEN (MAX(0, CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER)) / 3600.0) * cost_per_hour
                    ELSE COALESCE(estimated_cost_usd, 0)
                END
            ), 0)
        FROM hosted_runtime_usage_sessions
        WHERE user_id = ? AND started_at >= ?
        "#,
    )
    .bind(user_id)
    .bind(month_start())
    .fetch_one(db)
    .await?;

    Ok(HostedUsageSummary {
        total_seconds: row.0,
        estimated_cost_usd: row.1,
    })
}

/// Open one billable interval if this instance does not already have one.
pub async fn record_runtime_started(db: &SqlitePool, instance_id: &str) -> Result<(), ApiError> {
    let row: Option<(String, f64)> = sqlx::query_as(
        r#"
        SELECT h.user_id, COALESCE(r.cost_per_hour, 0)
        FROM hosted_runtime_instances h
        LEFT JOIN cost_rates r
          ON r.provider = h.cost_rate_provider
         AND r.region = h.cost_rate_region
         AND r.instance_type = h.cost_rate_instance_type
        WHERE h.id = ?
        "#,
    )
    .bind(instance_id)
    .fetch_optional(db)
    .await?;

    let Some((user_id, cost_per_hour)) = row else {
        return Err(ApiError::NotFound("Hosted runtime not found".to_string()));
    };

    sqlx::query(
        r#"
        INSERT OR IGNORE INTO hosted_runtime_usage_sessions (
            id, hosted_instance_id, user_id, started_at, cost_per_hour
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(instance_id)
    .bind(user_id)
    .bind(cost_per_hour)
    .execute(db)
    .await?;

    Ok(())
}

/// Close the currently-open interval and freeze its duration and cost.
pub async fn record_runtime_stopped(
    db: &SqlitePool,
    instance_id: &str,
    reason: &str,
) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE hosted_runtime_usage_sessions
        SET ended_at = CURRENT_TIMESTAMP,
            duration_seconds = MAX(
                0,
                CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER)
            ),
            estimated_cost_usd = (
                MAX(0, CAST(strftime('%s', 'now') AS INTEGER) - CAST(strftime('%s', started_at) AS INTEGER)) / 3600.0
            ) * cost_per_hour,
            stop_reason = ?
        WHERE hosted_instance_id = ? AND ended_at IS NULL
        "#,
    )
    .bind(reason)
    .bind(instance_id)
    .execute(db)
    .await?;
    Ok(())
}

/// Mark user-driven relay traffic as activity. Runtime heartbeats deliberately
/// do not call this; an otherwise idle daemon must still auto-stop.
pub async fn touch_runtime_activity(db: &SqlitePool, runtime_id: &str) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE hosted_runtime_instances
        SET last_activity_at = CURRENT_TIMESTAMP
        WHERE runtime_device_id = ? AND status IN ('starting', 'running')
        "#,
    )
    .bind(runtime_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn touch_instance_activity(db: &SqlitePool, instance_id: &str) -> Result<(), ApiError> {
    sqlx::query(
        r#"
        UPDATE hosted_runtime_instances
        SET last_activity_at = CURRENT_TIMESTAMP
        WHERE id = ? AND status IN ('starting', 'running')
        "#,
    )
    .bind(instance_id)
    .execute(db)
    .await?;
    Ok(())
}

/// What a relay connection attempt should do about a hosted runtime's machine.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostedWakeDecision {
    /// Machine is already starting or running; nothing to start.
    AlreadyActive,
    /// Machine is stopped or stopping and must be started.
    StartRequired,
    /// Instance cannot be woken (creating, error, destroying, or no machine).
    NotWakeable,
}

/// Map a hosted instance status to a wake decision. A machine id is required
/// to start anything, so its absence forces `NotWakeable`.
pub fn hosted_wake_decision(status: &str, has_machine_id: bool) -> HostedWakeDecision {
    match status {
        "starting" | "running" => HostedWakeDecision::AlreadyActive,
        "stopped" | "stopping" if has_machine_id => HostedWakeDecision::StartRequired,
        _ => HostedWakeDecision::NotWakeable,
    }
}

/// The hosted instance behind a runtime device, with its wake decision.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostedWakeTarget {
    pub instance_id: String,
    pub machine_id: String,
    pub decision: HostedWakeDecision,
}

/// Resolve the hosted instance a runtime device belongs to. Returns `None`
/// for devices that are not hosted runtimes (plain paired desktops/VPS).
pub async fn hosted_wake_target(
    db: &SqlitePool,
    runtime_id: &str,
) -> Result<Option<HostedWakeTarget>, ApiError> {
    let row: Option<(String, String, Option<String>)> = sqlx::query_as(
        r#"
        SELECT id, status, fly_machine_id
        FROM hosted_runtime_instances
        WHERE runtime_device_id = ? AND status != 'destroyed'
        "#,
    )
    .bind(runtime_id)
    .fetch_optional(db)
    .await?;
    Ok(row.map(|(instance_id, status, machine_id)| {
        let decision = hosted_wake_decision(&status, machine_id.is_some());
        HostedWakeTarget {
            instance_id,
            machine_id: machine_id.unwrap_or_default(),
            decision,
        }
    }))
}

/// Mark a hosted instance as starting and open its billing session. Shared by
/// the user-driven start route and relay wake-on-demand; call it after the
/// provider has accepted the start.
pub async fn mark_hosted_instance_starting(db: &SqlitePool, instance_id: &str) -> Result<(), ApiError> {
    sqlx::query(
        "UPDATE hosted_runtime_instances SET status = 'starting', started_at = CURRENT_TIMESTAMP, stopped_at = NULL, active_since = CURRENT_TIMESTAMP, last_activity_at = CURRENT_TIMESTAMP, stop_reason = NULL WHERE id = ?",
    )
    .bind(instance_id)
    .execute(db)
    .await?;
    record_runtime_started(db, instance_id).await
}

/// Outcome of a wake-on-demand attempt for a runtime device.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostedWakeOutcome {
    /// Device is not a hosted runtime.
    NotHosted,
    /// Instance was already starting or running.
    AlreadyActive,
    /// A start was issued; the daemon still has to boot and reconnect.
    Waking,
    /// Hosted instance exists but cannot be started right now.
    NotWakeable,
}

/// Start the machine behind a hosted runtime device when it is stopped, so a
/// connecting client does not fail against an idle-stopped runtime.
pub async fn wake_hosted_runtime_for_device(
    db: &SqlitePool,
    fly: Option<&FlyRuntimeService>,
    runtime_id: &str,
) -> Result<HostedWakeOutcome, ApiError> {
    let Some(target) = hosted_wake_target(db, runtime_id).await? else {
        return Ok(HostedWakeOutcome::NotHosted);
    };
    match target.decision {
        HostedWakeDecision::AlreadyActive => Ok(HostedWakeOutcome::AlreadyActive),
        HostedWakeDecision::NotWakeable => Ok(HostedWakeOutcome::NotWakeable),
        HostedWakeDecision::StartRequired => {
            let fly = fly.ok_or_else(|| {
                ApiError::ServiceUnavailable("Hosted runtimes are not configured.".to_string())
            })?;
            fly.start(&target.machine_id).await?;
            mark_hosted_instance_starting(db, &target.instance_id).await?;
            info!(instance_id = %target.instance_id, %runtime_id, "Hosted runtime wake-on-demand start issued");
            Ok(HostedWakeOutcome::Waking)
        }
    }
}

pub fn start_hosted_runtime_lifecycle_task(state: Arc<ApiState>) {
    let interval_seconds = std::env::var("HOSTED_RUNTIME_RECONCILE_SECONDS")
        .ok()
        .and_then(|value| value.parse::<u64>().ok())
        .filter(|value| *value >= 15)
        .unwrap_or(60);

    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(interval_seconds));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        info!(interval_seconds, "Hosted runtime lifecycle task started");
        loop {
            interval.tick().await;
            if let Err(error) = reconcile_hosted_runtimes(&state).await {
                error!("Hosted runtime lifecycle reconciliation failed: {}", error);
            }
        }
    });
}

async fn reconcile_hosted_runtimes(state: &ApiState) -> Result<(), ApiError> {
    let Some(fly) = state.fly_runtime_service.as_ref() else {
        return Ok(());
    };
    let rows = sqlx::query_as::<_, LifecycleRow>(
        r#"
        SELECT id, user_id, fly_machine_id, status, memory_mb,
               idle_timeout_minutes, last_activity_at
        FROM hosted_runtime_instances
        WHERE status IN ('starting', 'running', 'stopping')
        "#,
    )
    .fetch_all(&state.db)
    .await?;

    for row in rows {
        let Some(machine_id) = row.fly_machine_id.as_deref() else {
            continue;
        };

        if row.status == "running" {
            let quota = state.quota_service.ensure_quota(&row.user_id).await?;
            let usage = hosted_usage_summary(&state.db, &row.user_id).await?;
            let instance_count: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM hosted_runtime_instances WHERE user_id = ? AND status NOT IN ('destroying', 'destroyed')",
            )
            .bind(&row.user_id)
            .fetch_one(&state.db)
            .await?;
            let entitlement_revoked = !quota.can_create_hosted_runtime
                || quota.max_hosted_runtimes <= 0
                || quota.max_hosted_runtime_hours_monthly <= 0;
            let plan_limit_changed = row.memory_mb > quota.max_hosted_runtime_memory_mb
                || instance_count > quota.max_hosted_runtimes;
            let hours_exhausted = quota.max_hosted_runtime_hours_monthly > 0
                && usage.total_seconds >= quota.max_hosted_runtime_hours_monthly * 3600;
            let spend_cap_exhausted = match state
                .quota_service
                .check_spend_cap(&row.user_id, &quota)
                .await
            {
                Ok(()) => false,
                Err(ApiError::Forbidden(_)) => true,
                Err(error) => {
                    warn!(instance_id = %row.id, "Unable to evaluate hosted spend cap: {}", error);
                    false
                }
            };
            let idle = row
                .last_activity_at
                .map(|last| {
                    row.idle_timeout_minutes > 0
                        && Utc::now().signed_duration_since(last).num_minutes()
                            >= row.idle_timeout_minutes
                })
                .unwrap_or(false);

            if entitlement_revoked
                || plan_limit_changed
                || hours_exhausted
                || spend_cap_exhausted
                || idle
            {
                let reason = if entitlement_revoked {
                    "plan_entitlement_removed"
                } else if plan_limit_changed {
                    "plan_limit_changed"
                } else if hours_exhausted {
                    "monthly_hours_exhausted"
                } else if spend_cap_exhausted {
                    "monthly_spend_cap"
                } else {
                    "idle_timeout"
                };
                match fly.stop(machine_id).await {
                    Ok(()) => {
                        sqlx::query(
                            r#"
                            UPDATE hosted_runtime_instances
                            SET status = 'stopped', stopped_at = CURRENT_TIMESTAMP,
                                active_since = NULL, stop_reason = ?
                            WHERE id = ?
                            "#,
                        )
                        .bind(reason)
                        .bind(&row.id)
                        .execute(&state.db)
                        .await?;
                        record_runtime_stopped(&state.db, &row.id, reason).await?;
                        info!(instance_id = %row.id, %reason, "Hosted runtime auto-stopped");
                    }
                    Err(error) => {
                        warn!(instance_id = %row.id, "Hosted runtime auto-stop failed: {}", error)
                    }
                }
                continue;
            }
        }

        match fly.status(machine_id).await {
            Ok(FlyMachineState::Started) => {
                sqlx::query(
                    r#"
                    UPDATE hosted_runtime_instances
                    SET status = 'running', active_since = COALESCE(active_since, CURRENT_TIMESTAMP),
                        started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                        last_activity_at = COALESCE(last_activity_at, CURRENT_TIMESTAMP),
                        last_synced_at = CURRENT_TIMESTAMP, error_message = NULL
                    WHERE id = ?
                    "#,
                )
                .bind(&row.id)
                .execute(&state.db)
                .await?;
                record_runtime_started(&state.db, &row.id).await?;
            }
            Ok(FlyMachineState::Stopped) => {
                sqlx::query(
                    r#"
                    UPDATE hosted_runtime_instances
                    SET status = 'stopped', stopped_at = COALESCE(stopped_at, CURRENT_TIMESTAMP),
                        active_since = NULL, last_synced_at = CURRENT_TIMESTAMP,
                        stop_reason = COALESCE(stop_reason, 'provider_stopped')
                    WHERE id = ?
                    "#,
                )
                .bind(&row.id)
                .execute(&state.db)
                .await?;
                record_runtime_stopped(&state.db, &row.id, "provider_stopped").await?;
            }
            Ok(FlyMachineState::Starting | FlyMachineState::Created) => {
                sqlx::query(
                    "UPDATE hosted_runtime_instances SET status = 'starting', last_synced_at = CURRENT_TIMESTAMP WHERE id = ?",
                )
                .bind(&row.id)
                .execute(&state.db)
                .await?;
            }
            Ok(FlyMachineState::Stopping) => {
                sqlx::query(
                    "UPDATE hosted_runtime_instances SET status = 'stopping', last_synced_at = CURRENT_TIMESTAMP WHERE id = ?",
                )
                .bind(&row.id)
                .execute(&state.db)
                .await?;
            }
            Ok(FlyMachineState::Destroying | FlyMachineState::Destroyed) => {
                sqlx::query(
                    "UPDATE hosted_runtime_instances SET status = 'destroyed', destroyed_at = COALESCE(destroyed_at, CURRENT_TIMESTAMP), last_synced_at = CURRENT_TIMESTAMP WHERE id = ?",
                )
                .bind(&row.id)
                .execute(&state.db)
                .await?;
                record_runtime_stopped(&state.db, &row.id, "destroyed").await?;
            }
            Ok(FlyMachineState::Other(provider_state)) => {
                debug!(instance_id = %row.id, %provider_state, "Unmapped Fly Machine state");
            }
            Err(error) => {
                warn!(instance_id = %row.id, "Fly status reconciliation failed: {}", error)
            }
        }
    }

    Ok(())
}


#[cfg(test)]
mod tests {
    use super::*;

    /// Minimal hosted-instance/usage/cost-rate shape for the wake path. The
    /// partial unique index matters: `record_runtime_started` relies on
    /// INSERT OR IGNORE to keep one open session per instance.
    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        sqlx::query(
            r#"
            CREATE TABLE hosted_runtime_instances (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                runtime_device_id TEXT,
                status TEXT NOT NULL,
                fly_machine_id TEXT,
                cost_rate_provider TEXT,
                cost_rate_region TEXT,
                cost_rate_instance_type TEXT,
                started_at TIMESTAMP,
                stopped_at TIMESTAMP,
                active_since TIMESTAMP,
                last_activity_at TIMESTAMP,
                stop_reason TEXT
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE cost_rates (
                id INTEGER PRIMARY KEY,
                provider TEXT NOT NULL,
                region TEXT NOT NULL,
                instance_type TEXT NOT NULL,
                cost_per_hour REAL NOT NULL DEFAULT 0
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE hosted_runtime_usage_sessions (
                id TEXT PRIMARY KEY,
                hosted_instance_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                duration_seconds INTEGER,
                cost_per_hour REAL NOT NULL DEFAULT 0,
                estimated_cost_usd REAL,
                stop_reason TEXT
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        sqlx::query(
            r#"
            CREATE UNIQUE INDEX idx_hosted_usage_one_open_session
                ON hosted_runtime_usage_sessions(hosted_instance_id)
                WHERE ended_at IS NULL
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        // record_runtime_started reads the rate as REAL; a matching cost_rates
        // row keeps COALESCE(cost_per_hour, 0) from degrading to INTEGER.
        sqlx::query(
            "INSERT INTO cost_rates (provider, region, instance_type, cost_per_hour) VALUES ('fly', 'lax', 'shared-cpu-1x-1024mb', 0.0079)",
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    async fn insert_instance(
        pool: &SqlitePool,
        id: &str,
        runtime_device_id: Option<&str>,
        status: &str,
        machine_id: Option<&str>,
    ) {
        sqlx::query(
            r#"
            INSERT INTO hosted_runtime_instances (
                id, user_id, runtime_device_id, status, fly_machine_id,
                cost_rate_provider, cost_rate_region, cost_rate_instance_type
            ) VALUES (?, 'user_1', ?, ?, ?, 'fly', 'lax', 'shared-cpu-1x-1024mb')
            "#,
        )
        .bind(id)
        .bind(runtime_device_id)
        .bind(status)
        .bind(machine_id)
        .execute(pool)
        .await
        .unwrap();
    }

    #[test]
    fn wake_decision_maps_statuses() {
        assert_eq!(
            hosted_wake_decision("stopped", true),
            HostedWakeDecision::StartRequired
        );
        assert_eq!(
            hosted_wake_decision("stopping", true),
            HostedWakeDecision::StartRequired
        );
        assert_eq!(
            hosted_wake_decision("running", true),
            HostedWakeDecision::AlreadyActive
        );
        assert_eq!(
            hosted_wake_decision("starting", true),
            HostedWakeDecision::AlreadyActive
        );
        for status in ["creating", "error", "destroying", "destroyed"] {
            assert_eq!(
                hosted_wake_decision(status, true),
                HostedWakeDecision::NotWakeable,
                "{status} must not be woken"
            );
        }
        assert_eq!(
            hosted_wake_decision("stopped", false),
            HostedWakeDecision::NotWakeable,
            "no machine id means there is nothing to start"
        );
    }

    #[tokio::test]
    async fn wake_target_resolves_hosted_device_and_decision() {
        let pool = test_pool().await;
        insert_instance(&pool, "hr_1", Some("rd_1"), "stopped", Some("m_123")).await;
        insert_instance(&pool, "hr_2", Some("rd_2"), "running", Some("m_456")).await;

        let target = hosted_wake_target(&pool, "rd_1").await.unwrap().unwrap();
        assert_eq!(target.instance_id, "hr_1");
        assert_eq!(target.machine_id, "m_123");
        assert_eq!(target.decision, HostedWakeDecision::StartRequired);

        let target = hosted_wake_target(&pool, "rd_2").await.unwrap().unwrap();
        assert_eq!(target.decision, HostedWakeDecision::AlreadyActive);

        assert!(
            hosted_wake_target(&pool, "rd_desktop").await.unwrap().is_none(),
            "non-hosted devices are not wake targets"
        );
    }

    #[tokio::test]
    async fn mark_starting_transitions_status_and_opens_one_billing_session() {
        let pool = test_pool().await;
        insert_instance(&pool, "hr_1", Some("rd_1"), "stopped", Some("m_123")).await;

        mark_hosted_instance_starting(&pool, "hr_1").await.unwrap();

        let (status, stop_reason, started_at): (String, Option<String>, Option<String>) =
            sqlx::query_as(
                "SELECT status, stop_reason, started_at FROM hosted_runtime_instances WHERE id = 'hr_1'",
            )
            .fetch_one(&pool)
            .await
            .unwrap();
        assert_eq!(status, "starting");
        assert!(stop_reason.is_none());
        assert!(started_at.is_some());

        // The wake helper is safe to repeat (e.g. two clients racing a wake):
        // the status transition is idempotent and the open-session unique
        // index keeps a single billable interval.
        mark_hosted_instance_starting(&pool, "hr_1").await.unwrap();
        let open_sessions: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM hosted_runtime_usage_sessions WHERE hosted_instance_id = 'hr_1' AND ended_at IS NULL",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(open_sessions, 1, "wake opens exactly one billing session");
    }
}
