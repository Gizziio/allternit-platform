//! OpenSandbox execution driver
//!
//! Talks to an OpenSandbox control plane to provision persistent sandboxes
//! for bots/agents and to resolve their remote-desktop endpoints.

use allternit_driver_interface::{
    Artifact, CommandSpec, DesktopEndpoint, DesktopProtocol, DriverCapabilities, DriverError,
    DriverFeatures, DriverHealth, DriverType, ExecResult, ExecutionDriver, ExecutionHandle,
    ExecutionId, IsolationLevel, LogEntry, Receipt, ResourceConsumption, ResourceSpec, SpawnSpec,
    TenantId,
};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{debug, info, warn};

/// Configuration for the OpenSandbox driver.
#[derive(Debug, Clone)]
pub struct OpenSandboxConfig {
    /// Base URL of the OpenSandbox control plane, e.g. `http://localhost:8080`.
    pub base_url: String,
    /// Optional bearer token for OpenSandbox API authentication.
    pub token: Option<String>,
}

impl OpenSandboxConfig {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            token: None,
        }
    }

    pub fn with_token(mut self, token: impl Into<String>) -> Self {
        self.token = Some(token.into());
        self
    }
}

/// In-memory record of a sandbox managed by OpenSandbox.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SandboxRecord {
    native_id: String,
    agent_id: String,
    status: SandboxStatus,
    host: String,
    vnc_url: Option<String>,
    novnc_url: Option<String>,
    vnc_token: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum SandboxStatus {
    Creating,
    Running,
    Stopped,
    Error,
}

/// OpenSandbox execution driver.
#[derive(Clone)]
pub struct OpenSandboxDriver {
    config: OpenSandboxConfig,
    client: reqwest::Client,
    sandboxes: Arc<Mutex<HashMap<String, SandboxRecord>>>,
}

impl fmt::Debug for OpenSandboxDriver {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("OpenSandboxDriver")
            .field("base_url", &self.config.base_url)
            .finish()
    }
}

impl OpenSandboxDriver {
    pub fn new(config: OpenSandboxConfig) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Self {
            config,
            client,
            sandboxes: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn api_url(&self, path: &str) -> String {
        let base = self.config.base_url.trim_end_matches('/');
        format!("{}{}", base, path)
    }

    fn auth_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::CONTENT_TYPE,
            reqwest::header::HeaderValue::from_static("application/json"),
        );
        if let Some(token) = &self.config.token {
            if let Ok(value) = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token)) {
                headers.insert(reqwest::header::AUTHORIZATION, value);
            }
        }
        headers
    }

    /// Register a sandbox record that was created through another path (e.g.
    /// the frontend VM operator client) so the driver can resolve its desktop.
    pub async fn register_sandbox(
        &self,
        native_id: String,
        agent_id: String,
        host: String,
    ) {
        let record = SandboxRecord {
            native_id: native_id.clone(),
            agent_id,
            status: SandboxStatus::Running,
            host,
            vnc_url: None,
            novnc_url: None,
            vnc_token: None,
            created_at: chrono::Utc::now(),
        };
        self.sandboxes.lock().await.insert(native_id, record);
    }

    /// Probe the sandbox host for an available desktop endpoint.
    ///
    /// Tries raw VNC (port 5900) first, then noVNC HTTP (port 6080). When a
    /// port responds we cache the result on the record so later lookups are
    /// cheap.
    async fn resolve_desktop_endpoint(
        &self,
        record: &mut SandboxRecord,
    ) -> Result<Option<DesktopEndpoint>, DriverError> {
        // If we already have a cached endpoint, return it.
        if let Some(url) = &record.vnc_url {
            return Ok(Some(DesktopEndpoint {
                url: url.clone(),
                protocol: DesktopProtocol::Vnc,
                token: record.vnc_token.clone(),
            }));
        }
        if let Some(url) = &record.novnc_url {
            return Ok(Some(DesktopEndpoint {
                url: url.clone(),
                protocol: DesktopProtocol::NoVncHttp,
                token: record.vnc_token.clone(),
            }));
        }

        let host = record.host.clone();

        // Probe raw VNC port 5900.
        if let Ok(addr) = format!("{}:5900", host).parse::<std::net::SocketAddr>() {
            match tokio::time::timeout(
                std::time::Duration::from_secs(2),
                tokio::net::TcpStream::connect(addr),
            )
            .await
            {
                Ok(Ok(_)) => {
                    let url = format!("tcp://{}:5900", host);
                    record.vnc_url = Some(url.clone());
                    info!(native_id = %record.native_id, %url, "Resolved OpenSandbox VNC endpoint");
                    return Ok(Some(DesktopEndpoint {
                        url,
                        protocol: DesktopProtocol::Vnc,
                        token: record.vnc_token.clone(),
                    }));
                }
                Ok(Err(e)) => debug!(native_id = %record.native_id, error = %e, "VNC port 5900 not reachable"),
                Err(_) => debug!(native_id = %record.native_id, "VNC port 5900 probe timed out"),
            }
        }

        // Probe noVNC HTTP port 6080.
        let novnc_url = format!("http://{}:6080", host);
        match self
            .client
            .get(&novnc_url)
            .timeout(std::time::Duration::from_secs(3))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() || resp.status().is_redirection() => {
                record.novnc_url = Some(novnc_url.clone());
                info!(native_id = %record.native_id, %novnc_url, "Resolved OpenSandbox noVNC endpoint");
                return Ok(Some(DesktopEndpoint {
                    url: novnc_url,
                    protocol: DesktopProtocol::NoVncHttp,
                    token: record.vnc_token.clone(),
                }));
            }
            Ok(resp) => debug!(native_id = %record.native_id, status = %resp.status(), "noVNC port 6080 returned non-success"),
            Err(e) => debug!(native_id = %record.native_id, error = %e, "noVNC port 6080 not reachable"),
        }

        warn!(native_id = %record.native_id, host = %host, "No desktop endpoint found for sandbox");
        Ok(None)
    }
}

