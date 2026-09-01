//! Execute a model request against the OS-scheduled placement.
//!
//! This is the Phase-4 execution loop: after the Cloud Model Gateway has
//! acquired a canonical OS lease/placement for inference capacity, it invokes
//! the canonical `allternitos-runtime` binary against the placement's endpoint.
//!
//! Current state:
//! - `fake` placements start the AllternitOS `mock-llama-server` test double
//!   locally and then route through `allternitos-runtime` against
//!   `127.0.0.1:<mock_port>`. This returns real generated tokens and keeps the
//!   Phase-4 integration test green without needing GPUs or model weights.
//! - Placements that carry a real `endpoint` or `ipv4` are routed through the
//!   same runtime path using the remote OpenAI-compatible adapter.
//! - `runpod`/`vast` and other provider kinds work as soon as their provisioners
//!   populate `endpoint` in the canonical OS `Placement`.

use crate::fabric_model_routes::ResponsesRequest;
use allternitos_cloud_contracts::Placement;
use axum::http::StatusCode;
use serde::Deserialize;
use serde_json::json;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tokio::process::Command;

const REMOTE_OPENAI_PACKAGE_ID: &str = "model.allternit.remote-openai";
const REMOTE_OPENAI_BACKEND_ID: &str = "backend.remote-openai";

/// Result of executing a model request against a placement.
#[derive(Debug, Clone)]
pub struct InferenceResult {
    pub generated_text: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub finish_reason: String,
}

/// Errors that can occur while executing inference on a placement.
#[derive(Debug, thiserror::Error)]
pub enum InferenceExecutorError {
    #[error("unsupported provider: {0}")]
    UnsupportedProvider(String),
    #[error("placement has no reachable endpoint")]
    NoEndpoint,
    #[error("allternitos-runtime binary not found: {0}")]
    RuntimeBinNotFound(String),
    #[error("mock llama server binary not found: {0}")]
    MockServerNotFound(String),
    #[error("failed to spawn runtime: {0}")]
    SpawnFailed(String),
    #[error("mock server failed to start: {0}")]
    MockServerStartupFailed(String),
    #[error("inference request failed: {0}")]
    RequestFailed(String),
    #[error("invalid response from inference backend: {0}")]
    InvalidResponse(String),
    #[error("https endpoints are not yet supported for inference execution")]
    HttpsNotSupported,
}

/// Run inference for `req` on the OS `placement`.
///
/// Returns real generated tokens when the placement has a usable endpoint.
/// Returns an error rather than a deterministic placeholder when the backend is
/// not yet implemented or the placement has no endpoint.
pub(crate) async fn execute_on_placement(
    placement: &Placement,
    req: &ResponsesRequest,
) -> Result<InferenceResult, InferenceExecutorError> {
    // If the placement already carries a reachable endpoint (including fake
    // placements used in journey tests), route through the canonical runtime
    // remote-openai adapter. Otherwise fall back to the local mock-llama-server
    // for legacy fake placements.
    if placement.endpoint.is_some() || placement.provider_kind.as_str() != "fake" {
        let (host, port) = placement_host_port(placement)
            .ok_or(InferenceExecutorError::NoEndpoint)?;
        execute_with_runtime(req, &host, port).await
    } else {
        execute_with_mock_llama_server(req).await
    }
}

/// Resolve a placement to a `(host, port)` pair if possible.
///
/// Prefers an explicit `endpoint` URL, falls back to `ipv4` with the default
/// OpenAI-compatible port 8000, and rejects `https` endpoints until TLS health
/// probing is wired.
fn placement_host_port(placement: &Placement) -> Option<(String, u16)> {
    if let Some(endpoint) = placement.endpoint.as_deref() {
        let endpoint = endpoint.trim();
        if endpoint.is_empty() {
            return None;
        }
        let (scheme, rest) = endpoint.split_once("://")?;
        if scheme.eq_ignore_ascii_case("https") {
            // Returning a sentinel lets `execute_with_runtime` surface the
            // dedicated https error instead of `NoEndpoint`.
            return Some(("__https_not_supported__".to_string(), 0));
        }
        if !scheme.eq_ignore_ascii_case("http") {
            return None;
        }
        let host_port = rest.split('/').next()?;
        let (host, port) = host_port
            .split_once(':')
            .map(|(h, p)| (h, p.parse().unwrap_or(8000)))
            .unwrap_or((host_port, 8000));
        return Some((host.to_string(), port));
    }

    placement
        .ipv4
        .as_deref()
        .map(|ip| (ip.to_string(), 8000))
}

