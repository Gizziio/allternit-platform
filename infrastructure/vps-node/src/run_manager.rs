//! Run Manager - Run lifecycle management for Allternit Node
//!
//! Handles run execution on the node, bridging between the control plane
//! and local container/VM execution.

use anyhow::{Context, Result};
use allternit_protocol::{Message, MessagePayload, RunConfig, RunStatus, RunEvent, RunEventType, JobResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{debug, error, info, warn};

use crate::NodeState;
use crate::docker::DockerRuntime;
use crate::executor::JobExecutor;

/// Run state tracked by the node
#[derive(Debug, Clone)]
pub struct RunState {
    /// Run ID
    pub run_id: String,
    /// Associated job ID (if any)
    pub job_id: Option<String>,
    /// Current status
    pub status: RunStatus,
    /// Container ID (if running in container)
    pub container_id: Option<String>,
    /// Process ID (if running as process)
    pub pid: Option<u32>,
    /// Start time
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Completion time
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    /// Exit code
    pub exit_code: Option<i32>,
    /// Output buffer (last N lines)
    pub output_buffer: Vec<String>,
    /// Environment variables
    pub env: HashMap<String, String>,
    /// Working directory
    pub working_dir: String,
    /// Attached clients
    pub attached_clients: Vec<String>,
}

/// Run manager - manages run lifecycle on the node
pub struct RunManager {
    /// Node state
    state: Arc<NodeState>,
    /// Docker runtime
    docker: Arc<RwLock<DockerRuntime>>,
    /// Job executor
    executor: Arc<JobExecutor>,
    /// Active runs
    runs: Arc<RwLock<HashMap<String, RunState>>>,
    /// Event sender
    event_tx: mpsc::Sender<Message>,
}

impl RunManager {
    /// Create a new run manager
    pub fn new(
        state: Arc<NodeState>,
        docker: Arc<RwLock<DockerRuntime>>,
        executor: Arc<JobExecutor>,
        event_tx: mpsc::Sender<Message>,
    ) -> Self {
        Self {
            state,
            docker,
            executor,
            runs: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
        }
    }
    
    /// Start a new run
    pub async fn start_run(&self, run_id: String, config: RunConfig) -> Result<()> {
        info!("🏃 Starting run: {}", run_id);
        
        // Create run state
        let run_state = RunState {
            run_id: run_id.clone(),
            job_id: config.job_id.clone(),
            status: RunStatus::Starting,
            container_id: None,
            pid: None,
            started_at: Some(chrono::Utc::now()),
            completed_at: None,
            exit_code: None,
            output_buffer: Vec::new(),
            env: config.env.clone(),
            working_dir: config.working_dir.clone(),
            attached_clients: Vec::new(),
        };
        
        // Store run state
        {
            let mut runs = self.runs.write().await;
            runs.insert(run_id.clone(), run_state.clone());
        }
        
        // Send run started event
        let started_event = Message::new(MessagePayload::RunEvent {
            run_id: run_id.clone(),
            event: RunEvent {
                event_type: RunEventType::Started,
                timestamp: chrono::Utc::now(),
                data: serde_json::json!({
                    "node_id": self.state.config.read().await.node_id.clone(),
                }),
            },
        });
        let _ = self.event_tx.send(started_event).await;
        
        // Spawn run execution
        let runs = self.runs.clone();
        let event_tx = self.event_tx.clone();
        let docker = self.docker.clone();
        let executor = self.executor.clone();
        let node_id = self.state.config.read().await.node_id.clone();
        
        tokio::spawn(async move {
            match execute_run(&run_id, &config, &docker, &executor, &event_tx, &node_id).await {
                Ok(exit_code) => {
                    info!("✅ Run completed: {} (exit_code={})", run_id, exit_code);
                    
                    // Update run state
                    let mut runs = runs.write().await;
                    if let Some(run) = runs.get_mut(&run_id) {
                        run.status = RunStatus::Completed;
                        run.exit_code = Some(exit_code);
                        run.completed_at = Some(chrono::Utc::now());
                    }
                    
                    // Send completion event
                    let completed_event = Message::new(MessagePayload::RunEvent {
                        run_id: run_id.clone(),
                        event: RunEvent {
                            event_type: RunEventType::Completed,
                            timestamp: chrono::Utc::now(),
                            data: serde_json::json!({
                                "exit_code": exit_code,
                            }),
                        },
                    });
                    let _ = event_tx.send(completed_event).await;
                }
                Err(e) => {
                    error!("❌ Run failed: {} - {}", run_id, e);
                    
                    // Update run state
                    let mut runs = runs.write().await;
                    if let Some(run) = runs.get_mut(&run_id) {
                        run.status = RunStatus::Failed;
                        run.completed_at = Some(chrono::Utc::now());
                    }
                    
                    // Send failure event
                    let failed_event = Message::new(MessagePayload::RunEvent {
                        run_id: run_id.clone(),
                        event: RunEvent {
                            event_type: RunEventType::Failed,
                            timestamp: chrono::Utc::now(),
                            data: serde_json::json!({
                                "error": e.to_string(),
                            }),
                        },
                    });
                    let _ = event_tx.send(failed_event).await;
                }
            }
        });
        
        Ok(())
    }
    
    /// Stop a run
    pub async fn stop_run(&self, run_id: &str) -> Result<()> {
        info!("⏹️ Stopping run: {}", run_id);
        
        // Get run state
        let run = {
            let runs = self.runs.read().await;
            runs.get(run_id).cloned()
        };
        
        if let Some(run) = run {
            // Stop container if running in container
            if let Some(container_id) = &run.container_id {
                let docker = self.docker.read().await;
                if let Err(e) = docker.stop_container(container_id, 30).await {
                    warn!("Failed to stop container {}: {}", container_id, e);
                }
            }
            
            // Update run state
            {
                let mut runs = self.runs.write().await;
                if let Some(run) = runs.get_mut(run_id) {
                    run.status = RunStatus::Cancelled;
                    run.completed_at = Some(chrono::Utc::now());
                }
            }
            
            // Send cancelled event
            let cancelled_event = Message::new(MessagePayload::RunEvent {
                run_id: run_id.to_string(),
                event: RunEvent {
                    event_type: RunEventType::Cancelled,
                    timestamp: chrono::Utc::now(),
                    data: serde_json::json!({}),
                },
            });
            let _ = self.event_tx.send(cancelled_event).await;
        }
        
        Ok(())
    }
    
    /// Get run status
    pub async fn get_run_status(&self, run_id: &str) -> Option<RunState> {
        let runs = self.runs.read().await;
        runs.get(run_id).cloned()
    }
    
    /// List all active runs
    pub async fn list_runs(&self) -> Vec<RunState> {
        let runs = self.runs.read().await;
        runs.values().cloned().collect()
    }
    
    /// Attach client to run
    pub async fn attach_client(&self, run_id: &str, client_id: &str) -> Result<()> {
        let mut runs = self.runs.write().await;
        
        if let Some(run) = runs.get_mut(run_id) {
            if !run.attached_clients.contains(&client_id.to_string()) {
                run.attached_clients.push(client_id.to_string());
                info!("👁️ Client {} attached to run {}", client_id, run_id);
            }
        }
        
        Ok(())
    }
    
    /// Detach client from run
    pub async fn detach_client(&self, run_id: &str, client_id: &str) -> Result<()> {
        let mut runs = self.runs.write().await;
        
        if let Some(run) = runs.get_mut(run_id) {
            run.attached_clients.retain(|id| id != client_id);
            info!("👁️ Client {} detached from run {}", client_id, run_id);
        }
        
        Ok(())
    }
    
    /// Send output to attached clients
    pub async fn broadcast_output(&self, run_id: &str, output: &str) -> Result<()> {
        let runs = self.runs.read().await;
        
        if let Some(run) = runs.get(run_id) {
            if !run.attached_clients.is_empty() {
                let output_event = Message::new(MessagePayload::RunEvent {
                    run_id: run_id.to_string(),
                    event: RunEvent {
                        event_type: RunEventType::Output,
                        timestamp: chrono::Utc::now(),
                        data: serde_json::json!({
                            "output": output,
                        }),
                    },
                });
                let _ = self.event_tx.send(output_event).await;
            }
        }
        
        Ok(())
    }
    
    /// Clean up completed runs
    pub async fn cleanup_completed(&self, max_age: std::time::Duration) -> usize {
        let mut runs = self.runs.write().await;
        let now = chrono::Utc::now();
        
        let to_remove: Vec<String> = runs
            .iter()
            .filter(|(_, run)| {
                if let Some(completed_at) = run.completed_at {
                    let age = now.signed_duration_since(completed_at);
                    age.num_seconds() > max_age.as_secs() as i64
                } else {
                    false
                }
            })
            .map(|(id, _)| id.clone())
            .collect();
        
        for id in &to_remove {
            runs.remove(id);
        }
        
        to_remove.len()
    }
}

/// Execute a run
async fn execute_run(
    run_id: &str,
    config: &RunConfig,
    _docker: &Arc<RwLock<DockerRuntime>>,
    executor: &Arc<JobExecutor>,
    event_tx: &mpsc::Sender<Message>,
    node_id: &str,
) -> Result<i32> {
    info!("🚀 Executing run {} on node {}", run_id, node_id);
    
    // Update status to running
    let running_event = Message::new(MessagePayload::RunEvent {
        run_id: run_id.to_string(),
        event: RunEvent {
            event_type: RunEventType::StatusChange,
            timestamp: chrono::Utc::now(),
            data: serde_json::json!({
                "status": "running",
            }),
        },
    });
    let _ = event_tx.send(running_event).await;
    
    // Convert RunConfig to JobSpec for executor
    let job = allternit_protocol::JobSpec {
        id: run_id.to_string(),
        name: config.name.clone(),
        wih: allternit_protocol::WIHDefinition {
            handler: "docker".to_string(),
            version: "1.0".to_string(),
            task: allternit_protocol::TaskDefinition::Docker {
                image: config.image.clone(),
                command: config.command.clone(),
                volumes: vec![],
            },
            tools: vec![],
        },
        resources: config.resources.clone(),
        env: config.env.clone(),
        priority: 0,
        timeout_secs: config.timeout_secs,
    };
    
    // Execute via job executor
    match executor.execute(&job).await {
        Ok(result) => {
            // Send output events
            if !result.stdout.is_empty() {
                let output_event = Message::new(MessagePayload::RunEvent {
                    run_id: run_id.to_string(),
                    event: RunEvent {
                        event_type: RunEventType::Output,
                        timestamp: chrono::Utc::now(),
                        data: serde_json::json!({
                            "stream": "stdout",
                            "content": result.stdout,
                        }),
                    },
                });
                let _ = event_tx.send(output_event).await;
            }
            
            if !result.stderr.is_empty() {
                let output_event = Message::new(MessagePayload::RunEvent {
                    run_id: run_id.to_string(),
                    event: RunEvent {
                        event_type: RunEventType::Output,
                        timestamp: chrono::Utc::now(),
                        data: serde_json::json!({
                            "stream": "stderr",
                            "content": result.stderr,
                        }),
                    },
                });
                let _ = event_tx.send(output_event).await;
            }
            
            Ok(result.exit_code)
        }
        Err(e) => {
            Err(anyhow::anyhow!("Job execution failed: {}", e))
        }
    }
}

/// Run cleanup task - periodically removes old completed runs
pub async fn run_cleanup_task(run_manager: Arc<RunManager>, interval: std::time::Duration) {
    let mut cleanup_interval = tokio::time::interval(interval);
    
    loop {
        cleanup_interval.tick().await;
        
        // Clean up runs older than 1 hour
        let cleaned = run_manager.cleanup_completed(std::time::Duration::from_secs(3600)).await;
        if cleaned > 0 {
            debug!("🧹 Cleaned up {} completed runs", cleaned);
        }
    }
}
