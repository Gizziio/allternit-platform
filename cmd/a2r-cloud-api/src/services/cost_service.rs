//! Cost tracking service
//!
//! Manages cost calculation, tracking, and budget monitoring for cloud runs.
//! Provides functionality to track costs per run, per user/tenant, and
//! send alerts when budget thresholds are exceeded.

use crate::error::ApiError;
use async_trait::async_trait;
use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use sqlx::SqlitePool;
use std::sync::Arc;
use tokio::time::interval;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Cost rates for a specific provider/region/instance combination
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct CostRate {
    pub provider: String,
    pub region: String,
    pub instance_type: String,
    pub cost_per_hour: f64,
    pub storage_cost_per_gb_month: f64,
    pub transfer_cost_per_gb: f64,
    pub currency: String,
    pub effective_from: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Cost record for a specific run
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct RunCost {
    pub id: String,
    pub run_id: String,
    pub instance_cost: f64,
    pub storage_cost: f64,
    pub transfer_cost: f64,
    pub total_cost: f64,
    pub provider: Option<String>,
    pub region: Option<String>,
    pub instance_type: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub ended_at: Option<DateTime<Utc>>,
    pub duration_seconds: Option<i64>,
    pub storage_gb: Option<f64>,
    pub transfer_gb: Option<f64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Summary of costs for a run (for API responses)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct RunCostSummary {
    pub run_id: String,
    pub instance_cost: f64,
    pub storage_cost: f64,
    pub transfer_cost: f64,
    pub total_cost: f64,
    pub provider: Option<String>,
    pub region: Option<String>,
    pub instance_type: Option<String>,
    pub duration_seconds: Option<i64>,
    pub currency: String,
}

/// User cost budget and tracking
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct UserCostBudget {
    pub user_id: String,
    pub monthly_budget: f64,
    pub current_month_cost: f64,
    pub alert_threshold: f64,
    pub last_alert_at: Option<DateTime<Utc>>,
    pub alert_enabled: bool,
    pub currency: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Cost alert record
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct CostAlert {
    pub id: String,
    pub user_id: String,
    pub alert_type: AlertType,
    pub threshold_percent: Option<f64>,
    pub current_cost: f64,
    pub budget_amount: f64,
    pub message: String,
    pub sent_at: DateTime<Utc>,
}

/// Type of cost alert
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize, sqlx::Type)]
#[sqlx(rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum AlertType {
    Threshold,
    OverBudget,
    ProjectedOver,
}

impl std::fmt::Display for AlertType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AlertType::Threshold => write!(f, "threshold"),
            AlertType::OverBudget => write!(f, "over_budget"),
            AlertType::ProjectedOver => write!(f, "projected_over"),
        }
    }
}

/// Cost summary for a user (aggregated)
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct UserCostSummary {
    pub user_id: String,
    pub current_month_cost: f64,
    pub monthly_budget: f64,
    pub budget_utilization_percent: f64,
    pub currency: String,
    pub run_count: i64,
    pub total_duration_seconds: i64,
}

/// Cost breakdown by provider/region
#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct CostBreakdown {
    pub provider: String,
    pub region: String,
    pub instance_type: String,
    pub total_cost: f64,
    pub run_count: i64,
    pub total_duration_hours: f64,
}

/// Request to update user budget
#[derive(Debug, Clone, serde::Deserialize)]
pub struct UpdateBudgetRequest {
    pub monthly_budget: Option<f64>,
    pub alert_threshold: Option<f64>,
    pub alert_enabled: Option<bool>,
}

/// Request to create/update cost rate
#[derive(Debug, Clone, serde::Deserialize)]
pub struct SetCostRateRequest {
    pub provider: String,
    pub region: String,
    pub instance_type: String,
    pub cost_per_hour: f64,
    pub storage_cost_per_gb_month: Option<f64>,
    pub transfer_cost_per_gb: Option<f64>,
    pub currency: Option<String>,
}

