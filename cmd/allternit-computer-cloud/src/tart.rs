//! Tart (Apple Virtualization.framework) driver for the Allternit control plane.
//!
//! This driver talks to one or more `allternit-tart-host` wrappers that shell out
//! to the Tart CLI on Apple Silicon hosts. It implements the same
//! `ExecutionDriver` trait as the Incus driver so the platform can treat macOS
//! desktops identically, and it can load-balance across multiple Mac hosts.

use crate::mesh::MeshConfig;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::json;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;
use tracing::{info, warn};

use allternit_driver_interface::{
    Artifact, CommandSpec, DesktopEndpoint, DesktopProtocol, DriverCapabilities, DriverError,
    DriverFeatures, DriverHealth, DriverType, EnvSpecType, ExecResult, ExecutionDriver,
    ExecutionHandle, ExecutionId, IsolationLevel, LogEntry, Receipt, ResourceConsumption,
    ResourceSpec, SpawnSpec,
};

const DEFAULT_TART_HOST_URL: &str = "http://127.0.0.1:8020";
const HOST_URL_KEY: &str = "tart_host_url";
const VNC_HOST_KEY: &str = "host";

#[derive(Clone, Debug)]
struct TartHost {
    url: String,
    vnc_host: String,
}

#[derive(Debug)]
pub struct TartDriver {
    client: reqwest::Client,
    hosts: Vec<TartHost>,
    token: Option<String>,
    next_host: AtomicUsize,
    mesh: Option<MeshConfig>,
}

impl Clone for TartDriver {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
            hosts: self.hosts.clone(),
            token: self.token.clone(),
            next_host: AtomicUsize::new(self.next_host.load(Ordering::Relaxed)),
            mesh: self.mesh.clone(),
        }
    }
}

impl TartDriver {
    pub fn new(host_url: impl Into<String>, vnc_host: impl Into<String>) -> Self {
        Self::from_hosts(
            vec![TartHost {
                url: host_url.into(),
                vnc_host: vnc_host.into(),
            }],
            None,
        )
    }

    pub fn from_urls(urls: &[String], fallback_vnc_host: impl Into<String>) -> Result<Self, DriverError> {
        if urls.is_empty() {
            return Err(DriverError::InvalidInput {
                field: "urls".to_string(),
                reason: "at least one Tart host URL is required".to_string(),
            });
        }
        let fallback = fallback_vnc_host.into();
        let hosts: Vec<TartHost> = urls
            .iter()
            .map(|url| TartHost {
                vnc_host: derive_vnc_host(url).unwrap_or_else(|| fallback.clone()),
                url: url.clone(),
            })
            .collect();
        Ok(Self::from_hosts(hosts, std::env::var("TART_HOST_TOKEN").ok()))
    }

    pub fn from_env() -> Result<Self, DriverError> {
        let urls: Vec<String> = std::env::var("TART_HOST_URLS")
            .ok()
            .filter(|s| !s.is_empty())
            .map(|s| s.split(',').map(|u| u.trim().to_string()).collect())
            .or_else(|| std::env::var("TART_HOST_URL").ok().map(|u| vec![u]))
            .unwrap_or_else(|| vec![DEFAULT_TART_HOST_URL.to_string()]);

        let fallback_vnc_host = std::env::var("TART_VNC_HOST").unwrap_or_else(|_| "localhost".to_string());
        let token = std::env::var("TART_HOST_TOKEN").ok();
        let mut driver = Self::from_urls(&urls, fallback_vnc_host)?;
        driver.token = token;
        Ok(driver)
    }

    pub fn with_mesh(mut self, mesh: MeshConfig) -> Self {
        self.mesh = Some(mesh);
        self
    }

    fn from_hosts(hosts: Vec<TartHost>, token: Option<String>) -> Self {
        Self {
            client: reqwest::Client::new(),
            hosts,
            token,
            next_host: AtomicUsize::new(0),
            mesh: None,
        }
    }

    fn request(&self, method: reqwest::Method, host: &TartHost, path: &str) -> reqwest::RequestBuilder {
        let mut builder = self.client.request(method, format!("{}{}", host.url, path));
        if let Some(token) = &self.token {
            builder = builder.header("Authorization", format!("Bearer {}", token));
        }
        builder
    }

    fn host_for_spawn(&self) -> TartHost {
        let idx = self.next_host.fetch_add(1, Ordering::Relaxed) % self.hosts.len().max(1);
        self.hosts[idx].clone()
    }

    fn host_for_handle(&self, handle: &ExecutionHandle) -> Result<TartHost, DriverError> {
        let url = handle
            .driver_info
            .get(HOST_URL_KEY)
            .cloned()
            .unwrap_or_else(|| self.hosts[0].url.clone());
        let vnc_host = handle
            .driver_info
            .get(VNC_HOST_KEY)
            .cloned()
            .unwrap_or_else(|| derive_vnc_host(&url).unwrap_or_else(|| "localhost".to_string()));
        Ok(TartHost { url, vnc_host })
    }

