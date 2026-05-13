
//! Board Stream SSE API routes

use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::{sse::Event, IntoResponse, Sse},
    routing::get,
    Json, Router,
};
use futures::stream::Stream;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;

use crate::AppState;
use crate::auth::AuthUser;
use crate::auth::get_user;

pub fn board_stream_router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/board-stream", get(board_stream_status))
        .route("/board-stream/:workspace_id", get(board_stream_sse))
}

async fn board_stream_status() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "board-stream",
    }))
}

async fn board_stream_sse(
    State(state): State<Arc<AppState>>,
    Path(workspace_id): Path<String>,
    Extension(_user): Extension<AuthUser>,
    headers: HeaderMap,
) -> Result<Sse<impl Stream<Item = Result<Event, std::convert::Infallible>>>, StatusCode> {
    let user = match get_user(&headers) {
        Some(u) => u,
        None => return Err(StatusCode::UNAUTHORIZED),
    };

    let db = state.db.clone();
    let ws_id = workspace_id.clone();
    let _user_id = user.user_id;

    let stream = async_stream::stream! {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;

            let conn = match db.connect() {
                Ok(c) => c,
                Err(_) => {
                    yield Ok(Event::default().data(json!({"ping": true}).to_string()));
                    continue;
                }
            };

            let items: Vec<serde_json::Value> = match conn.prepare(
                "SELECT id, workspace_id, title, status, priority, updated_at
                 FROM board_items WHERE workspace_id = ?1 ORDER BY updated_at DESC LIMIT 50"
            ) {
                Ok(mut stmt) => {
                    match stmt.query_map(rusqlite::params![&ws_id], |row| {
                        Ok(json!({
                            "id": row.get::<_, String>(0)?,
                            "workspace_id": row.get::<_, String>(1)?,
                            "title": row.get::<_, String>(2)?,
                            "status": row.get::<_, String>(3)?,
                            "priority": row.get::<_, Option<String>>(4)?,
                            "updated_at": row.get::<_, String>(5)?,
                        }))
                    }) {
                        Ok(iter) => iter.filter_map(|r| r.ok()).collect(),
                        Err(_) => vec![],
                    }
                }
                Err(_) => vec![],
            };

            yield Ok(Event::default().data(json!({
                "type": "board_update",
                "workspace_id": ws_id.clone(),
                "items": items,
                "timestamp": chrono::Utc::now().to_rfc3339(),
            }).to_string()));
        }
    };

    Ok(Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text(""),
    ))
}