/// Cost service trait - defines the interface for cost tracking
#[async_trait]
pub trait CostService: Send + Sync {
    /// Initialize cost tracking for a run when it starts
    async fn init_run_cost(
        &self,
        run_id: &str,
        provider: &str,
        region: &str,
        instance_type: &str,
    ) -> Result<RunCost, ApiError>;

    /// Finalize cost tracking when a run ends
    async fn finalize_run_cost(
        &self,
        run_id: &str,
        storage_gb: Option<f64>,
        transfer_gb: Option<f64>,
    ) -> Result<RunCost, ApiError>;

    /// Update costs for a running instance (periodic update)
    async fn update_running_cost(&self, run_id: &str) -> Result<RunCost, ApiError>;

    /// Get cost for a specific run
    async fn get_run_cost(&self, run_id: &str) -> Result<RunCost, ApiError>;

    /// Get or initialize user budget
    async fn get_or_init_user_budget(&self, user_id: &str) -> Result<UserCostBudget, ApiError>;

    /// Update user budget settings
    async fn update_user_budget(
        &self,
        user_id: &str,
        request: UpdateBudgetRequest,
    ) -> Result<UserCostBudget, ApiError>;

    /// Get cost summary for a user
    async fn get_user_cost_summary(&self, user_id: &str) -> Result<UserCostSummary, ApiError>;

    /// Get cost breakdown by provider/region for a user
    async fn get_user_cost_breakdown(
        &self,
        user_id: &str,
    ) -> Result<Vec<CostBreakdown>, ApiError>;

    /// Check and send budget alerts for a user
    async fn check_budget_alerts(&self, user_id: &str) -> Result<Vec<CostAlert>, ApiError>;

    /// Get cost rate for a provider/region/instance
    async fn get_cost_rate(
        &self,
        provider: &str,
        region: &str,
        instance_type: &str,
    ) -> Result<CostRate, ApiError>;

    /// Set or update cost rate
    async fn set_cost_rate(&self, request: SetCostRateRequest) -> Result<CostRate, ApiError>;

    /// List all cost rates
    async fn list_cost_rates(&self) -> Result<Vec<CostRate>, ApiError>;

    /// Recalculate all costs for current month (admin operation)
    async fn recalculate_monthly_costs(&self) -> Result<(), ApiError>;

    /// Update current month costs for all users (called periodically)
    async fn update_monthly_costs(&self) -> Result<(), ApiError>;
}

/// Implementation of CostService using SQLite
pub struct CostServiceImpl {
    db: SqlitePool,
}

impl CostServiceImpl {
    /// Create a new CostServiceImpl
    pub fn new(db: SqlitePool) -> Self {
        Self { db }
    }

    /// Create from an existing pool reference
    pub fn from_arc(db: Arc<SqlitePool>) -> Self {
        Self {
            db: (*db).clone(),
        }
    }

    /// Calculate instance cost based on duration and rate
    fn calculate_instance_cost(&self, duration_seconds: i64, cost_per_hour: f64) -> f64 {
        let hours = duration_seconds as f64 / 3600.0;
        hours * cost_per_hour
    }

    /// Calculate storage cost based on usage and duration
    fn calculate_storage_cost(
        &self,
        storage_gb: f64,
        duration_seconds: i64,
        cost_per_gb_month: f64,
    ) -> f64 {
        // Convert duration to fraction of month (approximate 30 days)
        let month_fraction = duration_seconds as f64 / (30.0 * 24.0 * 3600.0);
        storage_gb * month_fraction * cost_per_gb_month
    }

    /// Calculate transfer cost
    fn calculate_transfer_cost(&self, transfer_gb: f64, cost_per_gb: f64) -> f64 {
        transfer_gb * cost_per_gb
    }