#[async_trait]
impl ExecutionDriver for OpenSandboxDriver {
    fn capabilities(&self) -> DriverCapabilities {
        DriverCapabilities {
            driver_type: DriverType::Container,
            isolation: IsolationLevel::Standard,
            max_resources: ResourceSpec::high_performance(),
            supported_env_specs: vec![allternit_driver_interface::EnvSpecType::Oci],
            features: DriverFeatures {
                snapshot: false,
                live_restore: false,
                gpu: false,
                prewarm: false,
            },
        }
    }

    fn supports_desktop(&self) -> bool {
        true
    }

    async fn register_native_sandbox(
        &self,
        native_id: &str,
        agent_id: &str,
        host: &str,
    ) -> Result<(), DriverError> {
        self.register_sandbox(native_id.to_string(), agent_id.to_string(), host.to_string())
            .await;
        Ok(())
    }

    async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError> {
        let native_id = uuid::Uuid::new_v4().to_string();
        let agent_id = spec.tenant.to_string();
        let host = format!("sandbox-{}", native_id);

        let body = serde_json::json!({
            "agent_id": agent_id.clone(),
            "image": spec.env.image,
            "resources": {
                "cpu": spec.resources.cpu_millis as f64 / 1000.0,
                "memory": spec.resources.memory_mib,
            },
            "network_policy": spec.policy.network_policy,
            "env": spec.env.env_vars,
        });

        let res = self
            .client
            .post(self.api_url("/sandboxes"))
            .headers(self.auth_headers())
            .json(&body)
            .send()
            .await
            .map_err(|e| DriverError::SpawnFailed { reason: e.to_string() })?;

        if !res.status().is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(DriverError::SpawnFailed { reason: text });
        }

        let created: serde_json::Value = res.json().await.map_err(|e| DriverError::SpawnFailed {
            reason: e.to_string(),
        })?;

        let returned_id = created["id"].as_str().unwrap_or(&native_id).to_string();
        let returned_host = created["host"]
            .as_str()
            .unwrap_or(&host)
            .to_string();

        let record = SandboxRecord {
            native_id: returned_id.clone(),
            agent_id: agent_id.clone(),
            status: SandboxStatus::Creating,
            host: returned_host.clone(),
            vnc_url: None,
            novnc_url: None,
            vnc_token: None,
            created_at: chrono::Utc::now(),
        };

        self.sandboxes
            .lock()
            .await
            .insert(returned_id.clone(), record);

        let mut driver_info = HashMap::new();
        driver_info.insert("native_id".to_string(), returned_id.clone());
        driver_info.insert("agent_id".to_string(), agent_id.clone());
        driver_info.insert("host".to_string(), returned_host.clone());

