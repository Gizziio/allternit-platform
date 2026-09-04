//! Control-plane exposure of the beta namespace (P1).
//!
//! Beta handlers live only on the user's data-plane node (`beta_session_router`
//! and `research_task_router` in allternit-api :8013, backed by the node's
//! SQLite: `beta_sessions`, `beta_session_events`, `research_tasks`, ...), so
//! these handlers follow the universal P1 four-step design (see
//! routes::data_plane): Clerk auth → resolve default node → relay verbatim →
//! cache/transform nothing.
//!
//! Coverage follows the P1 route inventory
//! (docs/architecture/2026-09-04-p1-route-inventory.md §3.4), in priority
//! order: research tasks, then the playground session surface
//! (CRUD + event polling + memory search + run).
//!
//! Deliberately NOT exposed here:
//! - `GET /api/v1/beta/sessions/:id/events` — the SSE event stream; the
//!   playground polls `events/list` today. Relay-compatible later (same
//!   pass-through as agent-sessions/sync).
//! - `GET /api/v1/beta/sessions/:id/events/ws` — WebSocket-only; needs the
//!   socket-ticket WS relay, not the request relay (§5 of the inventory).
//! - resources/files/context/tool-context/interrupt — 8013-owned but not in
//!   the P1 flagged-surface list.
//!
//! Note: `POST /api/v1/beta/sessions/:id/run` is relayed even though the
//! current :8013 route table does not define it (the playground client calls
//! it; the node's 404 comes back verbatim until the data-plane handler
//! lands). §3.4 #18 lists it as part of the namespace.

use axum::{
    extract::{Path, RawQuery, State},
    http::HeaderMap,
    response::Response,
    routing::{get, post},
    Router,
};
use bytes::Bytes;
use std::sync::Arc;

use super::data_plane::{relay_data_plane_request, with_query};
use crate::{ApiError, ApiState};

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        // Research tasks (SQLite `research_tasks` on the node).
        .route(
            "/api/v1/beta/research",
            post(create_research_task).get(list_research_tasks),
        )
        // :8013 serves update as POST, not PATCH (research_task_routes.rs).
        .route(
            "/api/v1/beta/research/:id",
            get(get_research_task)
                .post(update_research_task)
                .delete(delete_research_task),
        )
        // Beta playground sessions.
        .route("/api/v1/beta/sessions", get(list_sessions).post(create_session))
        .route(
            "/api/v1/beta/sessions/:id",
            get(get_session).patch(update_session).delete(archive_session),
        )
        .route(
            "/api/v1/beta/sessions/:id/events/list",
            get(list_events_json),
        )
        .route(
            "/api/v1/beta/sessions/:id/memory/search",
            get(search_session_memory),
        )
        .route("/api/v1/beta/sessions/:id/run", post(run_session))
}

async fn create_research_task(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_data_plane_request(&state, &headers, "POST", "/api/v1/beta/research".to_string(), &body)
        .await
}

async fn list_research_tasks(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "GET",
        with_query("/api/v1/beta/research", &query),
        &[],
    )
    .await
}

async fn get_research_task(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "GET",
        format!("/api/v1/beta/research/{id}"),
        &[],
    )
    .await
}

async fn update_research_task(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "POST",
        format!("/api/v1/beta/research/{id}"),
        &body,
    )
    .await
}

async fn delete_research_task(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "DELETE",
        format!("/api/v1/beta/research/{id}"),
        &[],
    )
    .await
}

async fn list_sessions(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "GET",
        with_query("/api/v1/beta/sessions", &query),
        &[],
    )
    .await
}

async fn create_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_data_plane_request(&state, &headers, "POST", "/api/v1/beta/sessions".to_string(), &body)
        .await
}

async fn get_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "GET",
        format!("/api/v1/beta/sessions/{id}"),
        &[],
    )
    .await
}

async fn update_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "PATCH",
        format!("/api/v1/beta/sessions/{id}"),
        &body,
    )
    .await
}

async fn archive_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "DELETE",
        format!("/api/v1/beta/sessions/{id}"),
        &[],
    )
    .await
}

async fn list_events_json(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "GET",
        with_query(&format!("/api/v1/beta/sessions/{id}/events/list"), &query),
        &[],
    )
    .await
}

async fn search_session_memory(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "GET",
        with_query(
            &format!("/api/v1/beta/sessions/{id}/memory/search"),
            &query,
        ),
        &[],
    )
    .await
}

