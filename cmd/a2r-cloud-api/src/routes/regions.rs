//! Region routes for Multi-Region Scheduling
//!
//! Provides REST API endpoints for managing and querying cloud regions.

use axum::{
    extract::{Path, Query, State},
    Json,
};
use std::sync::Arc;
use serde::Deserialize;

use crate::{
    ApiError, ApiState,
    db::models::{Region, RegionSummary},
};

/// Query parameters for listing regions
#[derive(Debug, Deserialize, Default)]
pub struct ListRegionsQuery {
    /// Filter by provider (e.g., "aws", "hetzner", "local")
    pub provider: Option<String>,
    /// Only return active regions
    pub active_only: Option<bool>,
    /// Filter by minimum available capacity
    pub min_capacity: Option<i32>,
}

/// List all regions with optional filtering
pub async fn list_regions(
    State(state): State<Arc<ApiState>>,
    Query(query): Query<ListRegionsQuery>,
) -> Result<Json<Vec<RegionSummary>>, ApiError> {
    let regions = if let Some(provider) = query.provider {
        // Filter by provider
        sqlx::query_as::<_, RegionSummary>(
            r#"
            SELECT 
                r.id,
                r.name,
                r.provider,
                r.capacity,
                r.active,
                COALESCE(rc.current_runs, 0) as current_runs,
                COALESCE(rc.queued_runs, 0) as queued_runs,
                r.capacity - COALESCE(rc.current_runs, 0) - COALESCE(rc.queued_runs, 0) as available_capacity
            FROM regions r
            LEFT JOIN region_capacity rc ON r.id = rc.region_id
            WHERE r.provider = ?
            ORDER BY r.name
            "#
        )
        .bind(provider)
        .fetch_all(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?
    } else if query.active_only.unwrap_or(false) {
        // Only active regions
        sqlx::query_as::<_, RegionSummary>(
            r#"
            SELECT 
                r.id,
                r.name,
                r.provider,
                r.capacity,
                r.active,
                COALESCE(rc.current_runs, 0) as current_runs,
                COALESCE(rc.queued_runs, 0) as queued_runs,
                r.capacity - COALESCE(rc.current_runs, 0) - COALESCE(rc.queued_runs, 0) as available_capacity
            FROM regions r
            LEFT JOIN region_capacity rc ON r.id = rc.region_id
            WHERE r.active = TRUE
            ORDER BY r.name
            "#
        )
        .fetch_all(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?
    } else {
        // All regions
        sqlx::query_as::<_, RegionSummary>(
            r#"
            SELECT 
                r.id,
                r.name,
                r.provider,
                r.capacity,
                r.active,
                COALESCE(rc.current_runs, 0) as current_runs,
                COALESCE(rc.queued_runs, 0) as queued_runs,
                r.capacity - COALESCE(rc.current_runs, 0) - COALESCE(rc.queued_runs, 0) as available_capacity
            FROM regions r
            LEFT JOIN region_capacity rc ON r.id = rc.region_id
            ORDER BY r.name
            "#
        )
        .fetch_all(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?
    };

    // Filter by minimum capacity if specified
    let regions = if let Some(min_cap) = query.min_capacity {
        regions.into_iter()
            .filter(|r| r.available_capacity >= min_cap)
            .collect()
    } else {
        regions
    };

    Ok(Json(regions))
}

/// Get a specific region by ID
pub async fn get_region(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<Region>, ApiError> {
    let region = sqlx::query_as::<_, Region>(
        "SELECT * FROM regions WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;

    region.ok_or_else(|| ApiError::NotFound(format!("Region not found: {}", id)))
        .map(Json)
}

/// Get region capacity information
pub async fn get_region_capacity(
    State(state): State<Arc<ApiState>>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    // First check if region exists
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM regions WHERE id = ?)")
        .bind(&id)
        .fetch_one(&state.db)
        .await
        .map_err(|e| ApiError::DatabaseError(e))?;

    if !exists {
        return Err(ApiError::NotFound(format!("Region not found: {}", id)));
    }

    let capacity = sqlx::query_as::<_, crate::db::models::RegionCapacity>(
        "SELECT * FROM region_capacity WHERE region_id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;

    let region = sqlx::query_as::<_, Region>(
        "SELECT capacity FROM regions WHERE id = ?"
    )
    .bind(&id)
    .fetch_one(&state.db)
    .await
    .map_err(|e| ApiError::DatabaseError(e))?;

    let (current, queued) = capacity
        .map(|c| (c.current_runs, c.queued_runs))
        .unwrap_or((0, 0));

    let available = region.capacity - current - queued;

    Ok(Json(serde_json::json!({
        "region_id": id,
        "total_capacity": region.capacity,
        "current_runs": current,
        "queued_runs": queued,
        "available_capacity": available.max(0),
    })))
}
