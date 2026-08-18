//! Dynamic model catalog routes.

use crate::catalog::CatalogSource;
use crate::AppState;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Catalog query parameters.
#[derive(Debug, Deserialize)]
pub struct CatalogQuery {
    #[serde(default = "default_source")]
    pub source: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
}

fn default_source() -> String {
    "all".to_string()
}

fn default_limit() -> usize {
    50
}

/// Catalog list response.
#[derive(Debug, Serialize)]
pub struct CatalogResponse {
    pub models: Vec<crate::catalog::CatalogEntry>,
    pub count: usize,
}

/// Refresh response.
#[derive(Debug, Serialize)]
pub struct RefreshResponse {
    pub refreshed: bool,
    pub count: usize,
}

/// Error response.
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub fn create_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/catalog", get(list_catalog))
        .route("/catalog/refresh", post(refresh_catalog))
        .with_state(state)
}

async fn list_catalog(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CatalogQuery>,
) -> Json<CatalogResponse> {
    let source = CatalogSource::from_str(&query.source);
    let limit = query.limit.max(1).min(200);
    let models = state.catalog.catalog(source, limit).await;
    let count = models.len();
    Json(CatalogResponse { models, count })
}

async fn refresh_catalog(
    State(state): State<Arc<AppState>>,
) -> Result<Json<RefreshResponse>, (StatusCode, Json<ErrorResponse>)> {
    match state.catalog.refresh().await {
        Ok(count) => Ok(Json(RefreshResponse {
            refreshed: true,
            count,
        })),
        Err(err) => Err((
            StatusCode::BAD_GATEWAY,
            Json(ErrorResponse {
                error: format!("failed to refresh catalog: {}", err),
            }),
        )),
    }
}
