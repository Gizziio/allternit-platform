//! Control-plane exposure of the agent-sessions namespace (P1, tranche 1).
//!
//! The agent-session handlers live only on the user's data-plane node
//! (`agent_session_router` in allternit-api :8013, backed by the node's gizzi
//! runtime), so these handlers implement the universal P1 design from
//! docs/architecture/2026-09-04-p1-route-inventory.md §3:
//!
//! 1. **Auth** — `auth::resolve_user_scoped(.., "compute")`, the same
//!    Clerk-first resolver the runtime relay uses.
//! 2. **Node resolution** — the caller's default data-plane node via
//!    [`AgentSessionsGateway::resolve_default_node`] (services::node_resolution);
//!    428 "pair a device" when the account has no healthy node.
//! 3. **Relay** — the request is forwarded through the EXISTING outbound-WS
//!    relay (`runtime_relay::relay_request_to_runtime`): same allow-list,
//!    same wake-on-demand, same `Body::from_stream` chunked responses. SSE
//!    (`/sync`) is not buffered anywhere — the relay streams head +
//!    chunks verbatim, and `text/event-stream` passes the response header
//!    filter.
//! 4. **Cache nothing, transform nothing** — v1 is a faithful proxy.
//!
//! Routes are self-authenticating (mounted in the public runtime router,
//! like the pairing/relay routes) because the legacy Tower auth middleware
//! on the protected router only accepts `allternit_*` API tokens, not Clerk
//! sessions.

use async_trait::async_trait;
use axum::{
    extract::{Path, RawQuery, State},
    http::HeaderMap,
    response::Response,
    routing::{get, post},
    Router,
};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use bytes::Bytes;
use std::sync::Arc;

use super::runtime_relay::{relay_headers_from_http, RelayRequest};
use crate::{
    services::{resolve_default_node, ContaboRuntimeService, PgNodeStore, ResolvedNode, SharedQuotaService},
    ApiError, ApiState,
};

/// The service boundary the namespace handlers depend on: node resolution +
/// one relay invocation. Production impl is [`DataPlaneGateway`]; tests
/// substitute a mock here so handler behavior (auth gating, path/method
/// wiring, SSE pass-through) is verified without a runtime on the other end.
#[async_trait]
pub trait AgentSessionsGateway: Send + Sync {
    async fn resolve_default_node(&self, user_id: &str) -> Result<ResolvedNode, ApiError>;
    async fn relay(
        &self,
        user_id: &str,
        device_id: &str,
        request: RelayRequest,
    ) -> Result<Response, ApiError>;
}

/// Production gateway: resolves nodes from `runtime_devices` and relays
/// through the existing `runtime_relay` machinery. Holds the same clones
/// `ApiState` holds so it can be constructed before the state and stored in
/// it without circular references.
pub struct DataPlaneGateway {
    db: sqlx::PgPool,
    contabo_runtime_service: Arc<ContaboRuntimeService>,
    quota_service: SharedQuotaService,
}

impl DataPlaneGateway {
    pub fn new(
        db: sqlx::PgPool,
        contabo_runtime_service: Arc<ContaboRuntimeService>,
        quota_service: SharedQuotaService,
    ) -> Self {
        Self {
            db,
            contabo_runtime_service,
            quota_service,
        }
    }
}

#[async_trait]
impl AgentSessionsGateway for DataPlaneGateway {
    async fn resolve_default_node(&self, user_id: &str) -> Result<ResolvedNode, ApiError> {
        resolve_default_node(&PgNodeStore::new(&self.db), user_id).await
    }

    async fn relay(
        &self,
        user_id: &str,
        device_id: &str,
        request: RelayRequest,
    ) -> Result<Response, ApiError> {
        super::runtime_relay::relay_request_to_runtime(
            &self.db,
            &self.contabo_runtime_service,
            &self.quota_service,
            user_id,
            device_id,
            request,
        )
        .await
    }
}