/// Execute against the AllternitOS `mock-llama-server` test double.
///
/// The mock server is built as part of the AllternitOS workspace. It speaks
/// enough of the `llama.cpp-server` HTTP surface (health + chat completions)
/// for this executor to return real generated tokens. The actual request is
/// routed through `allternitos-runtime` so the fake path exercises the same
/// code path as a real cloud endpoint.
async fn execute_with_mock_llama_server(req: &ResponsesRequest) -> Result<InferenceResult, InferenceExecutorError> {
    let mock_bin = mock_llama_server_bin()?;
    let work_dir = std::env::temp_dir().join(format!(
        "allternit-cloud-mock-inference-{}-{}",
        std::process::id(),
        uuid::Uuid::new_v4().simple()
    ));
    tokio::fs::create_dir_all(&work_dir)
        .await
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("create work dir: {e}")))?;

    // The mock server needs a model file argument to accept the real adapter
    // command line, but it does not read the contents.
    let model_path = work_dir.join("model.gguf");
    tokio::fs::write(&model_path, b"mock-weights")
        .await
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("write mock model: {e}")))?;

    let port = pick_free_port()?;

    let mut child = Command::new(&mock_bin)
        .arg("--model")
        .arg(&model_path)
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .arg("--ctx-size")
        .arg("512")
        .arg("--threads")
        .arg("1")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::inherit())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("{e}")))?;

    let stdout = child.stdout.take().ok_or_else(|| {
        InferenceExecutorError::SpawnFailed("no stdout pipe from mock server".to_string())
    })?;
    let reader = tokio::io::BufReader::new(stdout);
    let mut lines = tokio::io::AsyncBufReadExt::lines(reader);

    let ready_prefix = "ALLTERNITOS_MOCK_READY=true port=";
    let mut actual_port: Option<u16> = None;
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        match tokio::time::timeout(Duration::from_millis(100), lines.next_line()).await {
            Ok(Ok(Some(line))) => {
                if let Some(rest) = line.strip_prefix(ready_prefix) {
                    actual_port = rest.trim().parse().ok();
                    break;
                }
            }
            Ok(Ok(None)) => break,
            Ok(Err(_)) => break,
            Err(_) => continue,
        }
    }
    let actual_port = actual_port.ok_or_else(|| {
        InferenceExecutorError::MockServerStartupFailed(
            "mock server did not emit ready line".to_string(),
        )
    })?;

    // Wait for the HTTP health endpoint to accept connections.
    let health_deadline = Instant::now() + Duration::from_secs(10);
    let mut healthy = false;
    while Instant::now() < health_deadline {
        if http_get_status(format!("http://127.0.0.1:{actual_port}/health")).is_ok() {
            healthy = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    if !healthy {
        return Err(InferenceExecutorError::MockServerStartupFailed(
            "mock server health endpoint did not become ready".to_string(),
        ));
    }

    execute_with_runtime(req, "127.0.0.1", actual_port).await
}

/// Execute `req` against `host:port` by spawning the canonical runtime.
async fn execute_with_runtime(
    req: &ResponsesRequest,
    host: &str,
    port: u16,
) -> Result<InferenceResult, InferenceExecutorError> {
    if host == "__https_not_supported__" {
        return Err(InferenceExecutorError::HttpsNotSupported);
    }

    let runtime_bin = runtime_bin()?;
    let allternit_root = allternit_root_from_runtime_bin(&runtime_bin)?;
    let work_dir = std::env::temp_dir().join(format!(
        "allternit-cloud-runtime-exec-{}-{}",
        std::process::id(),
        uuid::Uuid::new_v4().simple()
    ));
    tokio::fs::create_dir_all(&work_dir)
        .await
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("create work dir: {e}")))?;

    let manifests_dir = work_dir.join("manifests");
    let backends_dir = allternit_root.join("contracts/execution/backends");
    tokio::fs::create_dir_all(&manifests_dir)
        .await
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("create manifests dir: {e}")))?;

    write_remote_openai_manifest(&manifests_dir).map_err(|e| {
        InferenceExecutorError::SpawnFailed(format!("write transient manifest: {e}"))
    })?;

    let model_request_path = work_dir.join("model-request.json");
    let output_path = work_dir.join("output.json");
    let model_request = build_runtime_model_request(req, host, port);
    tokio::fs::write(
        &model_request_path,
        serde_json::to_string_pretty(&model_request)
            .map_err(|e| InferenceExecutorError::SpawnFailed(format!("serialize model request: {e}")))?,
    )
    .await
    .map_err(|e| InferenceExecutorError::SpawnFailed(format!("write model request: {e}")))?;

    let output = Command::new(&runtime_bin)
        .arg("--model-request-path")
        .arg(&model_request_path)
        .arg("--output-artifact-path")
        .arg(&output_path)
        .arg("--manifests-dir")
        .arg(&manifests_dir)
        .arg("--backends-dir")
        .arg(&backends_dir)
        .arg("--sandbox")
        .arg("none")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("spawn allternitos-runtime: {e}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(InferenceExecutorError::RequestFailed(format!(
            "allternitos-runtime exited with {}: {stderr}",
            output.status
        )));
    }

    let artifact_bytes = tokio::fs::read(&output_path)
        .await
        .map_err(|e| InferenceExecutorError::InvalidResponse(format!("read output artifact: {e}")))?;
    let artifact: serde_json::Value = serde_json::from_slice(&artifact_bytes).map_err(|e| {
        InferenceExecutorError::InvalidResponse(format!("parse output artifact: {e}"))
    })?;

    let generated_text = artifact["generated_text"]
        .as_str()
        .ok_or_else(|| InferenceExecutorError::InvalidResponse("missing generated_text".to_string()))?
        .to_string();
    let output_tokens = artifact["generated_tokens"]
        .as_u64()
        .map(|n| n as u32)
        .unwrap_or(0);
    let input_tokens = artifact["input_tokens"]
        .as_u64()
        .map(|n| n as u32)
        .unwrap_or_else(|| estimate_input_tokens(&req.messages));
    let finish_reason = artifact["finish_reason"]
        .as_str()
        .unwrap_or("stop")
        .to_string();

    Ok(InferenceResult {
        generated_text,
        input_tokens,
        output_tokens,
        finish_reason,
    })
}

