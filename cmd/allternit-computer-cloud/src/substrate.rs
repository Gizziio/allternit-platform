//! Substrate abstraction and Incus client.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use tracing::{debug, info, warn};

/// Specification for creating a computer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ComputerSpec {
    pub name: String,
    pub os: String,
    pub image: String,
    pub cpu_cores: u32,
    pub memory_mb: u32,
    pub disk_mb: u32,
    #[serde(default)]
    pub env: HashMap<String, String>,
    #[serde(default)]
    pub profiles: Vec<String>,
}

/// Runtime state of a computer.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ComputerState {
    Creating,
    Running,
    Stopped,
    Error,
}

/// Opaque handle returned by a substrate.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ComputerHandle {
    pub native_id: String,
    pub host: String,
    pub state: ComputerState,
    pub metadata: HashMap<String, String>,
}

/// Errors a substrate may return.
#[derive(Debug, Error)]
pub enum SubstrateError {
    #[error("request failed: {0}")]
    Request(String),
    #[error("api error {status}: {message}")]
    Api { status: u16, message: String },
    #[error("computer not found: {0}")]
    NotFound(String),
    #[error("operation timed out")]
    Timeout,
}

impl SubstrateError {
    fn from_status(status: u16, body: String) -> Self {
        if status == 404 {
            Self::NotFound(body)
        } else {
            Self::Api {
                status,
                message: body,
            }
        }
    }
}

/// Snapshot metadata returned by a substrate.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SnapshotInfo {
    pub id: String,
    pub created_at: String,
    pub stateful: bool,
}

