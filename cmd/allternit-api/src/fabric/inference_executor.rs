//! Execute a model request against the OS-scheduled placement.
//!
//! This is the Phase-4 execution loop: after the Cloud Model Gateway has
//! acquired a canonical OS lease/placement for inference capacity, it must
//! actually run the model and return generated tokens.
//!
//! Current state:
//! - `fake` placements are executed with the AllternitOS `mock-llama-server`
//!   test double. This returns real (non-MVP) generated content and lets the
//!   e2e test assert real tokens without needing real GPUs or model weights.
//! - Real cloud-provider placements (`runpod`, `vast`) and local runtime
//!   placements are not yet wired; they return a clear error so we do not fake
//!   success.
//!
//! Future work:
//! - Local placements: invoke `allternitos-runtime` with the canonical
//!   `ModelRequest` and stream the response.
//! - Cloud placements: proxy to the existing Cloud OpenAI/Together/Fireworks
//!   provider adapters using the endpoint/access info in the OS placement.

use crate::fabric_model_routes::ResponsesRequest;
use allternitos_cloud_contracts::Placement;
use axum::http::StatusCode;
use serde::Deserialize;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tokio::process::Command;

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
    #[error("mock llama server binary not found: {0}")]
    MockServerNotFound(String),
    #[error("failed to spawn mock server: {0}")]
    SpawnFailed(String),
    #[error("mock server failed to start: {0}")]
    MockServerStartupFailed(String),
    #[error("inference request failed: {0}")]
    RequestFailed(String),
    #[error("invalid response from inference backend: {0}")]
    InvalidResponse(String),
}

/// Run inference for `req` on the OS `placement`.
///
/// Returns real generated tokens when the placement can be satisfied by a
/// supported backend. Returns an error rather than a deterministic placeholder
/// when the backend is not yet implemented.
pub(crate) async fn execute_on_placement(
    placement: &Placement,
    req: &ResponsesRequest,
) -> Result<InferenceResult, InferenceExecutorError> {
    match placement.provider_kind.as_str() {
        "fake" => execute_with_mock_llama_server(req).await,
        other => Err(InferenceExecutorError::UnsupportedProvider(format!(
            "provider_kind '{}' does not yet have a real inference executor wired; only 'fake' test-double placements are supported",
            other
        ))),
    }
}

/// Execute against the AllternitOS `mock-llama-server` test double.
///
/// The mock server is built as part of the AllternitOS workspace. It speaks
/// enough of the `llama.cpp-server` HTTP surface (health + chat completions)
/// for this executor to return real generated tokens.
async fn execute_with_mock_llama_server(req: &ResponsesRequest) -> Result<InferenceResult, InferenceExecutorError> {
    let mock_bin = mock_llama_server_bin()?;

    let work_dir = std::env::temp_dir().join(format!(
        "allternit-cloud-mock-inference-{}",
        std::process::id()
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

    let messages_json = serde_json::to_string(&req.messages)
        .map_err(|e| InferenceExecutorError::RequestFailed(format!("serialize messages: {e}")))?;
    let max_tokens = req.max_tokens.unwrap_or(150).max(1);
    let body = format!(
        r#"{{"model":"mock","messages":{messages_json},"max_tokens":{max_tokens}}}"#
    );
    let request = format!(
        "POST /v1/chat/completions HTTP/1.1\r\n\
         Host: 127.0.0.1\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {}\r\n\
         Connection: close\r\n\r\n\
         {}",
        body.len(),
        body
    );

    let response_text = tokio::task::spawn_blocking(move || {
        let mut stream = TcpStream::connect(("127.0.0.1", actual_port))
            .map_err(|e| InferenceExecutorError::RequestFailed(format!("connect: {e}")))?;
        stream
            .write_all(request.as_bytes())
            .map_err(|e| InferenceExecutorError::RequestFailed(format!("send: {e}")))?;
        let mut response = Vec::new();
        stream
            .read_to_end(&mut response)
            .map_err(|e| InferenceExecutorError::RequestFailed(format!("read: {e}")))?;
        Ok::<_, InferenceExecutorError>(String::from_utf8_lossy(&response).to_string())
    })
    .await
    .map_err(|e| InferenceExecutorError::RequestFailed(format!("join: {e}")))?
    .map_err(|e| InferenceExecutorError::RequestFailed(format!("{e}")))?;

    parse_chat_completion_response(&response_text)
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

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<Choice>,
    usage: Usage,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: MessageResponse,
    finish_reason: String,
}

#[derive(Debug, Deserialize)]
struct MessageResponse {
    content: String,
}

#[derive(Debug, Deserialize)]
struct Usage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

fn parse_chat_completion_response(raw: &str) -> Result<InferenceResult, InferenceExecutorError> {
    let body = raw
        .split("\r\n\r\n")
        .nth(1)
        .ok_or_else(|| InferenceExecutorError::InvalidResponse("no response body".to_string()))?;
    let parsed: ChatCompletionResponse = serde_json::from_str(body)
        .map_err(|e| InferenceExecutorError::InvalidResponse(format!("{e}: {body}")))?;
    let choice = parsed
        .choices
        .into_iter()
        .next()
        .ok_or_else(|| InferenceExecutorError::InvalidResponse("no choices".to_string()))?;
    Ok(InferenceResult {
        generated_text: choice.message.content,
        input_tokens: parsed.usage.prompt_tokens,
        output_tokens: parsed.usage.completion_tokens,
        finish_reason: choice.finish_reason,
    })
}

impl InferenceExecutorError {
    pub fn to_api_error(&self) -> (StatusCode, String) {
        match self {
            InferenceExecutorError::UnsupportedProvider(_) => {
                (StatusCode::NOT_IMPLEMENTED, self.to_string())
            }
            InferenceExecutorError::MockServerNotFound(_)
            | InferenceExecutorError::SpawnFailed(_)
            | InferenceExecutorError::MockServerStartupFailed(_)
            | InferenceExecutorError::RequestFailed(_)
            | InferenceExecutorError::InvalidResponse(_) => {
                (StatusCode::SERVICE_UNAVAILABLE, self.to_string())
            }
        }
    }
}