/// Build a canonical OS `ModelRequest` that the remote-openai adapter will
/// route to `host:port`.
fn build_runtime_model_request(
    req: &ResponsesRequest,
    host: &str,
    port: u16,
) -> serde_json::Value {
    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(|m| json!({"role": m.role, "content": m.content}))
        .collect();

    let mut parameters = serde_json::Map::new();
    parameters.insert("messages".to_string(), json!(messages));
    parameters.insert("max_tokens".to_string(), json!(req.max_tokens.unwrap_or(150).max(1)));
    parameters.insert("host".to_string(), json!(host));
    parameters.insert("port".to_string(), json!(port));
    parameters.insert("stream".to_string(), json!(false));
    if let Some(temperature) = req.temperature {
        parameters.insert("temperature".to_string(), json!(temperature));
    }

    json!({
        "schema_version": "1.0.0",
        "request_id": format!("cloud-inference-{}", std::process::id()),
        "package_id": REMOTE_OPENAI_PACKAGE_ID,
        "purpose": "Cloud managed inference",
        "lease_id": null,
        "parameters": serde_json::Value::Object(parameters),
        "constraints": {}
    })
}

/// Write a transient manifest that binds the remote-openai package to the
/// remote-openai backend.
fn write_remote_openai_manifest(manifests_dir: &Path) -> std::io::Result<()> {
    let manifest = format!(
        r#"schema_version: 1
package_id: {REMOTE_OPENAI_PACKAGE_ID}
version: 1.0.0
kind: llm
default_install: remote
source:
  repository: https://example.com
  revision: main
  file: model.gguf
license:
  spdx: MIT
runtime:
  backend_id: {REMOTE_OPENAI_BACKEND_ID}
  upstream_release: n/a
hardware_profiles:
  minimum:
    ram_gib: 1
policy:
  offline_capable: false
"#
    );
    std::fs::write(manifests_dir.join("remote-openai.yaml"), manifest)
}