/// Abstract desktop substrate.
#[async_trait]
pub trait Substrate: Send + Sync {
    async fn create(&self, spec: ComputerSpec) -> Result<ComputerHandle, SubstrateError>;
    async fn start(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError>;
    async fn stop(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError>;
    async fn delete(&self, native_id: &str) -> Result<(), SubstrateError>;
    async fn get(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError>;
    async fn exec(
        &self,
        native_id: &str,
        command: &[String],
        env: &HashMap<String, String>,
    ) -> Result<ExecResult, SubstrateError>;

    async fn create_snapshot(
        &self,
        native_id: &str,
        snapshot_id: &str,
        stateful: bool,
    ) -> Result<(), SubstrateError>;
    async fn restore_snapshot(
        &self,
        native_id: &str,
        snapshot_id: &str,
    ) -> Result<(), SubstrateError>;
    async fn delete_snapshot(
        &self,
        native_id: &str,
        snapshot_id: &str,
    ) -> Result<(), SubstrateError>;
    async fn list_snapshots(
        &self,
        native_id: &str,
    ) -> Result<Vec<SnapshotInfo>, SubstrateError>;
}

/// Result of a command executed inside a computer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExecResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

// ---------------------------------------------------------------------------
// HTTP transport abstraction so tests can inject mocks.
// ---------------------------------------------------------------------------

#[async_trait]
pub(crate) trait HttpClient: Send + Sync {
    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), SubstrateError>;

    async fn request_bytes(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, Vec<u8>), SubstrateError>;

    /// Send a raw byte body and return the raw byte response.
    async fn request_bytes_with_body(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Vec<u8>,
    ) -> Result<(u16, Vec<u8>), SubstrateError>;
}

struct ReqwestClient {
    inner: reqwest::Client,
    base: String,
}

#[async_trait]
impl HttpClient for ReqwestClient {
    async fn request(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, serde_json::Value), SubstrateError> {
        let url = format!("{}{}", self.base.trim_end_matches('/'), path);
        let mut req = self.inner.request(method, &url);
        if let Some(b) = body {
            req = req.json(&b);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| SubstrateError::Request(e.to_string()))?;
        let status = resp.status().as_u16();
        let json = resp
            .json()
            .await
            .unwrap_or_else(|_| serde_json::Value::Null);
        Ok((status, json))
    }

    async fn request_bytes(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Option<serde_json::Value>,
    ) -> Result<(u16, Vec<u8>), SubstrateError> {
        let url = format!("{}{}", self.base.trim_end_matches('/'), path);
        let mut req = self.inner.request(method, &url);
        if let Some(b) = body {
            req = req.json(&b);
        }
        let resp = req
            .send()
            .await
            .map_err(|e| SubstrateError::Request(e.to_string()))?;
        let status = resp.status().as_u16();
        let bytes = resp.bytes().await.unwrap_or_default().to_vec();
        Ok((status, bytes))
    }

    async fn request_bytes_with_body(
        &self,
        method: reqwest::Method,
        path: &str,
        body: Vec<u8>,
    ) -> Result<(u16, Vec<u8>), SubstrateError> {
        let url = format!("{}{}", self.base.trim_end_matches('/'), path);
        let req = self.inner.request(method, &url).body(body);
        let resp = req
            .send()
            .await
            .map_err(|e| SubstrateError::Request(e.to_string()))?;
        let status = resp.status().as_u16();
        let bytes = resp.bytes().await.unwrap_or_default().to_vec();
        Ok((status, bytes))
    }
}

// ---------------------------------------------------------------------------
// Incus substrate.
// ---------------------------------------------------------------------------

/// Client for the Incus REST API (`/1.0`).
pub struct IncusSubstrate {
    client: Box<dyn HttpClient>,
}

impl std::fmt::Debug for IncusSubstrate {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("IncusSubstrate").finish_non_exhaustive()
    }
}

impl IncusSubstrate {
    /// Create a substrate backed by a real Incus daemon.
    ///
    /// TLS client-certificate auth is enabled via `INCUS_CLIENT_CERT` and
    /// `INCUS_CLIENT_KEY`. Self-signed server certificates are accepted when
    /// `INCUS_INSECURE_SKIP_VERIFY=true`.
    pub fn new(base_url: impl Into<String>) -> Result<Self, SubstrateError> {
        // Use a generous timeout because Incus create/wait operations can block
        // for tens of seconds while the image unpacks.
        let mut builder = reqwest::Client::builder().timeout(std::time::Duration::from_secs(180));

        if let Ok(cert_path) = std::env::var("INCUS_CLIENT_CERT") {
            if let Ok(key_path) = std::env::var("INCUS_CLIENT_KEY") {
                let cert = std::fs::read(&cert_path)
                    .map_err(|e| SubstrateError::Request(format!("cert read: {e}")))?;
                let key = std::fs::read(&key_path)
                    .map_err(|e| SubstrateError::Request(format!("key read: {e}")))?;
                let mut pem = cert;
                pem.extend_from_slice(&key);
                let identity = reqwest::Identity::from_pem(&pem)
                    .map_err(|e| SubstrateError::Request(format!("identity from_pem: {e}")))?;
                builder = builder.identity(identity);
            }
        }

        // Validate the server certificate against a custom CA when one is
        // provided. Only fall back to skipping verification when explicitly
        // requested and no CA is configured.
        if let Ok(ca_path) = std::env::var("INCUS_CA_CERT") {
            let ca = std::fs::read(&ca_path)
                .map_err(|e| SubstrateError::Request(format!("ca cert read: {e}")))?;
            let cert = reqwest::Certificate::from_pem(&ca)
                .map_err(|e| SubstrateError::Request(format!("ca cert parse: {e}")))?;
            builder = builder.add_root_certificate(cert);
        } else if std::env::var("INCUS_INSECURE_SKIP_VERIFY").as_deref() == Ok("true") {
            builder = builder.danger_accept_invalid_certs(true);
        }

        // If a client certificate was supplied we are targeting an Incus HTTPS
        // endpoint, so force the rustls backend to use PEM identities.
        if std::env::var("INCUS_CLIENT_CERT").is_ok() && std::env::var("INCUS_CLIENT_KEY").is_ok() {
            builder = builder.use_rustls_tls();
        }

        let client = builder
            .build()
            .map_err(|e| SubstrateError::Request(format!("reqwest client build: {e}")))?;
        Ok(Self {
            client: Box::new(ReqwestClient {
                inner: client,
                base: base_url.into(),
            }),
        })
    }

