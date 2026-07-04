//! Allternit BYOC Edge Runner
//!
//! Secure tunnel to control plane, worker management, and tool execution.
//!
//! Features:
//! - Secure tunnel to control plane
//! - Worker manager integration
//! - Heartbeat client
//! - Tool execution layer
//! - Installation scripts

use chrono::{DateTime, Utc};
use clap::Parser;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio::time::timeout;
use tracing::{error, info};
use uuid::Uuid;

/// Allternit Edge Runner configuration
#[derive(Debug, Clone, Parser)]
#[command(name = "allternit-edge-runner")]
#[command(about = "Allternit BYOC Edge Runner - Secure tunnel to control plane")]
pub struct Config {
    /// Control plane endpoint
    #[arg(long, env = "Allternit_CONTROL_PLANE_URL", default_value = "https://control.allternit.cloud")]
    pub control_plane_url: String,

    /// Node secret for authentication
    #[arg(long, env = "Allternit_NODE_SECRET")]
    pub node_secret: String,

    /// Node ID (auto-generated if not provided)
    #[arg(long, env = "Allternit_NODE_ID")]
    pub node_id: Option<String>,

    /// Node name
    #[arg(long, env = "Allternit_NODE_NAME", default_value = "edge-runner")]
    pub node_name: String,

    /// Heartbeat interval in seconds
    #[arg(long, env = "Allternit_HEARTBEAT_INTERVAL", default_value = "30")]
    pub heartbeat_interval: u64,

    /// Maximum workers
    #[arg(long, env = "Allternit_MAX_WORKERS", default_value = "10")]
    pub max_workers: u32,

    /// Region
    #[arg(long, env = "Allternit_REGION", default_value = "us-west")]
    pub region: String,

    /// Zone
    #[arg(long, env = "Allternit_ZONE")]
    pub zone: Option<String>,
}

/// Edge runner state
pub struct EdgeRunner {
    config: Config,
    node_id: String,
    client: reqwest::Client,
    workers: Arc<RwLock<HashMap<String, WorkerState>>>,
    running: Arc<RwLock<bool>>,
}

/// Worker state
#[derive(Debug, Clone)]
pub struct WorkerState {
    pub worker_id: String,
    pub status: WorkerStatus,
    pub started_at: DateTime<Utc>,
    pub task_id: Option<String>,
}

/// Worker status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum WorkerStatus {
    Idle,
    Running,
    Completed,
    Failed,
}

/// Heartbeat payload
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeartbeatPayload {
    pub node_id: String,
    pub cpu_percent: Option<f32>,
    pub memory_percent: Option<f32>,
    pub disk_percent: Option<f32>,
    pub active_workers: u32,
    pub issues: Vec<String>,
}

/// Worker task assignment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerTask {
    pub task_id: String,
    pub worker_id: String,
    pub tool_id: String,
    pub input: serde_json::Value,
    pub timeout_seconds: u64,
}

/// Tool execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolExecutionResult {
    pub task_id: String,
    pub worker_id: String,
    pub success: bool,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

