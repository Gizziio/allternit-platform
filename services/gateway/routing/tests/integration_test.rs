//! Integration tests for the tools-gateway Axum app.

mod common;

use crate::common::{echo_execute_request, echo_tool_definition, TestApp};
use allternit_tools_gateway::service::{ExecuteToolResponse, HealthResponse};
use axum::http::StatusCode;

#[tokio::test]
async fn health_returns_ok() {
    let app = TestApp::new().await;
    let response = app.get("/health").await;
    TestApp::assert_status(&response, StatusCode::OK);

    let health: HealthResponse = TestApp::parse_json(response).await;
    assert_eq!(health.status, "ok");
    assert_eq!(health.service, "allternit-io-service");
    assert!(health.ontology_compliance);
}

#[tokio::test]
async fn list_tools_returns_empty_array() {
    let app = TestApp::new().await;
    let response = app.get("/v1/tools").await;
    TestApp::assert_status(&response, StatusCode::OK);

    let body = TestApp::body_bytes(response).await;
    assert_eq!(String::from_utf8_lossy(&body), "[]");
}

#[tokio::test]
async fn register_tool_returns_201() {
    let app = TestApp::new().await;
    let tool = echo_tool_definition("echo.register");
    let response = app.post("/v1/tools", tool).await;
    TestApp::assert_status(&response, StatusCode::CREATED);

    let body = TestApp::body_bytes(response).await;
    assert!(String::from_utf8_lossy(&body).contains("echo.register"));
}

#[tokio::test]
async fn execute_unknown_tool_returns_failure() {
    let app = TestApp::new().await;
    let request = echo_execute_request("echo.unknown", "run_unknown_001");
    let response = app.post("/v1/tools/execute", request).await;
    TestApp::assert_status(&response, StatusCode::OK);

    let result: ExecuteToolResponse = TestApp::parse_json(response).await;
    assert!(!result.success);
    assert!(result.error.is_some());
    let error = result.error.unwrap();
    assert!(error.message.contains("not found"));
}

#[tokio::test]
async fn execute_registered_tool_without_policy_rule_fails_policy() {
    let app = TestApp::new().await;
    let tool_id = "echo.policy_denied";

    // Register the tool first.
    let tool = echo_tool_definition(tool_id);
    let register_response = app.post("/v1/tools", tool).await;
    TestApp::assert_status(&register_response, StatusCode::CREATED);

    // Execute it. No allow rule exists in the default policy engine, so the
    // gateway should deny the request.
    let request = echo_execute_request(tool_id, "run_policy_001");
    let response = app.post("/v1/tools/execute", request).await;
    TestApp::assert_status(&response, StatusCode::OK);

    let result: ExecuteToolResponse = TestApp::parse_json(response).await;
    assert!(!result.success);
    assert!(result.error.is_some());
    let error = result.error.unwrap();
    assert!(
        error.message.contains("denied") || error.message.contains("Default deny"),
        "expected policy denial, got: {}",
        error.message
    );
}