    /// Send alert notification (placeholder for actual notification logic)
    async fn send_alert(&self, alert: &CostAlert) -> Result<(), ApiError> {
        // TODO: Integrate with notification service (email, webhook, etc.)
        info!(
            "Cost alert for user {}: {} - {}",
            alert.user_id, alert.alert_type, alert.message
        );
        Ok(())
    }
}

#[async_trait]
impl CostService for CostServiceImpl {
    async fn init_run_cost(
        &self,
        run_id: &str,
        provider: &str,
        region: &str,
        instance_type: &str,
    ) -> Result<RunCost, ApiError> {
        let cost_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        // Check if cost record already exists for this run
        let existing: Option<RunCost> = sqlx::query_as(
            "SELECT * FROM run_costs WHERE run_id = ?"
        )
        .bind(run_id)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        if let Some(cost) = existing {
            // Update existing record
            let updated = sqlx::query_as::<_, RunCost>(
                r#"
                UPDATE run_costs 
                SET provider = ?, region = ?, instance_type = ?, started_at = ?, updated_at = ?
                WHERE id = ?
                RETURNING *
                "#
            )
            .bind(provider)
            .bind(region)
            .bind(instance_type)
            .bind(now)
            .bind(now)
            .bind(cost.id)
            .fetch_one(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;

            return Ok(updated);
        }

        // Create new cost record
        let cost = sqlx::query_as::<_, RunCost>(
            r#"
            INSERT INTO run_costs (
                id, run_id, instance_cost, storage_cost, transfer_cost, total_cost,
                provider, region, instance_type, started_at, ended_at, duration_seconds,
                storage_gb, transfer_gb, created_at, updated_at
            ) VALUES (?, ?, 0, 0, 0, 0, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
            RETURNING *
            "#
        )
        .bind(&cost_id)
        .bind(run_id)
        .bind(provider)
        .bind(region)
        .bind(instance_type)
        .bind(now)
        .bind(now)
        .bind(now)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        info!(
            "Initialized cost tracking for run {} with {} {} in {}",
            run_id, provider, instance_type, region
        );

        Ok(cost)
    }

    async fn finalize_run_cost(
        &self,
        run_id: &str,
        storage_gb: Option<f64>,
        transfer_gb: Option<f64>,
    ) -> Result<RunCost, ApiError> {
        let now = Utc::now();

        // Get the cost record
        let cost: RunCost = sqlx::query_as("SELECT * FROM run_costs WHERE run_id = ?")
            .bind(run_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?
            .ok_or_else(|| ApiError::NotFound(format!("Cost record not found for run: {}", run_id)))?;

        // Get cost rate
        let rate_result = if let (Some(provider), Some(region), Some(instance_type)) = 
            (&cost.provider, &cost.region, &cost.instance_type) {
            self.get_cost_rate(provider, region, instance_type).await.ok()
        } else {
            None
        };

        // Calculate duration
        let started_at = cost.started_at.unwrap_or(now);
        let duration_seconds = (now - started_at).num_seconds();

        // Calculate costs
        let instance_cost = if let Some(ref rate) = rate_result {
            self.calculate_instance_cost(duration_seconds, rate.cost_per_hour)
        } else {
            cost.instance_cost
        };

        let storage_cost = if let (Some(storage), Some(ref rate)) = (storage_gb, &rate_result) {
            self.calculate_storage_cost(storage, duration_seconds, rate.storage_cost_per_gb_month)
        } else {
            cost.storage_cost
        };

        let transfer_cost = if let (Some(transfer), Some(ref rate)) = (transfer_gb, &rate_result) {
            self.calculate_transfer_cost(transfer, rate.transfer_cost_per_gb)
        } else {
            cost.transfer_cost
        };

        let total_cost = instance_cost + storage_cost + transfer_cost;

        // Update the cost record
        let updated = sqlx::query_as::<_, RunCost>(
            r#"
            UPDATE run_costs 
            SET instance_cost = ?, storage_cost = ?, transfer_cost = ?, total_cost = ?,
                ended_at = ?, duration_seconds = ?, storage_gb = ?, transfer_gb = ?, updated_at = ?
            WHERE run_id = ?
            RETURNING *
            "#
        )
        .bind(instance_cost)
        .bind(storage_cost)
        .bind(transfer_cost)
        .bind(total_cost)
        .bind(now)
        .bind(duration_seconds)
        .bind(storage_gb)
        .bind(transfer_gb)
        .bind(now)
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        // Update user monthly costs
        self.update_monthly_costs().await?;

        info!(
            "Finalized cost tracking for run {}: total_cost=${:.4}",
            run_id, total_cost
        );

        Ok(updated)
    }

    async fn update_running_cost(&self, run_id: &str) -> Result<RunCost, ApiError> {
        let now = Utc::now();

        // Get the cost record
        let cost: RunCost = sqlx::query_as("SELECT * FROM run_costs WHERE run_id = ?")
            .bind(run_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?
            .ok_or_else(|| ApiError::NotFound(format!("Cost record not found for run: {}", run_id)))?;

        // Only update if started and not ended
        if cost.started_at.is_none() || cost.ended_at.is_some() {
            return Ok(cost);
        }

        // Get cost rate
        let rate_result = if let (Some(provider), Some(region), Some(instance_type)) = 
            (&cost.provider, &cost.region, &cost.instance_type) {
            self.get_cost_rate(provider, region, instance_type).await.ok()
        } else {
            None
        };

        // Calculate current duration
        let started_at = cost.started_at.unwrap();
        let duration_seconds = (now - started_at).num_seconds();

        // Calculate current costs
        let instance_cost = if let Some(ref rate) = rate_result {
            self.calculate_instance_cost(duration_seconds, rate.cost_per_hour)
        } else {
            cost.instance_cost
        };

        let storage_cost = if let (Some(storage), Some(ref rate)) = (cost.storage_gb, &rate_result) {
            self.calculate_storage_cost(storage, duration_seconds, rate.storage_cost_per_gb_month)
        } else {
            cost.storage_cost
        };

        let total_cost = instance_cost + storage_cost + cost.transfer_cost;

        // Update the cost record
        let updated = sqlx::query_as::<_, RunCost>(
            r#"
            UPDATE run_costs 
            SET instance_cost = ?, storage_cost = ?, total_cost = ?, duration_seconds = ?, updated_at = ?
            WHERE run_id = ?
            RETURNING *
            "#
        )
        .bind(instance_cost)
        .bind(storage_cost)
        .bind(total_cost)
        .bind(duration_seconds)
        .bind(now)
        .bind(run_id)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        Ok(updated)
    }

    async fn get_run_cost(&self, run_id: &str) -> Result<RunCost, ApiError> {
        let cost: Option<RunCost> = sqlx::query_as("SELECT * FROM run_costs WHERE run_id = ?")
            .bind(run_id)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;

        cost.ok_or_else(|| ApiError::NotFound(format!("Cost record not found for run: {}", run_id)))
    }

    async fn get_or_init_user_budget(&self, user_id: &str) -> Result<UserCostBudget, ApiError> {
        // Try to get existing budget
        let budget: Option<UserCostBudget> = 
            sqlx::query_as("SELECT * FROM user_cost_budgets WHERE user_id = ?")
                .bind(user_id)
                .fetch_optional(&self.db)
                .await
                .map_err(ApiError::DatabaseError)?;

        if let Some(budget) = budget {
            return Ok(budget);
        }

        // Create default budget
        let now = Utc::now();
        let budget = sqlx::query_as::<_, UserCostBudget>(
            r#"
            INSERT INTO user_cost_budgets (
                user_id, monthly_budget, current_month_cost, alert_threshold, 
                last_alert_at, alert_enabled, currency, created_at, updated_at
            ) VALUES (?, 100.0, 0.0, 80.0, NULL, 1, 'USD', ?, ?)
            RETURNING *
            "#
        )
        .bind(user_id)
        .bind(now)
        .bind(now)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        info!("Initialized default budget for user: {}", user_id);

        Ok(budget)
    }

    async fn update_user_budget(
        &self,
        user_id: &str,
        request: UpdateBudgetRequest,
    ) -> Result<UserCostBudget, ApiError> {
        let now = Utc::now();

        // Build update query dynamically
        let mut updates = Vec::new();
        
        if let Some(budget) = request.monthly_budget {
            updates.push(format!("monthly_budget = {}", budget));
        }
        if let Some(threshold) = request.alert_threshold {
            updates.push(format!("alert_threshold = {}", threshold));
        }
        if let Some(enabled) = request.alert_enabled {
            updates.push(format!("alert_enabled = {}", if enabled { 1 } else { 0 }));
        }

        if updates.is_empty() {
            return self.get_or_init_user_budget(user_id).await;
        }

        updates.push(format!("updated_at = '{}'", now.to_rfc3339()));

        let query = format!(
            "UPDATE user_cost_budgets SET {} WHERE user_id = ? RETURNING *",
            updates.join(", ")
        );

        let budget = sqlx::query_as::<_, UserCostBudget>(&query)
            .bind(user_id)
            .fetch_one(&self.db)
            .await
            .map_err(|e| {
                if matches!(e, sqlx::Error::RowNotFound) {
                    ApiError::NotFound(format!("User budget not found: {}", user_id))
                } else {
                    ApiError::DatabaseError(e)
                }
            })?;

        Ok(budget)
    }

    async fn get_user_cost_summary(&self, user_id: &str) -> Result<UserCostSummary, ApiError> {
        let budget = self.get_or_init_user_budget(user_id).await?;

        // Get current month start
        let now = Utc::now();
        let month_start = now.with_day(1).unwrap_or(now).with_hour(0).unwrap_or(now).with_minute(0).unwrap_or(now);

        // Aggregate costs for this user
        let result: Option<(f64, i64, i64)> = sqlx::query_as(
            r#"
            SELECT 
                COALESCE(SUM(rc.total_cost), 0) as total_cost,
                COUNT(rc.id) as run_count,
                COALESCE(SUM(rc.duration_seconds), 0) as total_duration
            FROM run_costs rc
            JOIN runs r ON rc.run_id = r.id
            WHERE r.owner_id = ? 
            AND rc.started_at >= ?
            "#
        )
        .bind(user_id)
        .bind(month_start)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        let (current_cost, run_count, total_duration) = result.unwrap_or((0.0, 0, 0));

        // Update current_month_cost in budget
        sqlx::query(
            "UPDATE user_cost_budgets SET current_month_cost = ? WHERE user_id = ?"
        )
        .bind(current_cost)
        .bind(user_id)
        .execute(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        let utilization = if budget.monthly_budget > 0.0 {
            (current_cost / budget.monthly_budget) * 100.0
        } else {
            0.0
        };

        Ok(UserCostSummary {
            user_id: user_id.to_string(),
            current_month_cost: current_cost,
            monthly_budget: budget.monthly_budget,
            budget_utilization_percent: utilization,
            currency: budget.currency,
            run_count,
            total_duration_seconds: total_duration,
        })
    }

    async fn get_user_cost_breakdown(
        &self,
        user_id: &str,
    ) -> Result<Vec<CostBreakdown>, ApiError> {
        let now = Utc::now();
        let month_start = now.with_day(1).unwrap_or(now).with_hour(0).unwrap_or(now).with_minute(0).unwrap_or(now);

        let breakdown: Vec<CostBreakdown> = sqlx::query_as(
            r#"
            SELECT 
                COALESCE(rc.provider, 'unknown') as provider,
                COALESCE(rc.region, 'unknown') as region,
                COALESCE(rc.instance_type, 'unknown') as instance_type,
                COALESCE(SUM(rc.total_cost), 0) as total_cost,
                COUNT(rc.id) as run_count,
                COALESCE(SUM(rc.duration_seconds), 0) / 3600.0 as total_duration_hours
            FROM run_costs rc
            JOIN runs r ON rc.run_id = r.id
            WHERE r.owner_id = ? 
            AND rc.started_at >= ?
            GROUP BY rc.provider, rc.region, rc.instance_type
            ORDER BY total_cost DESC
            "#
        )
        .bind(user_id)
        .bind(month_start)
        .fetch_all(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        Ok(breakdown)
    }

    async fn check_budget_alerts(&self, user_id: &str) -> Result<Vec<CostAlert>, ApiError> {
        let budget = self.get_or_init_user_budget(user_id).await?;
        let summary = self.get_user_cost_summary(user_id).await?;

        if !budget.alert_enabled || budget.monthly_budget <= 0.0 {
            return Ok(Vec::new());
        }

        let utilization_percent = summary.budget_utilization_percent;
        let threshold = budget.alert_threshold;

        let mut alerts = Vec::new();

        // Check if we should send a threshold alert
        if utilization_percent >= threshold {
            // Check if we've already sent an alert recently (within last 24 hours)
            let should_alert = if let Some(last_alert) = budget.last_alert_at {
                (Utc::now() - last_alert) > Duration::hours(24)
            } else {
                true
            };

            if should_alert {
                let alert_type = if utilization_percent >= 100.0 {
                    AlertType::OverBudget
                } else {
                    AlertType::Threshold
                };

                let message = if utilization_percent >= 100.0 {
                    format!(
                        "You have exceeded your monthly budget of ${:.2}. Current cost: ${:.2} ({:.1}%)",
                        budget.monthly_budget, summary.current_month_cost, utilization_percent
                    )
                } else {
                    format!(
                        "You have reached {:.1}% of your monthly budget of ${:.2}. Current cost: ${:.2}",
                        utilization_percent, budget.monthly_budget, summary.current_month_cost
                    )
                };

                let alert_id = Uuid::new_v4().to_string();
                let alert: CostAlert = sqlx::query_as(
                    r#"
                    INSERT INTO cost_alerts (id, user_id, alert_type, threshold_percent, current_cost, budget_amount, message, sent_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    RETURNING *
                    "#
                )
                .bind(&alert_id)
                .bind(user_id)
                .bind(alert_type)
                .bind(threshold)
                .bind(summary.current_month_cost)
                .bind(budget.monthly_budget)
                .bind(&message)
                .bind(Utc::now())
                .fetch_one(&self.db)
                .await
                .map_err(ApiError::DatabaseError)?;

                // Update last_alert_at
                sqlx::query(
                    "UPDATE user_cost_budgets SET last_alert_at = ? WHERE user_id = ?"
                )
                .bind(Utc::now())
                .bind(user_id)
                .execute(&self.db)
                .await
                .map_err(ApiError::DatabaseError)?;

                // Send the alert
                self.send_alert(&alert).await?;

                alerts.push(alert);
            }
        }

        Ok(alerts)
    }

    async fn get_cost_rate(
        &self,
        provider: &str,
        region: &str,
        instance_type: &str,
    ) -> Result<CostRate, ApiError> {
        let rate: Option<CostRate> = sqlx::query_as(
            "SELECT * FROM cost_rates WHERE provider = ? AND region = ? AND instance_type = ?"
        )
        .bind(provider)
        .bind(region)
        .bind(instance_type)
        .fetch_optional(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        rate.ok_or_else(|| {
            ApiError::NotFound(format!(
                "Cost rate not found for {}/{}/{}",
                provider, region, instance_type
            ))
        })
    }

    async fn set_cost_rate(&self, request: SetCostRateRequest) -> Result<CostRate, ApiError> {
        let now = Utc::now();

        let rate = sqlx::query_as::<_, CostRate>(
            r#"
            INSERT INTO cost_rates (
                provider, region, instance_type, cost_per_hour, storage_cost_per_gb_month,
                transfer_cost_per_gb, currency, effective_from, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(provider, region, instance_type) DO UPDATE SET
                cost_per_hour = excluded.cost_per_hour,
                storage_cost_per_gb_month = excluded.storage_cost_per_gb_month,
                transfer_cost_per_gb = excluded.transfer_cost_per_gb,
                currency = excluded.currency,
                updated_at = excluded.updated_at
            RETURNING *
            "#
        )
        .bind(&request.provider)
        .bind(&request.region)
        .bind(&request.instance_type)
        .bind(request.cost_per_hour)
        .bind(request.storage_cost_per_gb_month.unwrap_or(0.0))
        .bind(request.transfer_cost_per_gb.unwrap_or(0.0))
        .bind(request.currency.as_deref().unwrap_or("USD"))
        .bind(now)
        .bind(now)
        .bind(now)
        .fetch_one(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        info!(
            "Updated cost rate for {}/{}/{}: ${:.4}/hour",
            request.provider, request.region, request.instance_type, request.cost_per_hour
        );

        Ok(rate)
    }

    async fn list_cost_rates(&self) -> Result<Vec<CostRate>, ApiError> {
        let rates: Vec<CostRate> = sqlx::query_as(
            "SELECT * FROM cost_rates ORDER BY provider, region, instance_type"
        )
        .fetch_all(&self.db)
        .await
        .map_err(ApiError::DatabaseError)?;

        Ok(rates)
    }

    async fn recalculate_monthly_costs(&self) -> Result<(), ApiError> {
        let now = Utc::now();
        let month_start = now.with_day(1).unwrap_or(now).with_hour(0).unwrap_or(now).with_minute(0).unwrap_or(now);

        // Get all users with budgets
        let budgets: Vec<UserCostBudget> = 
            sqlx::query_as("SELECT * FROM user_cost_budgets")
                .fetch_all(&self.db)
                .await
                .map_err(ApiError::DatabaseError)?;

        for budget in budgets {
            let result: Option<(f64,)> = sqlx::query_as(
                r#"
                SELECT COALESCE(SUM(rc.total_cost), 0)
                FROM run_costs rc
                JOIN runs r ON rc.run_id = r.id
                WHERE r.owner_id = ? 
                AND rc.started_at >= ?
                "#
            )
            .bind(&budget.user_id)
            .bind(month_start)
            .fetch_optional(&self.db)
            .await
            .map_err(ApiError::DatabaseError)?;

            if let Some((total_cost,)) = result {
                sqlx::query(
                    "UPDATE user_cost_budgets SET current_month_cost = ? WHERE user_id = ?"
                )
                .bind(total_cost)
                .bind(&budget.user_id)
                .execute(&self.db)
                .await
                .map_err(ApiError::DatabaseError)?;

                debug!(
                    "Recalculated monthly cost for user {}: ${:.2}",
                    budget.user_id, total_cost
                );
            }
        }

        Ok(())
    }

    async fn update_monthly_costs(&self) -> Result<(), ApiError> {
        // This is a lightweight version that just recalculates
        self.recalculate_monthly_costs().await
    }
}

/// Start the background cost tracking task
/// 
/// This task periodically:
/// 1. Updates costs for running instances
/// 2. Checks budget thresholds and sends alerts
/// 3. Recalculates monthly costs
pub async fn start_cost_tracking_task(db: SqlitePool) {
    let service = CostServiceImpl::new(db);
    let mut interval = interval(tokio::time::Duration::from_secs(60)); // Run every minute

    info!("Starting background cost tracking task");

    loop {
        interval.tick().await;

        // Update running costs
        if let Err(e) = update_running_costs(&service).await {
            error!("Failed to update running costs: {}", e);
        }

        // Check budget alerts for all users
        if let Err(e) = check_all_budget_alerts(&service).await {
            error!("Failed to check budget alerts: {}", e);
        }
    }
}

/// Update costs for all running instances
async fn update_running_costs(service: &CostServiceImpl) -> Result<(), ApiError> {
    // Get all runs that are currently running and have cost records
    let running_run_ids: Vec<(String,)> = sqlx::query_as(
        r#"
        SELECT rc.run_id 
        FROM run_costs rc
        JOIN runs r ON rc.run_id = r.id
        WHERE r.status = 'running' AND rc.ended_at IS NULL
        "#
    )
    .fetch_all(&service.db)
    .await
    .map_err(ApiError::DatabaseError)?;

    for (run_id,) in running_run_ids {
        if let Err(e) = service.update_running_cost(&run_id).await {
            warn!("Failed to update running cost for run {}: {}", run_id, e);
        }
    }

    Ok(())
}

/// Check budget alerts for all users
async fn check_all_budget_alerts(service: &CostServiceImpl) -> Result<(), ApiError> {
    // Get all users with budgets
    let budgets: Vec<UserCostBudget> = 
        sqlx::query_as("SELECT * FROM user_cost_budgets WHERE alert_enabled = 1")
            .fetch_all(&service.db)
            .await
            .map_err(ApiError::DatabaseError)?;

    for budget in budgets {
        if let Err(e) = service.check_budget_alerts(&budget.user_id).await {
            warn!("Failed to check budget alerts for user {}: {}", budget.user_id, e);
        }
    }

    Ok(())
}

/// Initialize cost tracking for a run (helper function for run lifecycle integration)
pub async fn init_run_cost_tracking(
    db: &SqlitePool,
    run_id: &str,
    provider: &str,
    region: &str,
    instance_type: &str,
) -> Result<(), ApiError> {
    let service = CostServiceImpl::new(db.clone());
    service.init_run_cost(run_id, provider, region, instance_type).await?;
    Ok(())
}

/// Finalize cost tracking for a run (helper function for run lifecycle integration)
pub async fn finalize_run_cost_tracking(
    db: &SqlitePool,
    run_id: &str,
    storage_gb: Option<f64>,
    transfer_gb: Option<f64>,
) -> Result<(), ApiError> {
    let service = CostServiceImpl::new(db.clone());
    service.finalize_run_cost(run_id, storage_gb, transfer_gb).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_instance_cost() {
        let service = CostServiceImpl::new(
            SqlitePool::connect_lazy(":memory:").unwrap()
        );

        // Test 1 hour at $0.01/hour
        assert_eq!(service.calculate_instance_cost(3600, 0.01), 0.01);

        // Test 30 minutes at $0.01/hour
        assert_eq!(service.calculate_instance_cost(1800, 0.01), 0.005);

        // Test 2 hours at $0.05/hour
        assert_eq!(service.calculate_instance_cost(7200, 0.05), 0.10);
    }

    #[test]
    fn test_calculate_storage_cost() {
        let service = CostServiceImpl::new(
            SqlitePool::connect_lazy(":memory:").unwrap()
        );

        // Test 100GB for 15 days at $0.10/GB/month
        let cost = service.calculate_storage_cost(100.0, 15 * 24 * 3600, 0.10);
        assert!(cost > 0.0);
        assert!(cost < 10.0); // Should be roughly $0.50
    }

    #[test]
    fn test_calculate_transfer_cost() {
        let service = CostServiceImpl::new(
            SqlitePool::connect_lazy(":memory:").unwrap()
        );

        // Test 10GB at $0.09/GB
        assert_eq!(service.calculate_transfer_cost(10.0, 0.09), 0.9);

        // Test 0GB
        assert_eq!(service.calculate_transfer_cost(0.0, 0.09), 0.0);
    }
}