fn estimate_input_tokens(messages: &[crate::fabric_model_routes::Message]) -> u32 {
    let mut total = 0u32;
    for msg in messages {
        total += (msg.content.len() / 4).max(1) as u32 + 3;
    }
    total.max(1)
}

fn runtime_bin() -> Result<PathBuf, InferenceExecutorError> {
    if let Ok(path) = std::env::var("ALLTERNITOS_RUNTIME_BIN") {
        let p = PathBuf::from(path);
        if p.exists() {
            return Ok(p);
        }
    }
    if let Ok(cp_bin) = std::env::var("ALLTERNITOS_CONTROL_PLANE_BIN") {
        if let Some(parent) = PathBuf::from(cp_bin).parent() {
            let candidate = parent.join("allternitos-runtime");
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }
    let fallback = PathBuf::from("/Users/joe/Desktop/AllternitOS/target/debug/allternitos-runtime");
    if fallback.exists() {
        return Ok(fallback);
    }
    Err(InferenceExecutorError::RuntimeBinNotFound(
        "set ALLTERNITOS_RUNTIME_BIN or build the AllternitOS workspace".to_string(),
    ))
}

fn allternit_root_from_runtime_bin(bin: &Path) -> Result<PathBuf, InferenceExecutorError> {
    // target/debug/allternitos-runtime -> workspace root
    bin.parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.to_path_buf())
        .ok_or_else(|| {
            InferenceExecutorError::RuntimeBinNotFound(format!(
                "could not derive AllternitOS root from {}",
                bin.display()
            ))
        })
}

fn mock_llama_server_bin() -> Result<PathBuf, InferenceExecutorError> {
    if let Ok(path) = std::env::var("ALLTERNITOS_MOCK_LLAMA_SERVER_BIN") {
        let p = PathBuf::from(path);
        if p.exists() {
            return Ok(p);
        }
    }
    if let Ok(cp_bin) = std::env::var("ALLTERNITOS_CONTROL_PLANE_BIN") {
        if let Some(parent) = PathBuf::from(cp_bin).parent() {
            let candidate = parent.join("mock-llama-server");
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }
    let fallback = PathBuf::from("/Users/joe/Desktop/AllternitOS/target/debug/mock-llama-server");
    if fallback.exists() {
        return Ok(fallback);
    }
    Err(InferenceExecutorError::MockServerNotFound(
        "set ALLTERNITOS_MOCK_LLAMA_SERVER_BIN or build the AllternitOS workspace".to_string(),
    ))
}

fn pick_free_port() -> Result<u16, InferenceExecutorError> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("bind free port: {e}")))?;
    let port = listener
        .local_addr()
        .map_err(|e| InferenceExecutorError::SpawnFailed(format!("local addr: {e}")))?
        .port();
    drop(listener);
    Ok(port)
}

fn http_get_status(url: String) -> Result<u16, std::io::Error> {
    let url = url
        .strip_prefix("http://")
        .or_else(|| url.strip_prefix("https://"))
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "unsupported scheme"))?;
    let (host_port, path) = url
        .split_once('/')
        .map_or((url, "/".to_string()), |(hp, p)| (hp, format!("/{p}")));
    let (host, port) = host_port
        .split_once(':')
        .map_or((host_port, 80u16), |(h, p)| (h, p.parse().unwrap_or(80)));
    let mut stream = std::net::TcpStream::connect((host, port))?;
    let request = format!("GET {path} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n");
    stream.write_all(request.as_bytes())?;
    let mut response = Vec::new();
    stream.read_to_end(&mut response)?;
    let header = String::from_utf8_lossy(&response);
    let status_line = header.lines().next().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, "empty response")
    })?;
    let code = status_line
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "bad status line"))?;
    Ok(code)
}