pub fn routes() -> Router<Arc<ApiState>> {
    Router::new()
        .route(
            "/api/v1/agent-sessions",
            get(list_sessions).post(create_session),
        )
        // Static segment; axum/matchit prefers it over `:id` below.
        .route("/api/v1/agent-sessions/sync", get(sync_sessions))
        .route(
            "/api/v1/agent-sessions/:id",
            get(get_session).patch(update_session).delete(delete_session),
        )
        .route(
            "/api/v1/agent-sessions/:id/messages",
            get(list_messages).post(send_message),
        )
        .route("/api/v1/agent-sessions/:id/abort", post(abort_session))
        .route("/api/v1/agent-sessions/:id/revert", post(revert_session))
        .route(
            "/api/v1/agent-sessions/:id/unrevert",
            post(unrevert_session),
        )
        .route(
            "/api/v1/agent-sessions/:id/compact",
            post(compact_session),
        )
}

/// Universal P1 handler core: Clerk auth → default-node resolution → relay.
/// `path` is the exact :8013 path to proxy (e.g. `/api/v1/agent-sessions/:id`),
/// including any query string.
async fn relay_agent_sessions_request(
    state: &ApiState,
    headers: &HeaderMap,
    method: &str,
    path: String,
    body: &[u8],
) -> Result<Response, ApiError> {
    let user = crate::auth::resolve_user_scoped(&state.db, headers, "compute").await?;
    let node = state
        .agent_sessions_gateway
        .resolve_default_node(&user.id)
        .await?;
    let request = RelayRequest {
        method: method.to_string(),
        path,
        headers: relay_headers_from_http(headers),
        body: STANDARD.encode(body),
        body_encoding: "base64".to_string(),
    };
    state
        .agent_sessions_gateway
        .relay(&user.id, &node.device_id, request)
        .await
}

fn with_query(base: &str, query: &RawQuery) -> String {
    match &query.0 {
        Some(query) if !query.is_empty() => format!("{base}?{query}"),
        _ => base.to_string(),
    }
}

async fn list_sessions(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "GET", with_query("/api/v1/agent-sessions", &query), &[]).await
}

async fn create_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    query: RawQuery,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "POST", with_query("/api/v1/agent-sessions", &query), &body).await
}

async fn get_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "GET", format!("/api/v1/agent-sessions/{id}"), &[]).await
}

async fn update_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "PATCH", format!("/api/v1/agent-sessions/{id}"), &body).await
}

async fn delete_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "DELETE", format!("/api/v1/agent-sessions/{id}"), &[]).await
}

async fn list_messages(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(
        &state,
        &headers,
        "GET",
        with_query(&format!("/api/v1/agent-sessions/{id}/messages"), &query),
        &[],
    )
    .await
}

async fn send_message(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(
        &state,
        &headers,
        "POST",
        format!("/api/v1/agent-sessions/{id}/messages"),
        &body,
    )
    .await
}

/// SSE sync channel (permission/question events from the node's gizzi
/// runtime). The relay answers from the response head immediately and then
/// streams chunks via `Body::from_stream`, so the event channel is never
/// buffered; `text/event-stream` survives `filtered_response_headers`.
/// The 90s `RELAY_TIMEOUT` bounds only the head wait, not the stream.
async fn sync_sessions(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    query: RawQuery,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(
        &state,
        &headers,
        "GET",
        with_query("/api/v1/agent-sessions/sync", &query),
        &[],
    )
    .await
}

async fn abort_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "POST", format!("/api/v1/agent-sessions/{id}/abort"), &[]).await
}

async fn revert_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "POST", format!("/api/v1/agent-sessions/{id}/revert"), &[]).await
}

async fn unrevert_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "POST", format!("/api/v1/agent-sessions/{id}/unrevert"), &[]).await
}