    /// Internal constructor for tests with a mock client.
    #[cfg(test)]
    fn with_client(client: Box<dyn HttpClient>) -> Self {
        Self { client }
    }
}

#[async_trait]
impl Substrate for IncusSubstrate {
    async fn create(&self, spec: ComputerSpec) -> Result<ComputerHandle, SubstrateError> {
        debug!(name = %spec.name, "creating Incus instance");
        let (alias, server, protocol) = parse_image_alias(&spec.image);
        let mut source = serde_json::json!({
            "type": "image",
            "alias": alias,
        });
        if let Some(s) = server {
            source["server"] = s.into();
            source["protocol"] = protocol
                .unwrap_or_else(|| "simplestreams".to_string())
                .into();
        }
        let instance_type = if spec.os.eq_ignore_ascii_case("windows") {
            "virtual-machine"
        } else {
            "container"
        };
        let mut body = serde_json::json!({
            "name": spec.name,
            "source": source,
            "config": {
                "limits.cpu": spec.cpu_cores.to_string(),
                "limits.memory": format!("{}MiB", spec.memory_mb),
            },
            "type": instance_type,
        });
        if !spec.profiles.is_empty() {
            body["profiles"] = serde_json::json!(spec.profiles);
        }
        let (status, json) = self
            .client
            .request(reqwest::Method::POST, "/1.0/instances", Some(body))
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        // Wait for the operation to finish (best-effort; Incus removes completed
        // operations quickly, so a 404 means it already finished).
        let _ = wait_operation(&*self.client, &json).await;
        let metadata = json.get("metadata").unwrap_or(&json);
        let native_id = metadata
            .get("resources")
            .and_then(|r| r.get("instances"))
            .and_then(|i| i.as_array())
            .and_then(|a| a.first())
            .and_then(|v| v.as_str())
            .map(|s| {
                s.rsplit_once('/')
                    .map(|(_, n)| n.to_string())
                    .unwrap_or_else(|| s.to_string())
            })
            .unwrap_or_else(|| spec.name.clone());
        Ok(ComputerHandle {
            native_id,
            host: "incus-host".to_string(),
            state: ComputerState::Creating,
            metadata: spec.env.clone(),
        })
    }

