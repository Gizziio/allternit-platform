//! Cost tracking API routes
//!
//! Provides REST endpoints for cost management including:
//! - Run cost retrieval
//! - User cost summaries and breakdowns
//! - Budget management
//! - Cost rate management (admin)

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;
use tracing::{debug, info};

use crate::{
    ApiError, ApiState,
    auth::middleware::AuthContext,
    services::cost_service::{
        CostBreakdown, CostRate, CostService, CostServiceImpl, RunCost,
        SetCostRateRequest, UpdateBudgetRequest, UserCostBudget, UserCostSummary,
    },
};

// ============================================================================
// Query Parameters
// ============================================================================

/// Query parameters for cost summary endpoint
#[derive(Debug, Deserialize, Default)]
pub struct CostSummaryQuery {
    /// Filter by month (YYYY-MM format)
    pub month: Option<String>,
}

/// Query parameters for cost breakdown endpoint
#[derive(Debug, Deserialize, Default)]
pub struct CostBreakdownQuery {
    /// Group by field (provider, region, instance_type)
    pub group_by: Option<String>,
}

// ============================================================================
// Response Types
// ============================================================================

/// Budget status response
#[derive(Debug, serde::Serialize)]
pub struct BudgetStatusResponse {
    pub user_id: String,
    pub monthly_budget: f64,
    pub current_month_cost: f64,
    pub budget_remaining: f64,
    pub budget_utilization_percent: f64,
    pub alert_threshold: f64,
    pub alert_enabled: bool,
    pub currency: String,
}

impl From<UserCostBudget> for BudgetStatusResponse {
    fn from(budget: UserCostBudget) -> Self {
        let remaining = budget.monthly_budget - budget.current_month_cost;
        let utilization = if budget.monthly_budget > 0.0 {
            (budget.current_month_cost / budget.monthly_budget) * 100.0
        } else {
            0.0
        };

        Self {
            user_id: budget.user_id,
            monthly_budget: budget.monthly_budget,
            current_month_cost: budget.current_month_cost,
            budget_remaining: remaining.max(0.0),
            budget_utilization_percent: utilization,
            alert_threshold: budget.alert_threshold,
            alert_enabled: budget.alert_enabled,
            currency: budget.currency,
        }
    }
}

/// Cost summary response with additional metadata
#[derive(Debug, serde::Serialize)]
pub struct CostSummaryResponse {
    pub user_id: String,
    pub current_month_cost: f64,
    pub monthly_budget: f64,
    pub budget_utilization_percent: f64,
    pub budget_status: String,
    pub currency: String,
    pub run_count: i64,
    pub total_duration_seconds: i64,
    pub total_duration_hours: f64,
}

impl From<UserCostSummary> for CostSummaryResponse {
    fn from(summary: UserCostSummary) -> Self {
        let budget_status = if summary.budget_utilization_percent >= 100.0 {
            "over_budget"
        } else if summary.budget_utilization_percent >= 80.0 {
            "warning"
        } else {
            "ok"
        };

        Self {
            user_id: summary.user_id,
            current_month_cost: summary.current_month_cost,
            monthly_budget: summary.monthly_budget,
            budget_utilization_percent: summary.budget_utilization_percent,
            budget_status: budget_status.to_string(),
            currency: summary.currency,
            run_count: summary.run_count,
            total_duration_seconds: summary.total_duration_seconds,
            total_duration_hours: summary.total_duration_seconds as f64 / 3600.0,
        }
    }
}

/// Run cost response with formatted fields
#[derive(Debug, serde::Serialize)]
pub struct RunCostResponse {
    pub run_id: String,
    pub instance_cost: f64,
    pub storage_cost: f64,
    pub transfer_cost: f64,
    pub total_cost: f64,
    pub provider: Option<String>,
    pub region: Option<String>,
    pub instance_type: Option<String>,
    pub duration_seconds: Option<i64>,
    pub duration_formatted: Option<String>,
    pub storage_gb: Option<f64>,
    pub transfer_gb: Option<f64>,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub ended_at: Option<chrono::DateTime<chrono::Utc>>,
    pub currency: String,
}

