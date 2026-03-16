//! Job executor
//!
//! Executes WIH (Work Item Handler) jobs in containers.

use a2r_protocol::{Artifact, JobResult, JobSpec, TaskDefinition};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tokio::time::{timeout, Duration};
use tracing::{debug, error, info, warn};

use crate::docker::{ContainerConfig, ContainerResult, DockerRuntime, LogLine};

/// Job executor manages running jobs
pub struct JobExecutor {
    docker: Arc<RwLock<DockerRuntime>>,
    running_jobs: Arc<RwLock<HashMap<String, JobHandle>>>,
    max_concurrent: usize,
}

/// Handle to a running job
struct JobHandle {
    job_id: String,
    cancel_tx: mpsc::Sender<()>,
}

/// Log line from job execution
#[derive(Debug, Clone)]
pub struct JobLogLine {
    pub job_id: String,
    pub is_stderr: bool,
    pub content: String,
}

impl JobExecutor {
    pub fn new(docker: Arc<RwLock<DockerRuntime>>, max_concurrent: usize) -> Self {
        Self {
            docker,
            running_jobs: Arc::new(RwLock::new(HashMap::new())),
            max_concurrent,
        }
    }
    
    /// Execute a job with streaming logs
    pub async fn execute_streaming(
        &self,
        job: &JobSpec,
        log_tx: mpsc::Sender<JobLogLine>,
    ) -> anyhow::Result<JobResult> {
        info!("Executing job: {} ({})", job.id, job.name);
        
        // Check if we can run more jobs
        {
            let running = self.running_jobs.read().await;
            if running.len() >= self.max_concurrent {
                anyhow::bail!("Max concurrent jobs reached");
            }
        }
        
        // Create cancellation channel
        let (cancel_tx, mut cancel_rx) = mpsc::channel(1);
        
        // Register job
        {
            let mut running = self.running_jobs.write().await;
            running.insert(job.id.clone(), JobHandle {
                job_id: job.id.clone(),
                cancel_tx,
            });
        }
        
        // Execute based on task type
        let result = match &job.wih.task {
            TaskDefinition::Docker { image, command, volumes: _ } => {
                self.execute_docker_job(job, image, command, log_tx, &mut cancel_rx).await
            }
            TaskDefinition::Shell { command, working_dir } => {
                self.execute_shell_job(job, command, working_dir.as_deref(), log_tx, &mut cancel_rx).await
            }
            TaskDefinition::Codex { .. } => {
                warn!("Codex jobs not yet implemented");
                Ok(JobResult {
                    success: false,
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: "Codex jobs not yet implemented".to_string(),
                    artifacts: vec![],
                })
            }
            TaskDefinition::Custom { handler, .. } => {
                warn!("Custom handler '{}' not supported", handler);
                Ok(JobResult {
                    success: false,
                    exit_code: -1,
                    stdout: String::new(),
                    stderr: format!("Custom handler '{}' not supported", handler),
                    artifacts: vec![],
                })
            }
        };
        
        // Unregister job
        {
            let mut running = self.running_jobs.write().await;
            running.remove(&job.id);
        }
        
        result
    }
    
    /// Execute a job and return result (non-streaming)
    pub async fn execute(&self, job: &JobSpec) -> anyhow::Result<JobResult> {
        let (log_tx, _log_rx) = mpsc::channel(100);
        self.execute_streaming(job, log_tx).await
    }
    
    /// Execute a Docker-based job
    async fn execute_docker_job(
        &self,
        job: &JobSpec,
        image: &str,
        command: &[String],
        log_tx: mpsc::Sender<JobLogLine>,
        cancel_rx: &mut mpsc::Receiver<()>,
    ) -> anyhow::Result<JobResult> {
        let docker = self.docker.read().await;
        
        // Build container config
        let config = ContainerConfig {
            image: image.to_string(),
            command: command.to_vec(),
            env: job.env.clone(),
            cpu_limit: Some(job.resources.cpu_cores),
            memory_limit: Some((job.resources.memory_gb * 1024.0 * 1024.0 * 1024.0) as u64),
            timeout_secs: Some(job.timeout_secs),
            labels: [
                ("a2r.job_id".to_string(), job.id.clone()),
                ("a2r.job_name".to_string(), job.name.clone()),
            ].into_iter().collect(),
            ..Default::default()
        };
        
        let job_id = job.id.clone();
        let (docker_log_tx, mut docker_log_rx) = mpsc::channel::<LogLine>(100);
        
        // Spawn log forwarding task
        let log_forward_task = tokio::spawn(async move {
            while let Some(log) = docker_log_rx.recv().await {
                let _ = log_tx.send(JobLogLine {
                    job_id: job_id.clone(),
                    is_stderr: log.is_stderr,
                    content: log.content,
                }).await;
            }
        });
        
        // Run container with timeout
        let timeout_duration = Duration::from_secs(job.timeout_secs);
        
        let result = tokio::select! {
            res = timeout(timeout_duration, docker.run_container_streaming(&job.id, config, docker_log_tx)) => {
                match res {
                    Ok(Ok(result)) => Ok(result),
                    Ok(Err(e)) => Err(e),
                    Err(_) => {
                        warn!("Job {} timed out", job.id);
                        Ok(ContainerResult {
                            container_id: String::new(),
                            exit_code: 124,
                            stdout: String::new(),
                            stderr: format!("Job timed out after {} seconds", job.timeout_secs),
                        })
                    }
                }
            }
            _ = cancel_rx.recv() => {
                info!("Job {} cancelled", job.id);
                Ok(ContainerResult {
                    container_id: String::new(),
                    exit_code: 130,
                    stdout: String::new(),
                    stderr: "Job cancelled by user".to_string(),
                })
            }
        };
        
        log_forward_task.abort();
        
        let container_result = result?;
        
        Ok(JobResult {
            success: container_result.exit_code == 0,
            exit_code: container_result.exit_code as i32,
            stdout: container_result.stdout,
            stderr: container_result.stderr,
            artifacts: vec![],
        })
    }
    
