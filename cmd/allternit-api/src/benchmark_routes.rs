//! Public benchmark leaderboard API.
//!
//! Serves `/api/v1/benchmarks/computer-use-leaderboard` from the
//! `benchmark_results` table so the leaderboard can be updated without
//! redeploying the static export.

use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use rusqlite::OptionalExtension;
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

type ApiError = (StatusCode, Json<serde_json::Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (status, Json(json!({"error": code, "message": message.into()})))
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "benchmark leaderboard operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

pub fn benchmark_router() -> Router<Arc<AppState>> {
    Router::new().route("/benchmarks/computer-use-leaderboard", get(get_computer_use_leaderboard))
}

async fn get_computer_use_leaderboard(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>, ApiError> {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let mut stmt = conn
            .prepare(
                "SELECT agent, organization, success_rate, avg_steps, avg_latency_ms, safety_score, verified, rank, updated_at
                 FROM benchmark_results
                 WHERE benchmark = ?1
                 ORDER BY rank ASC
                 LIMIT 100",
            )
            .map_err(internal)?;

        let rows = stmt
            .query_map(rusqlite::params!["Allternit Computer-Use Leaderboard"], |row| {
                Ok(json!({
                    "rank": row.get::<_, i64>(7)?,
                    "agent": row.get::<_, String>(0)?,
                    "organization": row.get::<_, String>(1)?,
                    "successRate": row.get::<_, f64>(2)?,
                    "avgSteps": row.get::<_, f64>(3)?,
                    "avgLatencyMs": row.get::<_, i64>(4)?,
                    "safetyScore": row.get::<_, f64>(5)?,
                    "verified": row.get::<_, bool>(6)?,
                }))
            })
            .map_err(internal)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(internal)?;

        let updated_at: Option<String> = conn
            .query_row(
                "SELECT MAX(updated_at) FROM benchmark_results WHERE benchmark = ?1",
                rusqlite::params!["Allternit Computer-Use Leaderboard"],
                |row| row.get(0),
            )
            .optional()
            .map_err(internal)?
            .flatten();

        Ok::<_, ApiError>(json!({
            "updatedAt": updated_at.unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
            "benchmark": "Allternit Computer-Use Leaderboard",
            "description": "Public evaluation of agent runtimes on real-world browser tasks. Scores combine task success rate, average steps, and safety violations.",
            "metrics": [
                {"key": "successRate", "label": "Success Rate", "format": "percent"},
                {"key": "avgSteps", "label": "Avg Steps", "format": "number"},
                {"key": "avgLatencyMs", "label": "Avg Latency", "format": "duration"},
                {"key": "safetyScore", "label": "Safety", "format": "percent"},
            ],
            "entries": rows,
        }))
    })
    .await;

    match result {
        Ok(Ok(v)) => Ok(Json(v)),
        Ok(Err(e)) => Err(e),
        Err(e) => Err(internal(e)),
    }
}