impl From<RunCost> for RunCostResponse {
    fn from(cost: RunCost) -> Self {
        let duration_formatted = cost.duration_seconds.map(|secs| {
            let hours = secs / 3600;
            let minutes = (secs % 3600) / 60;
            let seconds = secs % 60;
            if hours > 0 {
                format!("{}h {}m {}s", hours, minutes, seconds)
            } else if minutes > 0 {
                format!("{}m {}s", minutes, seconds)
            } else {
                format!("{}s", seconds)
            }
        });

        Self {
            run_id: cost.run_id,
            instance_cost: cost.instance_cost,
            storage_cost: cost.storage_cost,
            transfer_cost: cost.transfer_cost,
            total_cost: cost.total_cost,
            provider: cost.provider,
            region: cost.region,
            instance_type: cost.instance_type,
            duration_seconds: cost.duration_seconds,
            duration_formatted,
            storage_gb: cost.storage_gb,
            transfer_gb: cost.transfer_gb,
            started_at: cost.started_at,
            ended_at: cost.ended_at,
            currency: "USD".to_string(), // TODO: Get from cost rate
        }
    }
}

// ============================================================================
// API Endpoints
// ============================================================================

/// Get cost for a specific run
///
/// Returns the cost breakdown for a single run including instance,
/// storage, and transfer costs.
pub async fn get_run_cost(
    State(state): State<Arc<ApiState>>,
    Path(run_id): Path<String>,
    Extension(auth): Extension<AuthContext>,
) -> Result<Json<RunCostResponse>, ApiError> {
    debug!("Fetching cost for run: {}", run_id);

    // Verify user has access to this run
    let run: crate::db::cowork_models::Run = sqlx::query_as(
        "SELECT * FROM runs WHERE id = ?"
    )
    .bind(&run_id)
    .fetch_optional(&state.db)
    .await
    .map_err(ApiError::DatabaseError)?
    .ok_or_else(|| ApiError::NotFound(format!("Run not found: {}", run_id)))?;

    // Check ownership (simplified - in production, check tenant/organization access too)
    if let Some(owner_id) = &run.owner_id {
        if owner_id != &auth.user.user_id {
            return Err(ApiError::Forbidden(
                "You don't have access to this run's cost data".to_string()
            ));
        }
    }

    let service = CostServiceImpl::new(state.db.clone());
    let cost = service.get_run_cost(&run_id).await?;

    Ok(Json(cost.into()))
}

/// Get cost summary for the current user
///
/// Returns aggregated cost information for the authenticated user
/// including current month costs, budget utilization, and run statistics.
pub async fn get_cost_summary(
    State(state): State<Arc<ApiState>>,
    Extension(auth): Extension<AuthContext>,
    Query(_query): Query<CostSummaryQuery>,
) -> Result<Json<CostSummaryResponse>, ApiError> {
    info!("Fetching cost summary for user: {}", auth.user.user_id);

    let service = CostServiceImpl::new(state.db.clone());
    let summary = service.get_user_cost_summary(&auth.user.user_id).await?;

    Ok(Json(summary.into()))
}

/// Get cost breakdown by provider/region for the current user
///
/// Returns a breakdown of costs grouped by provider, region, and instance type.
pub async fn get_cost_breakdown(
    State(state): State<Arc<ApiState>>,
    Extension(auth): Extension<AuthContext>,
    Query(_query): Query<CostBreakdownQuery>,
) -> Result<Json<Vec<CostBreakdown>>, ApiError> {
    debug!("Fetching cost breakdown for user: {}", auth.user.user_id);

    let service = CostServiceImpl::new(state.db.clone());
    let breakdown = service.get_user_cost_breakdown(&auth.user.user_id).await?;

    Ok(Json(breakdown))
}