async fn compact_session(
    State(state): State<Arc<ApiState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    relay_agent_sessions_request(&state, &headers, "POST", format!("/api/v1/agent-sessions/{id}/compact"), &[]).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::dev_token::{ALLOW_DEV_TOKEN_ENV, DEV_TOKEN_ENV_LOCK};
    use axum::body::Body;
    use axum::http::{HeaderValue, Request, StatusCode};
    use axum::response::IntoResponse;
    use http_body_util::BodyExt;
    use std::collections::VecDeque;
    use std::sync::Mutex;
    use tower::ServiceExt;

    const DEV_USER: &str = "dev-user";

    #[derive(Debug, Clone)]
    struct RecordedRelay {
        user_id: String,
        device_id: String,
        method: String,
        path: String,
        body: String, // base64 as forwarded
    }

    struct MockGateway {
        node: Option<ResolvedNode>,
        /// When set, resolution fails with this PreconditionRequired message
        /// (ApiError is not Clone, so the mock stores the message).
        resolve_error: Option<String>,
        responses: Mutex<VecDeque<Response>>,
        recorded: Mutex<Vec<RecordedRelay>>,
    }

    impl MockGateway {
        fn json(status: StatusCode, body: &str) -> Response {
            (
                status,
                [(
                    axum::http::header::CONTENT_TYPE,
                    HeaderValue::from_static("application/json"),
                )],
                body.to_string(),
            )
                .into_response()
        }

        fn healthy_node() -> ResolvedNode {
            ResolvedNode {
                device_id: "rt_default".to_string(),
                name: "default node".to_string(),
                kind: crate::services::NodeKind("local".to_string()),
                last_seen_at: Some(chrono::Utc::now()),
            }
        }

        fn new(node: Option<ResolvedNode>, responses: Vec<Response>) -> Self {
            Self {
                node,
                resolve_error: None,
                responses: Mutex::new(responses.into()),
                recorded: Mutex::new(Vec::new()),
            }
        }

        fn failing(message: &str) -> Self {
            Self {
                node: None,
                resolve_error: Some(message.to_string()),
                responses: Mutex::new(VecDeque::new()),
                recorded: Mutex::new(Vec::new()),
            }
        }

        fn recorded(&self) -> Vec<RecordedRelay> {
            self.recorded.lock().unwrap().clone()
        }
    }

    #[async_trait]
    impl AgentSessionsGateway for MockGateway {
        async fn resolve_default_node(&self, _user_id: &str) -> Result<ResolvedNode, ApiError> {
            match (&self.node, &self.resolve_error) {
                (Some(node), _) => Ok(node.clone()),
                (None, Some(message)) => Err(ApiError::PreconditionRequired(message.clone())),
                (None, None) => Err(ApiError::PreconditionRequired("no node".to_string())),
            }
        }

        async fn relay(
            &self,
            user_id: &str,
            device_id: &str,
            request: RelayRequest,
        ) -> Result<Response, ApiError> {
            self.recorded.lock().unwrap().push(RecordedRelay {
                user_id: user_id.to_string(),
                device_id: device_id.to_string(),
                method: request.method,
                path: request.path,
                body: request.body,
            });
            Ok(self
                .responses
                .lock()
                .unwrap()
                .pop_front()
                .unwrap_or_else(|| Self::json(StatusCode::OK, "{}")))
        }
    }

    /// Schema-per-test pool; `api_tokens` must exist because the auth
    /// fallback queries it before the dev-token gate (same pattern as
    /// auth::resolve::tests).
    async fn test_pool() -> sqlx::PgPool {
        let url = "postgres://allternit:allternit_pg_2026@localhost:5432/allternit_test";
        let schema = format!("test_{}", uuid::Uuid::new_v4().simple());
        let schema_for_hook = schema.clone();
        let pool = sqlx::postgres::PgPoolOptions::new()
            .max_connections(1)
            .after_connect(move |conn, _meta| {
                let schema = schema_for_hook.clone();
                Box::pin(async move {
                    sqlx::query(&format!("CREATE SCHEMA IF NOT EXISTS {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    sqlx::query(&format!("SET search_path TO {}", schema))
                        .execute(&mut *conn)
                        .await?;
                    Ok(())
                })
            })
            .connect(url)
            .await
            .unwrap();
        sqlx::query(
            r#"
            CREATE TABLE api_tokens (
                id TEXT PRIMARY KEY,
                token_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                permissions TEXT NOT NULL DEFAULT '[]',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ,
                last_used_at TIMESTAMPTZ,
                is_revoked BOOLEAN NOT NULL DEFAULT FALSE
            )
            "#,
        )
        .execute(&pool)
        .await
        .unwrap();
        pool
    }

    /// Minimal ApiState with the gateway mocked; mirrors the wiring in
    /// tests/common/mod.rs.
    async fn test_state(gateway: Arc<dyn AgentSessionsGateway>) -> Arc<ApiState> {
        let db = test_pool().await;
        let event_store: Arc<dyn crate::services::EventStore> =
            Arc::new(crate::services::EventStoreImpl::new(db.clone()));
        let session_manager = Arc::new(crate::runtime::session_manager::SessionManager::new(db.clone()));
        let run_service: Arc<dyn crate::services::RunService> =
            Arc::new(crate::services::RunServiceImpl::new(db.clone()).with_event_store(event_store.clone()));
        let rate_limit_config = crate::RateLimitConfig {
            requests_per_minute: 100_000,
            window: std::time::Duration::from_secs(60),
        };
        let quota_service = Arc::new(crate::services::QuotaService::new(db.clone()));
        Arc::new(ApiState {
            db: db.clone(),
            ssh_executor: allternit_cloud_ssh::SshExecutor::new(),
            event_tx: tokio::sync::broadcast::channel(16).0,
            event_store,
            run_service,
            session_manager,
            rate_limiter: crate::create_rate_limiter(rate_limit_config.clone()),
            public_rate_limiter: crate::create_rate_limiter(rate_limit_config.clone()),
            free_inference_rate_limiter: crate::create_rate_limiter(rate_limit_config),
            cost_service: Arc::new(crate::services::CostServiceImpl::new(db.clone())),
            quota_service: quota_service.clone(),
            contabo_runtime_service: Arc::new(crate::services::ContaboRuntimeService::new(
                db.clone(),
                None,
                "https://api.allternit.com".to_string(),
            )),
            agent_sessions_gateway: gateway,
            mesh_service: None,
            credential_cipher: None,
            inference_key_service: None,
            metrics_state: Arc::new(crate::middleware::metrics::MetricsState::new()),
            model_router: crate::model_router::ModelRouter::disabled(
                crate::model_router::catalog::starter_catalog(),
            ),
            inference_pool_service: Arc::new(crate::services::InferencePoolService::new(db.clone())),
        })
    }

    fn authed_request(method: &str, path: &str, body: &str) -> Request<Body> {
        Request::builder()
            .method(method)
            .uri(path)
            .header("content-type", "application/json")
            .header("authorization", "Bearer dev-api-token")
            .body(Body::from(body.to_string()))
            .unwrap()
    }

    #[tokio::test]
    async fn every_endpoint_requires_authentication() {
        let state = test_state(Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            vec![],
        )))
        .await;
        let router = routes().with_state(state);

        for (method, path) in [
            ("GET", "/api/v1/agent-sessions"),
            ("POST", "/api/v1/agent-sessions"),
            ("GET", "/api/v1/agent-sessions/sess_1"),
            ("PATCH", "/api/v1/agent-sessions/sess_1"),
            ("DELETE", "/api/v1/agent-sessions/sess_1"),
            ("GET", "/api/v1/agent-sessions/sess_1/messages"),
            ("POST", "/api/v1/agent-sessions/sess_1/messages"),
            ("GET", "/api/v1/agent-sessions/sync"),
            ("POST", "/api/v1/agent-sessions/sess_1/abort"),
            ("POST", "/api/v1/agent-sessions/sess_1/revert"),
            ("POST", "/api/v1/agent-sessions/sess_1/unrevert"),
            ("POST", "/api/v1/agent-sessions/sess_1/compact"),
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
    async fn unknown_bearer_token_is_rejected_without_touching_the_gateway() {
        let gateway = Arc::new(MockGateway::new(Some(MockGateway::healthy_node()), vec![]));
        let state = test_state(gateway.clone()).await;
        let router = routes().with_state(state);

        let request = Request::builder()
            .method("GET")
            .uri("/api/v1/agent-sessions")
            .header("authorization", "Bearer allternit_not_a_real_token_0123456789")
            .body(Body::empty())
            .unwrap();
        let response = router.oneshot(request).await.unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        assert!(
            gateway.recorded().is_empty(),
            "unauthenticated requests never reach the relay"
        );
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
            .oneshot(authed_request("GET", "/api/v1/agent-sessions", ""))
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
    async fn relays_to_the_resolved_default_node_with_exact_method_and_path() {
        let _guard = DEV_TOKEN_ENV_LOCK.lock().unwrap();
        std::env::set_var(ALLOW_DEV_TOKEN_ENV, "true");

        // One shared gateway across calls so `recorded` accumulates.
        let gateway = Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            vec![
                MockGateway::json(StatusCode::OK, "[]"),
                MockGateway::json(StatusCode::OK, "{}"),
                MockGateway::json(StatusCode::OK, "{}"),
            ],
        ));
        let state = test_state(gateway.clone()).await;
        let router = routes().with_state(state);

        let cases: Vec<(&str, &str, &str, &str)> = vec![
            ("GET", "/api/v1/agent-sessions?originSurface=chat", "/api/v1/agent-sessions?originSurface=chat", ""),
            ("PATCH", "/api/v1/agent-sessions/sess_1", "/api/v1/agent-sessions/sess_1", r#"{"name":"x"}"#),
            ("DELETE", "/api/v1/agent-sessions/sess_1", "/api/v1/agent-sessions/sess_1", ""),
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
        assert_eq!(recorded.len(), 3);
        for (call, (method, _, expected_path, body)) in recorded.iter().zip(cases.iter()) {
            assert_eq!(call.user_id, DEV_USER);
            assert_eq!(call.device_id, "rt_default");
            assert_eq!(call.method, *method);
            assert_eq!(call.path, *expected_path);
            let decoded = String::from_utf8(STANDARD.decode(&call.body).unwrap()).unwrap();
            assert_eq!(decoded, *body);
        }

        std::env::remove_var(ALLOW_DEV_TOKEN_ENV);
    }    #[tokio::test]
    async fn sync_streams_the_relayed_sse_channel_verbatim() {
        let _guard = DEV_TOKEN_ENV_LOCK.lock().unwrap();
        std::env::set_var(ALLOW_DEV_TOKEN_ENV, "true");

        let frames = "data: {\"type\":\"snapshot\"}\n\ndata: {\"type\":\"permission\"}\n\n";
        let sse_response = Response::builder()
            .status(StatusCode::OK)
            .header("content-type", "text/event-stream")
            .header("cache-control", "no-cache")
            .body(Body::from_stream(tokio_stream::iter(
                frames
                    .as_bytes()
                    .chunks(7)
                    .map(|chunk| Ok::<_, std::convert::Infallible>(Bytes::copy_from_slice(chunk)))
                    .collect::<Vec<_>>(),
            )))
            .unwrap();
        let gateway = Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            vec![sse_response],
        ));
        let state = test_state(gateway).await;
        let router = routes().with_state(state);

        let response = router
            .oneshot(authed_request("GET", "/api/v1/agent-sessions/sync?since=42", ""))
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers()["content-type"], "text/event-stream",
            "SSE content type must pass through so EventSource works"
        );
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        assert_eq!(
            String::from_utf8(bytes.to_vec()).unwrap(),
            frames,
            "every chunk must stream through unbuffered"
        );

        std::env::remove_var(ALLOW_DEV_TOKEN_ENV);
    }

    #[tokio::test]
    async fn lifecycle_and_message_routes_wire_to_the_matching_8013_paths() {
        let _guard = DEV_TOKEN_ENV_LOCK.lock().unwrap();
        std::env::set_var(ALLOW_DEV_TOKEN_ENV, "true");

        let gateway = Arc::new(MockGateway::new(
            Some(MockGateway::healthy_node()),
            (0..6).map(|_| MockGateway::json(StatusCode::OK, "{}")).collect(),
        ));
        let state = test_state(gateway.clone()).await;
        let router = routes().with_state(state);

        for (uri, expected_path) in [
            ("/api/v1/agent-sessions/sess_9/messages?limit=5", "/api/v1/agent-sessions/sess_9/messages?limit=5"),
            ("/api/v1/agent-sessions/sess_9/messages", "/api/v1/agent-sessions/sess_9/messages"),
            ("/api/v1/agent-sessions/sess_9/abort", "/api/v1/agent-sessions/sess_9/abort"),
            ("/api/v1/agent-sessions/sess_9/revert", "/api/v1/agent-sessions/sess_9/revert"),
            ("/api/v1/agent-sessions/sess_9/unrevert", "/api/v1/agent-sessions/sess_9/unrevert"),
            ("/api/v1/agent-sessions/sess_9/compact", "/api/v1/agent-sessions/sess_9/compact"),
        ] {
            let method = if uri.contains("messages?") { "GET" } else { "POST" };
            let response = router
                .clone()
                .oneshot(authed_request(method, uri, r#"{"text":"hi"}"#))
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