impl InferenceExecutorError {
    pub fn to_api_error(&self) -> (StatusCode, String) {
        match self {
            InferenceExecutorError::UnsupportedProvider(_)
            | InferenceExecutorError::HttpsNotSupported => {
                (StatusCode::NOT_IMPLEMENTED, self.to_string())
            }
            InferenceExecutorError::NoEndpoint => {
                (StatusCode::SERVICE_UNAVAILABLE, self.to_string())
            }
            InferenceExecutorError::RuntimeBinNotFound(_)
            | InferenceExecutorError::MockServerNotFound(_)
            | InferenceExecutorError::SpawnFailed(_)
            | InferenceExecutorError::MockServerStartupFailed(_)
            | InferenceExecutorError::RequestFailed(_)
            | InferenceExecutorError::InvalidResponse(_) => {
                (StatusCode::SERVICE_UNAVAILABLE, self.to_string())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;
    use std::time::Duration;

    fn mock_openai_server() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let port = listener.local_addr().unwrap().port();
        thread::spawn(move || {
            let body = r#"{"id":"chatcmpl-test","object":"chat.completion","model":"remote-mock","choices":[{"index":0,"message":{"role":"assistant","content":"Cloud endpoint says hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":5,"total_tokens":7}}"#;
            let chat_response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            let health_response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}";
            let mut handled_chat = false;
            while let Ok((mut stream, _)) = listener.accept() {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let request = String::from_utf8_lossy(&buf[..n]);
                if request.starts_with("GET /health") {
                    let _ = stream.write_all(health_response.as_bytes());
                } else if request.starts_with("POST /v1/chat/completions") {
                    let _ = stream.write_all(chat_response.as_bytes());
                    handled_chat = true;
                }
                let _ = stream.flush();
                if handled_chat {
                    break;
                }
            }
        });
        thread::sleep(Duration::from_millis(50));
        port
    }

    fn sample_request() -> ResponsesRequest {
        ResponsesRequest {
            model: "openai/gpt-4o-mini".to_string(),
            messages: vec![crate::fabric_model_routes::Message {
                role: "user".to_string(),
                content: "Hi".to_string(),
            }],
            max_tokens: Some(50),
            temperature: Some(0.7),
        }
    }

    #[tokio::test]
    async fn execute_on_placement_routes_through_remote_openai_endpoint() {
        let port = mock_openai_server();
        let placement = Placement {
            id: "plc_test".to_string(),
            resource_id: "res_test".to_string(),
            node_id: None,
            offer_id: "off_test".to_string(),
            provider_kind: "runpod".to_string(),
            provider_resource_id: Some("pod-123".to_string()),
            region: "us-east".to_string(),
            instance_type: "gpu.s".to_string(),
            ipv4: None,
            endpoint: Some(format!("http://127.0.0.1:{port}")),
            retail_price_per_hour: None,
            provider_cost_per_hour: None,
            retail_price_per_request: None,
            provider_cost_per_request: None,
            retail_price_per_token: None,
            provider_cost_per_token: None,
            hold_id: None,
            status: "running".to_string(),
            started_at: chrono::Utc::now(),
            ended_at: None,
            termination_reason: None,
            created_at: Some(chrono::Utc::now()),
            updated_at: None,
            labels: std::collections::HashMap::new(),
        };

        let req = sample_request();
        let result = execute_on_placement(&placement, &req).await.expect("execute");
        assert_eq!(result.generated_text, "Cloud endpoint says hello");
        assert_eq!(result.input_tokens, 2);
        assert_eq!(result.output_tokens, 5);
    }
}