impl EdgeRunner {
    /// Create new edge runner
    pub fn new(config: Config) -> Self {
        let node_id = config.node_id.clone().unwrap_or_else(|| {
            format!("edge_{}", Uuid::new_v4().simple())
        });

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            config,
            node_id,
            client,
            workers: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Start the edge runner
    pub async fn start(&self) -> Result<(), anyhow::Error> {
        info!("Starting Allternit Edge Runner");
        info!("Node ID: {}", self.node_id);
        info!("Control Plane: {}", self.config.control_plane_url);

        // Register with control plane
        self.register().await?;

        // Start heartbeat loop
        let heartbeat_interval = self.config.heartbeat_interval;
        let node_id = self.node_id.clone();
        let node_secret = self.config.node_secret.clone();
        let client = self.client.clone();
        let control_plane_url = self.config.control_plane_url.clone();
        let workers = self.workers.clone();
        let running = self.running.clone();

        {
            let mut running_guard = running.write().await;
            *running_guard = true;
        }

        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(heartbeat_interval));
            
            while *running.read().await {
                interval.tick().await;

                // Collect health metrics
                let workers_guard = workers.read().await;
                let active_workers = workers_guard.values()
                    .filter(|w| w.status == WorkerStatus::Running)
                    .count() as u32;
                drop(workers_guard);

                let payload = HeartbeatPayload {
                    node_id: node_id.clone(),
                    cpu_percent: Self::get_cpu_percent(),
                    memory_percent: Self::get_memory_percent(),
                    disk_percent: Self::get_disk_percent(),
                    active_workers,
                    issues: vec![],
                };

                // Send heartbeat
                if let Err(e) = Self::send_heartbeat(&client, &control_plane_url, &node_id, &node_secret, payload).await {
                    error!("Failed to send heartbeat: {}", e);
                }
            }
        });

        // Start worker polling loop
        self.poll_for_tasks().await?;

        Ok(())
    }

    /// Stop the edge runner
    pub async fn stop(&self) {
        info!("Stopping Allternit Edge Runner");
        let mut running = self.running.write().await;
        *running = false;
    }

    /// Register with control plane
    async fn register(&self) -> Result<(), anyhow::Error> {
        info!("Registering with control plane...");

        let payload = serde_json::json!({
            "node_id": self.node_id,
            "name": self.config.node_name,
            "node_type": "Edge",
            "capabilities": ["cpu", "memory", "tool_execution"],
            "metadata": {
                "region": self.config.region,
                "zone": self.config.zone,
                "cpu_cores": Self::get_cpu_cores(),
                "memory_mb": Self::get_memory_mb(),
            },
            "tags": ["byoc", "edge"],
        });

        let url = format!("{}/api/v1/nodes/register", self.config.control_plane_url);
        
        let response = self.client
            .post(&url)
            .header("X-Node-Secret", &self.config.node_secret)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Registration failed: {}", response.status());
        }

        info!("Successfully registered with control plane");
        Ok(())
    }

    /// Send heartbeat to control plane
    async fn send_heartbeat(
        client: &reqwest::Client,
        control_plane_url: &str,
        node_id: &str,
        node_secret: &str,
        payload: HeartbeatPayload,
    ) -> Result<(), anyhow::Error> {
        let url = format!("{}/api/v1/nodes/{}/heartbeat", control_plane_url, node_id);
        
        let response = client
            .post(&url)
            .header("X-Node-Secret", node_secret)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Heartbeat failed: {}", response.status());
        }

        Ok(())
    }

    /// Poll for tasks from control plane
    async fn poll_for_tasks(&self) -> Result<(), anyhow::Error> {
        let poll_interval = Duration::from_secs(5);
        let mut interval = tokio::time::interval(poll_interval);

        while *self.running.read().await {
            interval.tick().await;

            // Check if we have capacity for more workers
            let workers = self.workers.read().await;
            let active_count = workers.values()
                .filter(|w| w.status == WorkerStatus::Running)
                .count();
            drop(workers);

            if active_count >= self.config.max_workers as usize {
                continue;  // At capacity
            }

            // Poll for tasks
            match self.poll_task().await {
                Ok(Some(task)) => {
                    info!("Received task: {}", task.task_id);
                    self.spawn_worker(task).await;
                }
                Ok(None) => {
                    // No tasks available
                }
                Err(e) => {
                    error!("Failed to poll for tasks: {}", e);
                }
            }
        }

        Ok(())
    }

    /// Poll for a single task
    async fn poll_task(&self) -> Result<Option<WorkerTask>, anyhow::Error> {
        let url = format!("{}/api/v1/nodes/{}/tasks/poll", self.config.control_plane_url, self.node_id);
        
        let response = self.client
            .post(&url)
            .header("X-Node-Secret", &self.config.node_secret)
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::NO_CONTENT {
            return Ok(None);
        }

        if !response.status().is_success() {
            anyhow::bail!("Task poll failed: {}", response.status());
        }

        let task: WorkerTask = response.json().await?;
        Ok(Some(task))
    }

    /// Spawn a worker for a task
    async fn spawn_worker(&self, task: WorkerTask) {
        let worker_id = format!("worker_{}", Uuid::new_v4().simple());
        
        let worker_state = WorkerState {
            worker_id: worker_id.clone(),
            status: WorkerStatus::Running,
            started_at: Utc::now(),
            task_id: Some(task.task_id.clone()),
        };

        {
            let mut workers = self.workers.write().await;
            workers.insert(worker_id.clone(), worker_state);
        }

        // Execute task in background
        let client = self.client.clone();
        let control_plane_url = self.config.control_plane_url.clone();
        let node_secret = self.config.node_secret.clone();
        let workers = self.workers.clone();

        tokio::spawn(async move {
            let start_time = std::time::Instant::now();

            // Execute tool locally on the edge node
            let mut result = Self::execute_tool(&task).await;

            let execution_time_ms = start_time.elapsed().as_millis() as u64;
            result.execution_time_ms = execution_time_ms;

            // Update worker state
            {
                let mut workers_guard = workers.write().await;
                if let Some(worker) = workers_guard.get_mut(&worker_id) {
                    worker.status = if result.success {
                        WorkerStatus::Completed
                    } else {
                        WorkerStatus::Failed
                    };
                }
            }

            // Report result to control plane
            if let Err(e) = Self::report_result(&client, &control_plane_url, &node_secret, result, execution_time_ms).await {
                error!("Failed to report result: {}", e);
            }
        });
    }

    /// Execute a tool locally on the edge node.
    ///
    /// Supported tool IDs:
    /// - `shell`: runs the command in `input.command` with optional `input.args`.
    /// - `http.request`: performs an HTTP request described by `input.method`,
    ///   `input.url`, and optional `input.body`/`input.headers`.
    /// - Additional tool IDs can be registered here without delegating to the control plane.
    async fn execute_tool(task: &WorkerTask) -> ToolExecutionResult {
        let timeout_duration = Duration::from_secs(task.timeout_seconds.max(1));

        let result = timeout(timeout_duration, Self::run_tool_inner(task)).await;

        match result {
            Ok(output) => output,
            Err(_) => ToolExecutionResult {
                task_id: task.task_id.clone(),
                worker_id: task.worker_id.clone(),
                success: false,
                output: None,
                error: Some(format!("Tool execution timed out after {}s", task.timeout_seconds)),
                execution_time_ms: 0,
            },
        }
    }

    async fn run_tool_inner(task: &WorkerTask) -> ToolExecutionResult {
        match task.tool_id.as_str() {
            "shell" => Self::execute_shell_tool(task).await,
            "http.request" => Self::execute_http_tool(task).await,
            other => ToolExecutionResult {
                task_id: task.task_id.clone(),
                worker_id: task.worker_id.clone(),
                success: false,
                output: None,
                error: Some(format!("Unknown tool_id: {}", other)),
                execution_time_ms: 0,
            },
        }
    }

    async fn execute_shell_tool(task: &WorkerTask) -> ToolExecutionResult {
        let command_str = task.input.get("command").and_then(|v| v.as_str());
        let args = task
            .input
            .get("args")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let Some(command_str) = command_str else {
            return ToolExecutionResult {
                task_id: task.task_id.clone(),
                worker_id: task.worker_id.clone(),
                success: false,
                output: None,
                error: Some("shell tool requires input.command".to_string()),
                execution_time_ms: 0,
            };
        };

        let mut command = Command::new(command_str);
        command.args(&args);
        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());

        match command.output().await {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                let success = output.status.success();
                ToolExecutionResult {
                    task_id: task.task_id.clone(),
                    worker_id: task.worker_id.clone(),
                    success,
                    output: Some(serde_json::json!({
                        "exit_code": output.status.code(),
                        "stdout": stdout,
                        "stderr": stderr,
                    })),
                    error: if success { None } else { Some(stderr) },
                    execution_time_ms: 0,
                }
            }
            Err(e) => ToolExecutionResult {
                task_id: task.task_id.clone(),
                worker_id: task.worker_id.clone(),
                success: false,
                output: None,
                error: Some(format!("Failed to spawn shell command: {}", e)),
                execution_time_ms: 0,
            },
        }
    }

    async fn execute_http_tool(task: &WorkerTask) -> ToolExecutionResult {
        let method = task
            .input
            .get("method")
            .and_then(|v| v.as_str())
            .unwrap_or("GET");
        let Some(url) = task.input.get("url").and_then(|v| v.as_str()) else {
            return ToolExecutionResult {
                task_id: task.task_id.clone(),
                worker_id: task.worker_id.clone(),
                success: false,
                output: None,
                error: Some("http.request tool requires input.url".to_string()),
                execution_time_ms: 0,
            };
        };

        let client = match reqwest::Client::builder()
            .timeout(Duration::from_secs(task.timeout_seconds.max(1)))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                return ToolExecutionResult {
                    task_id: task.task_id.clone(),
                    worker_id: task.worker_id.clone(),
                    success: false,
                    output: None,
                    error: Some(format!("Failed to build HTTP client: {}", e)),
                    execution_time_ms: 0,
                }
            }
        };

        let mut request = client.request(reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET), url);

        if let Some(headers) = task.input.get("headers").and_then(|v| v.as_object()) {
            for (key, value) in headers {
                if let Some(value_str) = value.as_str() {
                    request = request.header(key, value_str);
                }
            }
        }

        if let Some(body) = task.input.get("body") {
            request = request.json(body);
        }

        match request.send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                match response.text().await {
                    Ok(text) => ToolExecutionResult {
                        task_id: task.task_id.clone(),
                        worker_id: task.worker_id.clone(),
                        success: status < 400,
                        output: Some(serde_json::json!({
                            "status": status,
                            "body": text,
                        })),
                        error: if status < 400 { None } else { Some(format!("HTTP {} error", status)) },
                        execution_time_ms: 0,
                    },
                    Err(e) => ToolExecutionResult {
                        task_id: task.task_id.clone(),
                        worker_id: task.worker_id.clone(),
                        success: false,
                        output: None,
                        error: Some(format!("Failed to read HTTP response: {}", e)),
                        execution_time_ms: 0,
                    },
                }
            }
            Err(e) => ToolExecutionResult {
                task_id: task.task_id.clone(),
                worker_id: task.worker_id.clone(),
                success: false,
                output: None,
                error: Some(format!("HTTP request failed: {}", e)),
                execution_time_ms: 0,
            },
        }
    }

    /// Report result to control plane
    async fn report_result(
        client: &reqwest::Client,
        control_plane_url: &str,
        node_secret: &str,
        result: ToolExecutionResult,
        execution_time_ms: u64,
    ) -> Result<(), anyhow::Error> {
        let url = format!("{}/api/v1/nodes/tasks/result", control_plane_url);
        
        let payload = serde_json::json!({
            "task_id": result.task_id,
            "worker_id": result.worker_id,
            "success": result.success,
            "output": result.output,
            "error": result.error,
            "execution_time_ms": execution_time_ms,
        });

        let response = client
            .post(&url)
            .header("X-Node-Secret", node_secret)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            anyhow::bail!("Result report failed: {}", response.status());
        }

        Ok(())
    }

    /// Get current CPU usage percent using sysinfo.
    fn get_cpu_percent() -> Option<f32> {
        let mut system = sysinfo::System::new_all();
        system.refresh_cpu();
        // Allow sysinfo a moment to sample CPU usage.
        std::thread::sleep(std::time::Duration::from_millis(200));
        system.refresh_cpu();
        let cpus = system.cpus();
        if cpus.is_empty() {
            return None;
        }
        let total = cpus.iter().map(|cpu| cpu.cpu_usage()).sum::<f32>();
        Some(total / cpus.len() as f32)
    }

    /// Get current memory usage percent using sysinfo.
    fn get_memory_percent() -> Option<f32> {
        let mut system = sysinfo::System::new_all();
        system.refresh_memory();
        let total = system.total_memory();
        if total == 0 {
            return None;
        }
        Some((system.used_memory() as f32 / total as f32) * 100.0)
    }

    /// Get current root disk usage percent using sysinfo.
    fn get_disk_percent() -> Option<f32> {
        let disks = sysinfo::Disks::new_with_refreshed_list();
        for disk in disks.list() {
            let total = disk.total_space();
            if total > 0 {
                let used = total.saturating_sub(disk.available_space());
                return Some((used as f32 / total as f32) * 100.0);
            }
        }
        None
    }

    /// Get CPU core count using sysinfo.
    fn get_cpu_cores() -> Option<f32> {
        Some(sysinfo::System::new_all().cpus().len() as f32)
    }

    /// Get total memory in megabytes using sysinfo.
    fn get_memory_mb() -> Option<u64> {
        Some(sysinfo::System::new_all().total_memory() / 1024)
    }

    /// Compute node fingerprint
    pub fn compute_fingerprint(node_id: &str, secret: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(node_id.as_bytes());
        hasher.update(secret.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    tracing_subscriber::fmt::init();

    let config = Config::parse();
    let runner = EdgeRunner::new(config);

    // Handle shutdown signals
    let runner_arc = Arc::new(runner);
    
    tokio::select! {
        result = runner_arc.start() => {
            if let Err(e) = result {
                error!("Edge runner failed: {}", e);
                return Err(e);
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received shutdown signal");
            runner_arc.stop().await;
        }
    }

    Ok(())
}