    async fn start(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError> {
        self.action(native_id, "start").await
    }

    async fn stop(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError> {
        self.action(native_id, "stop").await
    }

    async fn delete(&self, native_id: &str) -> Result<(), SubstrateError> {
        let (status, json) = self
            .client
            .request(
                reqwest::Method::DELETE,
                &format!("/1.0/instances/{}", native_id),
                None,
            )
            .await?;
        if is_success(status) {
            let _ = wait_operation(&*self.client, &json).await;
            Ok(())
        } else {
            Err(SubstrateError::from_status(status, json.to_string()))
        }
    }

    async fn get(&self, native_id: &str) -> Result<ComputerHandle, SubstrateError> {
        let (status, json) = self
            .client
            .request(
                reqwest::Method::GET,
                &format!("/1.0/instances/{}", native_id),
                None,
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let payload = response_payload(&json);
        let state = payload.get("status").and_then(|s| s.as_str());
        Ok(ComputerHandle {
            native_id: native_id.to_string(),
            host: "incus-host".to_string(),
            state: parse_state(state.unwrap_or("")),
            metadata: HashMap::new(),
        })
    }

    async fn exec(
        &self,
        native_id: &str,
        command: &[String],
        env: &HashMap<String, String>,
    ) -> Result<ExecResult, SubstrateError> {
        if command.is_empty() {
            return Ok(ExecResult {
                exit_code: 0,
                stdout: String::new(),
                stderr: String::new(),
            });
        }
        let body = serde_json::json!({
            "command": command,
            "environment": env,
            "wait-for-websocket": false,
            "record-output": true,
        });
        let (status, json) = self
            .client
            .request(
                reqwest::Method::POST,
                &format!("/1.0/instances/{}/exec", native_id),
                Some(body),
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let op = wait_operation(&*self.client, &json).await?;
        // Incus wraps the operation in `metadata`; the operation itself also has
        // a nested `metadata` field that carries `output` and `return`.
        let payload = response_payload(&op);
        let inner = response_payload(payload);
        let return_code = find_i64(inner, "return").unwrap_or(-1) as i32;
        let output = inner
            .get("output")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({}));

        let stdout_path = output
            .get("1")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let stderr_path = output
            .get("2")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        info!(native_id, return_code, stdout_path, stderr_path, "exec completed; fetching output");

        let stdout = if !stdout_path.is_empty() {
            match self.client.request_bytes(reqwest::Method::GET, stdout_path, None).await {
                Ok((status, bytes)) if is_success(status) => {
                    info!(native_id, stdout_len = bytes.len(), "fetched exec stdout");
                    String::from_utf8_lossy(&bytes).to_string()
                }
                Ok((status, bytes)) => {
                    warn!(stdout_path, status, body = %String::from_utf8_lossy(&bytes), "failed to fetch exec stdout");
                    String::new()
                }
                Err(e) => {
                    warn!(stdout_path, error = %e, "failed to fetch exec stdout");
                    String::new()
                }
            }
        } else {
            String::new()
        };
        let stderr = if !stderr_path.is_empty() {
            match self.client.request_bytes(reqwest::Method::GET, stderr_path, None).await {
                Ok((status, bytes)) if is_success(status) => {
                    info!(native_id, stderr_len = bytes.len(), "fetched exec stderr");
                    String::from_utf8_lossy(&bytes).to_string()
                }
                Ok((status, bytes)) => {
                    warn!(stderr_path, status, body = %String::from_utf8_lossy(&bytes), "failed to fetch exec stderr");
                    String::new()
                }
                Err(e) => {
                    warn!(stderr_path, error = %e, "failed to fetch exec stderr");
                    String::new()
                }
            }
        } else {
            String::new()
        };

        Ok(ExecResult {
            exit_code: return_code,
            stdout,
            stderr,
        })
    }

    async fn create_snapshot(
        &self,
        native_id: &str,
        snapshot_id: &str,
        stateful: bool,
    ) -> Result<(), SubstrateError> {
        let body = serde_json::json!({
            "name": snapshot_id,
            "stateful": stateful,
        });
        let (status, json) = self
            .client
            .request(
                reqwest::Method::POST,
                &format!("/1.0/instances/{}/snapshots", native_id),
                Some(body),
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let _ = wait_operation(&*self.client, &json).await;
        Ok(())
    }

    async fn restore_snapshot(
        &self,
        native_id: &str,
        snapshot_id: &str,
    ) -> Result<(), SubstrateError> {
        let body = serde_json::json!({});
        let (status, json) = self
            .client
            .request(
                reqwest::Method::POST,
                &format!("/1.0/instances/{}/snapshots/{}/restore", native_id, snapshot_id),
                Some(body),
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let _ = wait_operation(&*self.client, &json).await;
        Ok(())
    }

    async fn delete_snapshot(
        &self,
        native_id: &str,
        snapshot_id: &str,
    ) -> Result<(), SubstrateError> {
        let (status, json) = self
            .client
            .request(
                reqwest::Method::DELETE,
                &format!("/1.0/instances/{}/snapshots/{}", native_id, snapshot_id),
                None,
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let _ = wait_operation(&*self.client, &json).await;
        Ok(())
    }

    async fn list_snapshots(
        &self,
        native_id: &str,
    ) -> Result<Vec<SnapshotInfo>, SubstrateError> {
        let (status, json) = self
            .client
            .request(
                reqwest::Method::GET,
                &format!("/1.0/instances/{}/snapshots", native_id),
                None,
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let payload = response_payload(&json);
        let array = payload.as_array().unwrap_or(&Vec::new()).clone();
        let mut snapshots = Vec::new();
        for item in array {
            if let Some(url) = item.as_str() {
                let name = url.rsplit_once('/').map(|(_, n)| n).unwrap_or(url);
                snapshots.push(SnapshotInfo {
                    id: name.to_string(),
                    created_at: String::new(),
                    stateful: false,
                });
            }
        }
        Ok(snapshots)
    }
}

impl IncusSubstrate {
    async fn action(
        &self,
        native_id: &str,
        action: &str,
    ) -> Result<ComputerHandle, SubstrateError> {
        let body = serde_json::json!({ "action": action, "timeout": 30 });
        let (status, json) = self
            .client
            .request(
                reqwest::Method::PUT,
                &format!("/1.0/instances/{}/state", native_id),
                Some(body),
            )
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let _ = wait_operation(&*self.client, &json).await;
        self.get(native_id).await
    }

    /// Add a proxy device to a running instance.
    pub async fn add_proxy_device(
        &self,
        native_id: &str,
        name: &str,
        listen: &str,
        connect: &str,
    ) -> Result<(), SubstrateError> {
        let body = serde_json::json!({
            "devices": {
                name: {
                    "type": "proxy",
                    "listen": listen,
                    "connect": connect,
                }
            }
        });
        let (status, json) = self
            .client
            .request(
                reqwest::Method::PATCH,
                &format!("/1.0/instances/{}", native_id),
                Some(body),
            )
            .await?;
        if is_success(status) {
            Ok(())
        } else {
            Err(SubstrateError::from_status(status, json.to_string()))
        }
    }

    /// Fetch the raw instance configuration/metadata.
    pub async fn get_config(&self, native_id: &str) -> Result<serde_json::Value, SubstrateError> {
        let (status, json) = self
            .client
            .request(
                reqwest::Method::GET,
                &format!("/1.0/instances/{}", native_id),
                None,
            )
            .await?;
        if is_success(status) {
            Ok(json)
        } else {
            Err(SubstrateError::from_status(status, json.to_string()))
        }
    }

    /// List all instance names known to this Incus daemon.
    pub async fn list_instance_names(&self) -> Result<Vec<String>, SubstrateError> {
        let (status, json) = self
            .client
            .request(reqwest::Method::GET, "/1.0/instances", None)
            .await?;
        if !is_success(status) {
            return Err(SubstrateError::from_status(status, json.to_string()));
        }
        let payload = response_payload(&json);
        let names: Vec<String> = payload
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str())
                    .filter_map(|url| url.split('/').next_back())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();
        Ok(names)
    }

    /// Pull a file from the instance via the Incus files API.
    pub async fn pull_file(&self, native_id: &str, path: &str) -> Result<Vec<u8>, SubstrateError> {
        let url = format!(
            "/1.0/instances/{}/files?path={}",
            native_id,
            urlencoding::encode(path)
        );
        let (status, body) = self
            .client
            .request_bytes(reqwest::Method::GET, &url, None)
            .await?;
        if is_success(status) {
            Ok(body)
        } else {
            Err(SubstrateError::from_status(
                status,
                String::from_utf8_lossy(&body).to_string(),
            ))
        }
    }

    /// Push a file into the instance via the Incus files API.
    pub async fn push_file(
        &self,
        native_id: &str,
        path: &str,
        content: Vec<u8>,
    ) -> Result<(), SubstrateError> {
        let url = format!(
            "/1.0/instances/{}/files?path={}",
            native_id,
            urlencoding::encode(path)
        );
        let (status, body) = self
            .client
            .request_bytes_with_body(reqwest::Method::POST, &url, content)
            .await?;
        if is_success(status) {
            Ok(())
        } else {
            Err(SubstrateError::from_status(
                status,
                String::from_utf8_lossy(&body).to_string(),
            ))
        }
    }
}

fn parse_image_alias(image: &str) -> (String, Option<String>, Option<String>) {
    if let Some((remote, alias)) = image.split_once(':') {
        let (server, protocol) = match remote {
            "images" => (
                Some("https://images.linuxcontainers.org".to_string()),
                Some("simplestreams".to_string()),
            ),
            "local" => (None, None),
            _ => (None, None),
        };
        (alias.to_string(), server, protocol)
    } else {
        (
            image.to_string(),
            Some("https://images.linuxcontainers.org".to_string()),
            Some("simplestreams".to_string()),
        )
    }
}

fn is_success(status: u16) -> bool {
    status >= 200 && status < 300
}

fn parse_state(status: &str) -> ComputerState {
    match status {
        "Running" => ComputerState::Running,
        "Stopped" => ComputerState::Stopped,
        "Error" => ComputerState::Error,
        _ => ComputerState::Creating,
    }
}

async fn wait_operation(
    client: &dyn HttpClient,
    resp: &serde_json::Value,
) -> Result<serde_json::Value, SubstrateError> {
    let operation_url = resp.get("operation").and_then(|v| v.as_str());
    let Some(url) = operation_url else {
        return Ok(resp.clone());
    };
    let path = url
        .splitn(2, "/1.0")
        .nth(1)
        .map(|p| format!("/1.0{}", p))
        .unwrap_or_else(|| url.to_string());
    let wait_path = format!("{}/wait?timeout=60", path.trim_end_matches('/'));

    let (status, json) = client
        .request(reqwest::Method::GET, &wait_path, None)
        .await?;
    if is_success(status) {
        if operation_status(&json) == Some("Failure") {
            let err = operation_error(&json).unwrap_or_else(|| "operation failed".to_string());
            return Err(SubstrateError::Api {
                status: 500,
                message: err,
            });
        }
        return Ok(json);
    }
    if status == 404 {
        // Operation finished and was removed; the original response is the
        // best information we have.
        return Ok(resp.clone());
    }
    Err(SubstrateError::from_status(status, json.to_string()))
}

fn response_payload(value: &serde_json::Value) -> &serde_json::Value {
    value.get("metadata").or(value.get("data")).unwrap_or(value)
}

fn operation_status(json: &serde_json::Value) -> Option<&str> {
    json.get("metadata")
        .and_then(|m| m.get("status"))
        .and_then(|s| s.as_str())
        .or_else(|| json.get("status").and_then(|s| s.as_str()))
}

fn operation_error(json: &serde_json::Value) -> Option<String> {
    json.get("metadata")
        .and_then(|m| m.get("err"))
        .and_then(|e| e.as_str())
        .map(|s| s.to_string())
}

fn find_i64(value: &serde_json::Value, key: &str) -> Option<i64> {
    if let Some(v) = value.get(key).and_then(|v| v.as_i64()) {
        return Some(v);
    }
    if let Some(obj) = value.as_object() {
        for v in obj.values() {
            if let Some(found) = find_i64(v, key) {
                return Some(found);
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Tests with an in-memory HTTP client.
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::Mutex;

    struct MockClient {
        responses: Mutex<Vec<(u16, serde_json::Value)>>,
        byte_responses: Mutex<Vec<(u16, Vec<u8>)>>,
    }

    #[async_trait]
    impl HttpClient for MockClient {
        async fn request(
            &self,
            _method: reqwest::Method,
            _path: &str,
            _body: Option<serde_json::Value>,
        ) -> Result<(u16, serde_json::Value), SubstrateError> {
            let mut responses = self.responses.lock().unwrap();
            Ok(responses.remove(0))
        }

        async fn request_bytes(
            &self,
            _method: reqwest::Method,
            _path: &str,
            _body: Option<serde_json::Value>,
        ) -> Result<(u16, Vec<u8>), SubstrateError> {
            let mut responses = self.byte_responses.lock().unwrap();
            if responses.is_empty() {
                Ok((200, Vec::new()))
            } else {
                Ok(responses.remove(0))
            }
        }

        async fn request_bytes_with_body(
            &self,
            _method: reqwest::Method,
            _path: &str,
            _body: Vec<u8>,
        ) -> Result<(u16, Vec<u8>), SubstrateError> {
            let mut responses = self.byte_responses.lock().unwrap();
            if responses.is_empty() {
                Ok((200, Vec::new()))
            } else {
                Ok(responses.remove(0))
            }
        }
    }

    fn mock(responses: Vec<(u16, serde_json::Value)>) -> IncusSubstrate {
        IncusSubstrate::with_client(Box::new(MockClient {
            responses: Mutex::new(responses),
            byte_responses: Mutex::new(Vec::new()),
        }))
    }

    fn mock_with_bytes(
        responses: Vec<(u16, serde_json::Value)>,
        byte_responses: Vec<(u16, Vec<u8>)>,
    ) -> IncusSubstrate {
        IncusSubstrate::with_client(Box::new(MockClient {
            responses: Mutex::new(responses),
            byte_responses: Mutex::new(byte_responses),
        }))
    }

    #[tokio::test]
    async fn create_returns_native_id_from_resources() {
        let substrate = mock(vec![
            (
                200,
                serde_json::json!({
                    "operation": "/1.0/operations/op-1",
                    "status": "Operation created",
                }),
            ),
            (
                200,
                serde_json::json!({
                    "data": {
                        "status": "Success",
                        "metadata": {
                            "resources": {
                                "instances": ["/1.0/instances/bot-desktop-abc123"]
                            }
                        }
                    }
                }),
            ),
        ]);
        let handle = substrate
            .create(ComputerSpec {
                name: "bot-desktop-abc123".to_string(),
                os: "linux".to_string(),
                image: "ubuntu-desktop".to_string(),
                cpu_cores: 2,
                memory_mb: 4096,
                disk_mb: 20480,
                env: HashMap::new(),
                profiles: vec![],
            })
            .await
            .unwrap();
        assert_eq!(handle.native_id, "bot-desktop-abc123");
        assert_eq!(handle.state, ComputerState::Creating);
    }

    #[tokio::test]
    async fn get_parses_running_state() {
        let substrate = mock(vec![(
            200,
            serde_json::json!({ "data": { "status": "Running" } }),
        )]);
        let handle = substrate.get("vm-1").await.unwrap();
        assert_eq!(handle.state, ComputerState::Running);
    }

    #[tokio::test]
    async fn start_then_get_updates_state() {
        let substrate = mock(vec![
            (
                200,
                serde_json::json!({ "operation": "/1.0/operations/op-2" }),
            ),
            (200, serde_json::json!({ "data": { "status": "Success" } })),
            (200, serde_json::json!({ "data": { "status": "Running" } })),
        ]);
        let handle = substrate.start("vm-1").await.unwrap();
        assert_eq!(handle.state, ComputerState::Running);
    }

    #[tokio::test]
    async fn not_found_returns_error() {
        let substrate = mock(vec![(404, serde_json::json!({ "error": "Not found" }))]);
        let err = substrate.get("missing").await.unwrap_err();
        assert!(matches!(err, SubstrateError::NotFound(_)));
    }

    #[tokio::test]
    async fn exec_extracts_output_from_nested_metadata() {
        let substrate = mock_with_bytes(
            vec![
                (
                    200,
                    serde_json::json!({
                        "operation": "/1.0/operations/exec-1",
                        "status": "Operation created",
                    }),
                ),
                (
                    200,
                    serde_json::json!({
                        "type": "sync",
                        "status": "Success",
                        "metadata": {
                            "id": "exec-1",
                            "status": "Success",
                            "metadata": {
                                "output": {
                                    "1": "/1.0/instances/vm-1/logs/exec-output/exec_1.stdout",
                                    "2": "/1.0/instances/vm-1/logs/exec-output/exec_1.stderr"
                                },
                                "return": 0
                            }
                        }
                    }),
                ),
            ],
            vec![
                (200, b"hello stdout".to_vec()),
                (200, b"hello stderr".to_vec()),
            ],
        );
        let result = substrate
            .exec(
                "vm-1",
                &["echo".to_string(), "hello".to_string()],
                &HashMap::new(),
            )
            .await
            .unwrap();
        assert_eq!(result.exit_code, 0);
        assert_eq!(result.stdout, "hello stdout");
        assert_eq!(result.stderr, "hello stderr");
    }
}