    fn vm_name(&self, handle: &ExecutionHandle) -> String {
        handle
            .driver_info
            .get("native_id")
            .cloned()
            .unwrap_or_else(|| handle.id.to_string())
    }

    /// Poll the Tart host wrapper until the VM reports `running`.
    async fn wait_for_running_state(&self, host: &TartHost, name: &str) -> Result<(), DriverError> {
        for attempt in 0..120 {
            match self.vm_status(host, name).await {
                Ok(info) if info.status == "running" => {
                    info!(vm = %name, attempt, "Tart VM reached running");
                    return Ok(());
                }
                Ok(_) => {}
                Err(e) => {
                    warn!(vm = %name, attempt, error = %e, "waiting for Tart VM state");
                }
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        Err(DriverError::InternalError {
            message: format!("Tart VM {} did not reach running in time", name),
        })
    }

    async fn vm_status(&self, host: &TartHost, name: &str) -> Result<VmInfo, DriverError> {
        let resp = self
            .request(reqwest::Method::GET, host, &format!("/v1/vms/{}", name))
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if !resp.status().is_success() {
            return Err(DriverError::InternalError {
                message: resp.text().await.unwrap_or_default(),
            });
        }
        resp.json::<VmInfo>().await.map_err(|e| DriverError::InternalError {
            message: e.to_string(),
        })
    }
}

#[async_trait]
impl ExecutionDriver for TartDriver {
    fn capabilities(&self) -> DriverCapabilities {
        DriverCapabilities {
            driver_type: DriverType::MicroVM,
            isolation: IsolationLevel::Maximum,
            max_resources: ResourceSpec {
                cpu_millis: 8000,
                memory_mib: 32768,
                disk_mib: None,
                network_egress_kib: None,
                gpu_count: None,
            },
            supported_env_specs: vec![EnvSpecType::Oci],
            features: DriverFeatures {
                snapshot: false,
                live_restore: false,
                gpu: false,
                prewarm: false,
            },
        }
    }

    async fn spawn(&self, spec: SpawnSpec) -> Result<ExecutionHandle, DriverError> {
        let host = self.host_for_spawn();
        let name = format!("allternit-bot-{}", uuid::Uuid::new_v4().simple());
        let image = match spec.env.spec_type {
            EnvSpecType::Oci => spec.env.image.clone(),
            _ => "macos-base".to_string(),
        };

        let create_body = json!({
            "image": image,
            "cpu": spec.resources.cpu_millis / 1000,
            "memory_mb": spec.resources.memory_mib,
        });

        let resp = self
            .request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/create", name))
            .json(&create_body)
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(DriverError::InternalError { message: text });
        }

        let start_resp = self
            .request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/start", name))
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if !start_resp.status().is_success() {
            warn!(vm = %name, "Failed to start Tart VM immediately; it may need manual start");
        }

        // Wait until the wrapper can see the VM as running. Unlike Incus, Tart
        // `run --no-graphics` returns immediately after launching the process, so
        // we poll the wrapper's status endpoint until the guest has booted.
        self.wait_for_running_state(&host, &name).await?;

        info!(vm = %name, image, host = %host.url, "Spawned Tart macOS VM");

        let mut driver_info = HashMap::new();
        driver_info.insert("native_id".to_string(), name.clone());
        driver_info.insert(HOST_URL_KEY.to_string(), host.url.clone());
        driver_info.insert(VNC_HOST_KEY.to_string(), host.vnc_host.clone());
        driver_info.insert("provider".to_string(), "tart".to_string());

        Ok(ExecutionHandle {
            id: ExecutionId::new(),
            tenant: spec.tenant,
            driver_info,
            env_spec: spec.env,
        })
    }

    async fn pause_vm(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        let host = self.host_for_handle(handle)?;
        let name = self.vm_name(handle);
        self.request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/stop", name))
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        Ok(())
    }

    async fn resume_vm(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        let host = self.host_for_handle(handle)?;
        let name = self.vm_name(handle);
        self.request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/start", name))
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        Ok(())
    }

    async fn destroy(&self, handle: &ExecutionHandle) -> Result<(), DriverError> {
        let host = self.host_for_handle(handle)?;
        let name = self.vm_name(handle);
        let resp = self
            .request(reqwest::Method::DELETE, &host, &format!("/v1/vms/{}", name))
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if resp.status().is_success() || resp.status() == reqwest::StatusCode::NOT_FOUND {
            Ok(())
        } else {
            Err(DriverError::InternalError {
                message: resp.text().await.unwrap_or_default(),
            })
        }
    }

    async fn exec(&self, handle: &ExecutionHandle, cmd: CommandSpec) -> Result<ExecResult, DriverError> {
        let host = self.host_for_handle(handle)?;
        let name = self.vm_name(handle);
        let body = json!({
            "command": cmd.command,
            "env": cmd.env_vars,
        });
        let resp = self
            .request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/exec", name))
            .json(&body)
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if !resp.status().is_success() {
            return Err(DriverError::InternalError {
                message: resp.text().await.unwrap_or_default(),
            });
        }
        let result: ExecResponse = resp.json().await.map_err(|e| DriverError::InternalError {
            message: e.to_string(),
        })?;
        Ok(ExecResult {
            exit_code: result.exit_code,
            stdout: Some(result.stdout.into_bytes()),
            stderr: Some(result.stderr.into_bytes()),
            duration_ms: 0,
            resource_usage: ResourceConsumption::default(),
        })
    }

    async fn stream_logs(&self, _handle: &ExecutionHandle) -> Result<Vec<LogEntry>, DriverError> {
        Ok(vec![])
    }

    async fn get_artifacts(&self, _handle: &ExecutionHandle) -> Result<Vec<Artifact>, DriverError> {
        Ok(vec![])
    }

    async fn get_consumption(&self, _handle: &ExecutionHandle) -> Result<ResourceConsumption, DriverError> {
        Ok(ResourceConsumption::default())
    }

    async fn get_receipt(&self, _handle: &ExecutionHandle) -> Result<Option<Receipt>, DriverError> {
        Ok(None)
    }

    async fn health_check(&self) -> Result<DriverHealth, DriverError> {
        let mut healthy = false;
        let mut errors = Vec::new();
        for host in &self.hosts {
            match self
                .request(reqwest::Method::GET, host, "/health")
                .send()
                .await
            {
                Ok(resp) if resp.status().is_success() => {
                    healthy = true;
                }
                Ok(resp) => errors.push(format!("{} returned {}", host.url, resp.status())),
                Err(e) => errors.push(format!("{} unreachable: {}", host.url, e)),
            }
        }
        Ok(DriverHealth {
            healthy,
            message: if errors.is_empty() {
                None
            } else {
                Some(errors.join("; "))
            },
            active_executions: 0,
            available_capacity: ResourceSpec::default(),
            capabilities: vec!["macos".to_string()],
        })
    }

    async fn get_desktop_endpoint(
        &self,
        handle: &ExecutionHandle,
    ) -> Result<Option<DesktopEndpoint>, DriverError> {
        self.get_desktop_endpoint_by_native_id(&self.vm_name(handle)).await
    }

    async fn get_desktop_endpoint_by_native_id(
        &self,
        native_id: &str,
    ) -> Result<Option<DesktopEndpoint>, DriverError> {
        for host in &self.hosts {
            let resp = self
                .request(reqwest::Method::GET, host, &format!("/v1/vms/{}", native_id))
                .send()
                .await;
            match resp {
                Ok(resp) if resp.status().is_success() => {
                    let info: VmInfo = resp.json().await.map_err(|e| DriverError::InternalError {
                        message: e.to_string(),
                    })?;
                    if info.status == "running" {
                        return Ok(Some(DesktopEndpoint {
                            url: format!("tcp://{}:5900", host.vnc_host),
                            protocol: DesktopProtocol::Vnc,
                            token: None,
                        }));
                    }
                }
                Ok(_) => {}
                Err(_) => {}
            }
        }
        Ok(None)
    }

    fn supports_desktop(&self) -> bool {
        true
    }

    async fn register_native_sandbox(
        &self,
        native_id: &str,
        _agent_id: &str,
        host: &str,
    ) -> Result<(), DriverError> {
        // No in-memory registry needed; the wrapper is the source of truth.
        info!(native_id, host, "Registered Tart native sandbox");
        Ok(())
    }

    async fn pull_file(&self, handle: &ExecutionHandle, path: &str) -> Result<Vec<u8>, DriverError> {
        let host = self.host_for_handle(handle)?;
        let name = self.vm_name(handle);
        let resp = self
            .request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/files/pull", name))
            .json(&json!({"path": path}))
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if !resp.status().is_success() {
            return Err(DriverError::InternalError {
                message: resp.text().await.unwrap_or_default(),
            });
        }
        resp.bytes()
            .await
            .map(|b| b.to_vec())
            .map_err(|e| DriverError::InternalError { message: e.to_string() })
    }

    async fn push_file(&self, handle: &ExecutionHandle, path: &str, content: Vec<u8>) -> Result<(), DriverError> {
        let host = self.host_for_handle(handle)?;
        let name = self.vm_name(handle);
        let body = json!({
            "path": path,
            "content_base64": BASE64.encode(&content),
        });
        let resp = self
            .request(reqwest::Method::POST, &host, &format!("/v1/vms/{}/files/push", name))
            .json(&body)
            .send()
            .await
            .map_err(|e| DriverError::InternalError { message: e.to_string() })?;
        if !resp.status().is_success() {
            return Err(DriverError::InternalError {
                message: resp.text().await.unwrap_or_default(),
            });
        }
        Ok(())
    }
}

fn derive_vnc_host(url: &str) -> Option<String> {
    url.trim_start_matches("http://")
        .trim_start_matches("https://")
        .split(':')
        .next()
        .map(|s| s.to_string())
}

#[derive(Debug, Deserialize)]
struct ExecResponse {
    exit_code: i32,
    stdout: String,
    stderr: String,
}

#[derive(Debug, Deserialize)]
struct VmInfo {
    status: String,
}
