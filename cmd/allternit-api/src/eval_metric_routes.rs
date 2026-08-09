//! Admin API for built-in evaluation metrics.
//!
//! Endpoints (org-admin gated, merged at `/api/v1/admin`):
//!   GET  /admin/eval/metrics              — list built-in metrics
//!   POST /admin/eval/metrics/score        — score a prediction against a reference

use axum::{
    extract::{Extension, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    auth::AuthUser,
    eval_metrics::{list_metrics, BuiltinMetric},
    AppState,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/admin/eval/metrics", get(list_builtin_metrics))
        .route("/admin/eval/metrics/score", post(score_example))
}

type ApiError = (StatusCode, Json<Value>);

fn error(status: StatusCode, code: &str, message: impl Into<String>) -> ApiError {
    (
        status,
        Json(json!({"error": code, "message": message.into()})),
    )
}

fn internal(err: impl std::fmt::Display) -> ApiError {
    tracing::warn!(error = %err, "eval metric operation failed");
    error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal_error",
        err.to_string(),
    )
}

fn admin_org(conn: &rusqlite::Connection, user: &AuthUser) -> Result<String, ApiError> {
    let org = user.organization_id.as_deref().ok_or_else(|| {
        error(
            StatusCode::FORBIDDEN,
            "organization_required",
            "An active organization is required.",
        )
    })?;
    if !crate::rbac::is_org_admin(conn, org, &user.user_id).map_err(internal)? {
        return Err(error(
            StatusCode::FORBIDDEN,
            "insufficient_role",
            "Only organization owners/admins can use evaluation metrics.",
        ));
    }
    Ok(org.to_string())
}

async fn list_builtin_metrics(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
) -> Response {
    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let _org = admin_org(&conn, &user)?;
        Ok::<_, ApiError>(Json(list_metrics()))
    })
    .await;
    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[derive(Debug, Deserialize)]
struct ScoreBody {
    metric: String,
    prediction: String,
    reference: String,
}

async fn score_example(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<ScoreBody>,
) -> Response {
    let metric: BuiltinMetric = match serde_json::from_value(json!(body.metric)) {
        Ok(m) => m,
        Err(_) => {
            return error(
                StatusCode::BAD_REQUEST,
                "unknown_metric",
                format!("Unknown metric '{}'. Use GET /admin/eval/metrics to list options.", body.metric),
            )
            .into_response();
        }
    };

    let result = tokio::task::spawn_blocking(move || {
        let conn = state.db.connect().map_err(internal)?;
        let _org = admin_org(&conn, &user)?;
        let score = metric.score(&body.prediction, &body.reference);
        Ok::<_, ApiError>(Json(json!({
            "metric": metric.as_str(),
            "prediction": body.prediction,
            "reference": body.reference,
            "result": score,
        })))
    })
    .await;
    match result {
        Ok(Ok(v)) => v.into_response(),
        Ok(Err(e)) => e.into_response(),
        Err(e) => internal(e).into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_body_deserializes() {
        let raw = r#"{"metric":"exact_match","prediction":"a","reference":"a"}"#;
        let body: ScoreBody = serde_json::from_str(raw).unwrap();
        assert_eq!(body.metric, "exact_match");
    }
}
