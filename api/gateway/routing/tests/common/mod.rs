//! Test harness for the tools-gateway Axum app.

use allternit_policy::SafetyTier;
use allternit_tools_gateway::{
    service::{create_router, ExecuteToolRequest, IoServiceState},
    FilesystemAccess, NetworkAccess, ResourceLimits, ToolDefinition, ToolType,
};
use axum::{body::Body, http::Request, http::StatusCode, response::Response};
use serde_json::json;
use std::sync::Arc;
use tempfile::TempDir;
use tower::ServiceExt;

/// Test application wrapper.
pub struct TestApp {
    pub router: axum::Router,
    #[allow(dead_code)]
    pub temp_dir: TempDir,
}

impl TestApp {
    /// Build a router backed by an isolated service state.
    pub async fn new() -> Self {
        let temp_dir = TempDir::new().expect("failed to create temp directory");
        let state = Arc::new(
            IoServiceState::new_with_data_dir(temp_dir.path())
                .await
                .expect("failed to create service state"),
        );
        let router = create_router(state);

        Self { router, temp_dir }
    }

    /// Make a GET request.
    pub async fn get(&self, path: &str) -> Response {
        let request = Request::builder()
            .uri(path)
            .method("GET")
            .body(Body::empty())
            .unwrap();
        self.router.clone().oneshot(request).await.unwrap()
    }

    /// Make a POST request with a JSON body.
    pub async fn post<T: serde::Serialize>(&self, path: &str, body: T) -> Response {
        let json_body = serde_json::to_string(&body).unwrap();
        let request = Request::builder()
            .uri(path)
            .method("POST")
            .header("Content-Type", "application/json")
            .body(Body::from(json_body))
            .unwrap();
        self.router.clone().oneshot(request).await.unwrap()
    }

    /// Read the response body as bytes.
    pub async fn body_bytes(response: Response) -> Vec<u8> {
        axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap()
            .to_vec()
    }

    /// Parse the response body as JSON.
    pub async fn parse_json<T: serde::de::DeserializeOwned>(response: Response) -> T {
        let status = response.status();
        let body = Self::body_bytes(response).await;
        serde_json::from_slice(&body).unwrap_or_else(|e| {
            let body_str = String::from_utf8_lossy(&body);
            panic!(
                "failed to parse JSON response (status: {}): {}\nbody: {}",
                status, e, body_str
            )
        })
    }

    /// Assert that the response status equals the expected value.
    pub fn assert_status(response: &Response, expected: StatusCode) -> StatusCode {
        let status = response.status();
        assert_eq!(
            status, expected,
            "expected status {:?}, got {:?}",
            expected, status
        );
        status
    }
}

/// Build a minimal `ToolDefinition` for tests.
pub fn echo_tool_definition(tool_id: &str) -> ToolDefinition {
    ToolDefinition {
        id: tool_id.to_string(),
        name: format!("Echo {}", tool_id),
        description: "Test echo tool".to_string(),
        tool_type: ToolType::Local,
        command: "echo".to_string(),
        endpoint: "".to_string(),
        input_schema: json!({ "type": "object" }),
        output_schema: json!({ "type": "object" }),
        side_effects: vec![],
        idempotency_behavior: "idempotent".to_string(),
        retryable: false,
        failure_classification: "transient".to_string(),
        safety_tier: SafetyTier::T0,
        resource_limits: ResourceLimits {
            cpu: None,
            memory: None,
            network: NetworkAccess::None,
            filesystem: FilesystemAccess::None,
            time_limit: 30,
        },
        subprocess: None,
    }
}

/// Build a minimal tool execution request.
pub fn echo_execute_request(tool_id: &str, run_id: &str) -> ExecuteToolRequest {
    ExecuteToolRequest {
        tool_id: tool_id.to_string(),
        input: json!({ "message": "hello" }),
        correlation_id: format!("corr-{}", run_id),
        run_id: run_id.to_string(),
        wih_id: format!("wih-{}", run_id),
    }
}
