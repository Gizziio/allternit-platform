//! Shared test scaffolding for P1 namespace-handler tests (routes::*).
//!
//! Each control-plane namespace test (agent-sessions, office, beta) mocks
//! the same gateway seam (routes::data_plane::DataPlaneGateway) and builds
//! the same minimal ApiState against a schema-per-test Postgres pool. Kept
//! here so the mocks and the `api_tokens` stub the auth fallback queries
//! live once; the production seam stays in routes::data_plane.

#![cfg(test)]

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{HeaderValue, Request, StatusCode};
use axum::response::{IntoResponse, Response};

use super::data_plane::DataPlaneGateway;
use super::runtime_relay::RelayRequest;
use crate::services::ResolvedNode;
use crate::{ApiError, ApiState};

pub const DEV_USER: &str = "dev-user";

#[derive(Debug, Clone)]
pub struct RecordedRelay {
    pub user_id: String,
    pub device_id: String,
    pub method: String,
    pub path: String,
    pub body: String, // base64 as forwarded
}

/// Mock gateway: records every relay call, replays queued responses
/// (defaulting to 200 `{}`). Node resolution either returns the canned node
/// or fails with the canned 428 message.
pub struct MockGateway {
    node: Option<ResolvedNode>,
    resolve_error: Option<String>,
    responses: Mutex<VecDeque<Response>>,
    recorded: Mutex<Vec<RecordedRelay>>,
}

impl MockGateway {
    pub fn json(status: StatusCode, body: &str) -> Response {
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

    pub fn healthy_node() -> ResolvedNode {
        ResolvedNode {
            device_id: "rt_default".to_string(),
            name: "default node".to_string(),
            kind: crate::services::NodeKind("local".to_string()),
            last_seen_at: Some(chrono::Utc::now()),
        }
    }

    pub fn new(node: Option<ResolvedNode>, responses: Vec<Response>) -> Self {
        Self {
            node,
            resolve_error: None,
            responses: Mutex::new(responses.into()),
            recorded: Mutex::new(Vec::new()),
        }
    }

    pub fn failing(message: &str) -> Self {
        Self {
            node: None,
            resolve_error: Some(message.to_string()),
            responses: Mutex::new(VecDeque::new()),
            recorded: Mutex::new(Vec::new()),
        }
    }

    pub fn recorded(&self) -> Vec<RecordedRelay> {
        self.recorded.lock().unwrap().clone()
    }
}

#[async_trait]
impl DataPlaneGateway for MockGateway {
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

/// Schema-per-test pool; `api_tokens` must exist because the auth fallback
/// queries it before the dev-token gate (same pattern as auth::resolve::tests).
pub async fn test_pool() -> sqlx::PgPool {
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
pub async fn test_state(gateway: Arc<dyn DataPlaneGateway>) -> Arc<ApiState> {
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
        data_plane_gateway: gateway,
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

pub fn authed_request(method: &str, path: &str, body: &str) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .header("authorization", "Bearer dev-api-token")
        .body(Body::from(body.to_string()))
        .unwrap()
}