    /// Execute a shell command job (runs in Alpine container)
    async fn execute_shell_job(
        &self,
        job: &JobSpec,
        command: &str,
        working_dir: Option<&str>,
        log_tx: mpsc::Sender<JobLogLine>,
        cancel_rx: &mut mpsc::Receiver<()>,
    ) -> anyhow::Result<JobResult> {
        let config = ContainerConfig {
            image: "alpine:latest".to_string(),
            command: vec!["sh".to_string(), "-c".to_string(), command.to_string()],
            env: job.env.clone(),
            working_dir: working_dir.map(|s| s.to_string()),
            cpu_limit: Some(job.resources.cpu_cores),
            memory_limit: Some((job.resources.memory_gb * 1024.0 * 1024.0 * 1024.0) as u64),
            timeout_secs: Some(job.timeout_secs),
            labels: [
                ("a2r.job_id".to_string(), job.id.clone()),
                ("a2r.job_name".to_string(), job.name.clone()),
                ("a2r.task_type".to_string(), "shell".to_string()),
            ].into_iter().collect(),
            ..Default::default()
        };
        
        let docker = self.docker.read().await;
        let job_id = job.id.clone();
        let (docker_log_tx, mut docker_log_rx) = mpsc::channel::<LogLine>(100);
        
        // Spawn log forwarding
        let log_forward_task = tokio::spawn(async move {
            while let Some(log) = docker_log_rx.recv().await {
                let _ = log_tx.send(JobLogLine {
                    job_id: job_id.clone(),
                    is_stderr: log.is_stderr,
                    content: log.content,
                }).await;
            }
        });
        
        // Run with timeout
        let timeout_duration = Duration::from_secs(job.timeout_secs);
        let result = tokio::select! {
            res = timeout(timeout_duration, docker.run_container_streaming(&job.id, config, docker_log_tx)) => {
                match res {
                    Ok(Ok(r)) => Ok(r),
                    Ok(Err(e)) => Err(e),
                    Err(_) => Ok(ContainerResult {
                        container_id: String::new(),
                        exit_code: 124,
                        stdout: String::new(),
                        stderr: format!("Job timed out after {} seconds", job.timeout_secs),
                    })
                }
            }
            _ = cancel_rx.recv() => {
                Ok(ContainerResult {
                    container_id: String::new(),
                    exit_code: 130,
                    stdout: String::new(),
                    stderr: "Job cancelled".to_string(),
                })
            }
        };
        
        log_forward_task.abort();
        let container_result = result?;
        
        Ok(JobResult {
            success: container_result.exit_code == 0,
            exit_code: container_result.exit_code as i32,
            stdout: container_result.stdout,
            stderr: container_result.stderr,
            artifacts: vec![],
        })
    }
    
    /// Cancel a running job
    pub async fn cancel(&self, job_id: &str) -> anyhow::Result<()> {
        let handle = {
            let running = self.running_jobs.read().await;
            running.get(job_id).map(|h| h.cancel_tx.clone())
        };
        
        if let Some(tx) = handle {
            let _ = tx.send(()).await;
            info!("Cancelled job: {}", job_id);
            Ok(())
        } else {
            anyhow::bail!("Job {} not found or not running", job_id)
        }
    }
    
    /// Number of running jobs
    pub async fn running_count(&self) -> usize {
        let running = self.running_jobs.read().await;
        running.len()
    }
    
    /// List running job IDs
    pub async fn running_jobs(&self) -> Vec<String> {
        let running = self.running_jobs.read().await;
        running.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_executor_creation() {
        let docker = Arc::new(RwLock::new(DockerRuntime::new()));
        let executor = JobExecutor::new(docker, 5);
        assert_eq!(executor.running_count().await, 0);
    }
}