async fn run_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_data_plane_request(
        &state,
        &headers,
        "POST",
        format!("/api/v1/beta/sessions/{id}/run"),
        &body,
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::dev_token::{ALLOW_DEV_TOKEN_ENV, DEV_TOKEN_ENV_LOCK};
    use crate::routes::test_support::{authed_request, test_state, MockGateway, DEV_USER};
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    #[tokio::test]
    async fn every_endpoint_requires_authentication() {
        let state = test_state(Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            vec![],
        )))
        .await;
        let router = routes().with_state(state);

        for (method, path) in [
            ("POST", "/api/v1/beta/research"),
            ("GET", "/api/v1/beta/research"),
            ("GET", "/api/v1/beta/research/rt_1"),
            ("POST", "/api/v1/beta/research/rt_1"),
            ("DELETE", "/api/v1/beta/research/rt_1"),
            ("GET", "/api/v1/beta/sessions"),
            ("POST", "/api/v1/beta/sessions"),
            ("GET", "/api/v1/beta/sessions/sess_1"),
            ("PATCH", "/api/v1/beta/sessions/sess_1"),
            ("DELETE", "/api/v1/beta/sessions/sess_1"),
            ("GET", "/api/v1/beta/sessions/sess_1/events/list"),
            ("GET", "/api/v1/beta/sessions/sess_1/memory/search?q=hi"),
            ("POST", "/api/v1/beta/sessions/sess_1/run"),
        ] {
            let request = Request::builder()
                .method(method)
                .uri(path)
                .body(Body::empty())
                .unwrap();
            let response = router.clone().oneshot(request).await.unwrap();
            assert_eq!(
                response.status(),
                StatusCode::UNAUTHORIZED,
                "{method} {path} must require auth"
            );
            let bytes = response.into_body().collect().await.unwrap().to_bytes();
            let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
            assert_eq!(body["error"], "UNAUTHORIZED", "{method} {path}");
        }
    }

    #[tokio::test]
    async fn no_healthy_node_is_a_428_pair_a_device_error() {
        let _guard = DEV_TOKEN_ENV_LOCK.lock().unwrap();
        std::env::set_var(ALLOW_DEV_TOKEN_ENV, "true");
        let gateway = Arc::new(MockGateway::failing(
            "No data-plane node registered for this account — pair a device (or start a hosted runtime) and try again",
        ));
        let state = test_state(gateway.clone()).await;
        let router = routes().with_state(state);

        let response = router
            .oneshot(authed_request("POST", "/api/v1/beta/research", r#"{"query":"x"}"#))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::PRECONDITION_REQUIRED);
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let body: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert!(body["message"].as_str().unwrap().contains("pair a device"));
        assert!(gateway.recorded().is_empty());

        std::env::remove_var(ALLOW_DEV_TOKEN_ENV);
    }

    #[tokio::test]
    async fn relays_to_the_resolved_default_node_with_exact_method_path_and_body() {
        let _guard = DEV_TOKEN_ENV_LOCK.lock().unwrap();
        std::env::set_var(ALLOW_DEV_TOKEN_ENV, "true");

        let gateway = Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            (0..6)
                .map(|_| MockGateway::json(StatusCode::OK, "{}"))
                .collect(),
        ));
        let state = test_state(gateway.clone()).await;
        let router = routes().with_state(state);

        let cases: Vec<(&str, &str, &str, &str)> = vec![
            ("POST", "/api/v1/beta/research", "/api/v1/beta/research", r#"{"query":"q"}"#),
            ("GET", "/api/v1/beta/research?status=running", "/api/v1/beta/research?status=running", ""),
            ("POST", "/api/v1/beta/research/rt_1", "/api/v1/beta/research/rt_1", r#"{"status":"done"}"#),
            ("DELETE", "/api/v1/beta/research/rt_1", "/api/v1/beta/research/rt_1", ""),
            ("POST", "/api/v1/beta/sessions", "/api/v1/beta/sessions", r#"{"title":"t"}"#),
            ("GET", "/api/v1/beta/sessions/sess_1/events/list?limit=10", "/api/v1/beta/sessions/sess_1/events/list?limit=10", ""),
        ];
        for (method, uri, _, body) in cases.iter().copied() {
            let response = router
                .clone()
                .oneshot(authed_request(method, uri, body))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK, "{method} {uri}");
        }

        let recorded = gateway.recorded();
        assert_eq!(recorded.len(), 6);
        for (call, (method, _, expected_path, body)) in recorded.iter().zip(cases.iter()) {
            assert_eq!(call.user_id, DEV_USER);
            assert_eq!(call.device_id, "rt_default");
            assert_eq!(call.method, *method);
            assert_eq!(call.path, *expected_path);
            let decoded = String::from_utf8(STANDARD.decode(&call.body).unwrap()).unwrap();
            assert_eq!(decoded, *body);
        }

        std::env::remove_var(ALLOW_DEV_TOKEN_ENV);
    }

    #[tokio::test]
    async fn session_lifecycle_routes_wire_to_the_matching_8013_paths() {
        let _guard = DEV_TOKEN_ENV_LOCK.lock().unwrap();
        std::env::set_var(ALLOW_DEV_TOKEN_ENV, "true");

        let gateway = Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            (0..7)
                .map(|_| MockGateway::json(StatusCode::OK, "{}"))
                .collect(),
        ));
        let state = test_state(gateway.clone()).await;
        let router = routes().with_state(state);

        for (method, uri, expected_path) in [
            ("GET", "/api/v1/beta/sessions/sess_9", "/api/v1/beta/sessions/sess_9"),
            ("PATCH", "/api/v1/beta/sessions/sess_9", "/api/v1/beta/sessions/sess_9"),
            ("DELETE", "/api/v1/beta/sessions/sess_9", "/api/v1/beta/sessions/sess_9"),
            ("GET", "/api/v1/beta/sessions/sess_9/memory/search?q=foo", "/api/v1/beta/sessions/sess_9/memory/search?q=foo"),
            ("GET", "/api/v1/beta/sessions/sess_9/events/list", "/api/v1/beta/sessions/sess_9/events/list"),
            ("POST", "/api/v1/beta/sessions/sess_9/run", "/api/v1/beta/sessions/sess_9/run"),
            ("GET", "/api/v1/beta/research/rt_9", "/api/v1/beta/research/rt_9"),
        ] {
            let response = router
                .clone()
                .oneshot(authed_request(method, uri, r#"{"prompt":"hi"}"#))
                .await
                .unwrap();
            assert_eq!(response.status(), StatusCode::OK, "{method} {uri}");
            let recorded = gateway.recorded();
            let call = recorded.last().unwrap();
            assert_eq!(call.method, method);
            assert_eq!(call.path, expected_path, "{uri}");
        }

        std::env::remove_var(ALLOW_DEV_TOKEN_ENV);
    }
}