        Ok(ExecutionHandle {
            id: ExecutionId::new(),
            tenant: TenantId::new(agent_id).unwrap_or(spec.tenant),
            driver_info,
            env_spec: spec.env,
        })
    }

    async fn pause_vm(&self, _handle: &ExecutionHandle) -> Result<(), DriverError> {
        // OpenSandbox pause is not implemented in v1.
        Ok(())
    }

    async fn resume_vm(&self, _handle: &ExecutionHandle) -> Result<(), DriverError> {
        Ok(())
    }

    async fn exec(&self, handle: &ExecutionHandle, cmd: CommandSpec) -> Result<ExecResult, DriverError> {
        let native_id = handle
            .driver_info
            .get("native_id")
            .ok_or_else(|| DriverError::InvalidInput {
                field: "native_id".to_string(),
                reason: "missing from driver_info".to_string(),
            })?;

        let body = serde_json::json!({
            "command": cmd.command,
            "env_vars": cmd.env_vars,
            "working_dir": cmd.working_dir,
        });

        let res = self
            .client
            .post(self.api_url(&format!("/sandboxes/{}/commands", native_id)))
            .headers(self.auth_headers())
            .json(&body)
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;

        if !res.status().is_success() {
            let text = res.text().await.unwrap_or_default();
            return Err(DriverError::InternalError { message: text });
        }

        let json: serde_json::Value = res.json().await.map_err(|e| DriverError::InternalError {
            message: e.to_string(),
        })?;

        Ok(ExecResult {
            exit_code: json["exit_code"].as_i64().unwrap_or(-1) as i32,
            stdout: json["stdout"].as_str().map(|s| s.as_bytes().to_vec()),
            stderr: json["stderr"].as_str().map(|s| s.as_bytes().to_vec()),
            duration_ms: json["duration_ms"].as_u64().unwrap_or(0),
            resource_usage: ResourceConsumption::default(),
        })
    }

    async fn stream_logs(&self, _handle: &ExecutionHandle) -> Result<Vec<LogEntry>, DriverError> {
        Ok(vec![])
    }

    async fn get_artifacts(&self, _handle: &ExecutionHandle) -> Result<Vec<Artifact>, DriverError> {
        Ok(vec![])
    }

    async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        let native_id = handle
            .driver_info
            .get("native_id")
            .ok_or_else(|| DriverError::InvalidInput {
                field: "native_id".to_string(),
                reason: "missing from driver_info".to_string(),
            })?;

        let _ = self
            .client
            .delete(self.api_url(&format!("/sandboxes/{}", native_id)))
            .headers(self.auth_headers())
            .send()
            .await;

        self.sandboxes.lock().await.remove(native_id);
        Ok(())
    }

    async fn get_consumption(
        &self,
        _handle: &ExecutionHandle,
    ) -> Result<ResourceConsumption, DriverError> {
        Ok(ResourceConsumption::default())
    }

    async fn get_receipt(&self, _handle: &ExecutionHandle) -> Result<Option<Receipt>, DriverError> {
        Ok(None)
    }

    async fn health_check(&self) -> Result<DriverHealth, DriverError> {
        let healthy = self
            .client
            .get(self.api_url("/health"))
            .send()
            .await
            .map(|r| r.status().is_success())
            .unwrap_or(false);

        Ok(DriverHealth {
            healthy,
            message: None,
            active_executions: self.sandboxes.lock().await.len() as u32,
            available_capacity: ResourceSpec::high_performance(),
        })
    }

    async fn get_desktop_endpoint(
        &self,
        handle: &ExecutionHandle,
    ) -> Result<Option<DesktopEndpoint>, DriverError> {
        let native_id = handle
            .driver_info
            .get("native_id")
            .ok_or_else(|| DriverError::InvalidInput {
                field: "native_id".to_string(),
                reason: "missing from driver_info".to_string(),
            })?;
        self.get_desktop_endpoint_by_native_id(native_id).await
    }

    async fn get_desktop_endpoint_by_native_id(
        &self,
        sandbox_id: &str,
    ) -> Result<Option<DesktopEndpoint>, DriverError> {
        // Clone out only what we need so we can drop the lock before async work.
        let mut record = {
            let mut store = self.sandboxes.lock().await;
            let record = store.get_mut(sandbox_id).ok_or_else(|| DriverError::NotFound {
                id: sandbox_id.to_string(),
            })?;
            record.clone()
        };

        let result = self.resolve_desktop_endpoint(&mut record).await;

        // Persist any cached endpoint back into the store.
        if result.is_ok() {
            let mut store = self.sandboxes.lock().await;
            if let Some(stored) = store.get_mut(&record.native_id) {
                stored.vnc_url = record.vnc_url.clone();
                stored.novnc_url = record.novnc_url.clone();
                stored.vnc_token = record.vnc_token.clone();
            }
        }

        result
    }
}