/// Get budget status for the current user
///
/// Returns the user's budget settings and current spending status.
pub async fn get_budget(
    State(state): State<Arc<ApiState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<Json<BudgetStatusResponse>, ApiError> {
    debug!("Fetching budget for user: {}", auth.user.user_id);

    let service = CostServiceImpl::new(state.db.clone());
    let budget = service.get_or_init_user_budget(&auth.user.user_id).await?;

    Ok(Json(budget.into()))
}

/// Update budget settings for the current user
///
/// Allows users to update their monthly budget limit, alert threshold,
/// and alert preferences.
pub async fn update_budget(
    State(state): State<Arc<ApiState>>,
    Extension(auth): Extension<AuthContext>,
    Json(request): Json<UpdateBudgetRequest>,
) -> Result<Json<BudgetStatusResponse>, ApiError> {
    info!("Updating budget for user: {}", auth.user.user_id);

    // Validate inputs
    if let Some(budget) = request.monthly_budget {
        if budget < 0.0 {
            return Err(ApiError::BadRequest(
                "Monthly budget cannot be negative".to_string()
            ));
        }
    }

    if let Some(threshold) = request.alert_threshold {
        if threshold < 0.0 || threshold > 100.0 {
            return Err(ApiError::BadRequest(
                "Alert threshold must be between 0 and 100".to_string()
            ));
        }
    }

    let service = CostServiceImpl::new(state.db.clone());
    let budget = service.update_user_budget(&auth.user.user_id, request).await?;

    info!("Updated budget for user: {}", auth.user.user_id);

    Ok(Json(budget.into()))
}

/// Reset monthly costs (admin endpoint)
///
/// Resets the current month cost tracking for all users.
/// Typically called at the start of a new month.
pub async fn reset_monthly_costs(
    State(state): State<Arc<ApiState>>,
    Extension(auth): Extension<AuthContext>,
) -> Result<StatusCode, ApiError> {
    // In a real implementation, check if user is admin
    // For now, we just log and reset
    info!("Resetting monthly costs (requested by: {})", auth.user.user_id);

    sqlx::query("UPDATE user_cost_budgets SET current_month_cost = 0, last_alert_at = NULL")
        .execute(&state.db)
        .await
        .map_err(ApiError::DatabaseError)?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Admin Endpoints
// ============================================================================

/// List all cost rates (admin)
///
/// Returns the current pricing for all provider/region/instance combinations.
pub async fn list_cost_rates(
    State(state): State<Arc<ApiState>>,
    Extension(_auth): Extension<AuthContext>,
) -> Result<Json<Vec<CostRate>>, ApiError> {
    debug!("Listing all cost rates");

    let service = CostServiceImpl::new(state.db.clone());
    let rates = service.list_cost_rates().await?;

    Ok(Json(rates))
}

/// Set or update a cost rate (admin)
///
/// Creates or updates the pricing for a specific provider/region/instance.
pub async fn set_cost_rate(
    State(state): State<Arc<ApiState>>,
    Extension(_auth): Extension<AuthContext>,
    Json(request): Json<SetCostRateRequest>,
) -> Result<Json<CostRate>, ApiError> {
    info!(
        "Setting cost rate for {}/{}/{}: ${:.4}/hour",
        request.provider, request.region, request.instance_type, request.cost_per_hour
    );

    // Validate inputs
    if request.cost_per_hour < 0.0 {
        return Err(ApiError::BadRequest(
            "Cost per hour cannot be negative".to_string()
        ));
    }

    if let Some(storage) = request.storage_cost_per_gb_month {
        if storage < 0.0 {
            return Err(ApiError::BadRequest(
                "Storage cost cannot be negative".to_string()
            ));
        }
    }

    if let Some(transfer) = request.transfer_cost_per_gb {
        if transfer < 0.0 {
            return Err(ApiError::BadRequest(
                "Transfer cost cannot be negative".to_string()
            ));
        }
    }

    let service = CostServiceImpl::new(state.db.clone());
    let rate = service.set_cost_rate(request).await?;

    Ok(Json(rate))
}

/// Recalculate all monthly costs (admin)
///
/// Forces a recalculation of all monthly costs. Useful when pricing
/// changes or to correct any data inconsistencies.
pub async fn recalculate_costs(
    State(state): State<Arc<ApiState>>,
    Extension(_auth): Extension<AuthContext>,
) -> Result<StatusCode, ApiError> {
    info!("Recalculating all monthly costs");

    let service = CostServiceImpl::new(state.db.clone());
    service.recalculate_monthly_costs().await?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Helper Functions
// ============================================================================
