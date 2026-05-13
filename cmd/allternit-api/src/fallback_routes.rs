use axum::{
    extract::Request,
    http::StatusCode,
    response::IntoResponse,
    Json, Router,
};
use serde_json::json;
use std::sync::Arc;

use crate::AppState;

pub fn fallback_router() -> Router<Arc<AppState>> {
    Router::new().fallback(fallback_handler)
}

async fn fallback_handler(req: Request) -> impl IntoResponse {
    let path = req.uri().path();
    let method = req.method().as_str();

    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "error": "Not Implemented",
            "message": format!("{} {} is not yet implemented in the unified backend.", method, path),
            "path": path,
            "method": method,
        })),
    )
}
