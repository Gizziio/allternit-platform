//! Agent execution runtime module
//!
//! Provides a trait abstraction for dispatching jobs to an agent runtime,
//! plus a local implementation that uses the configured execution driver when
//! available and falls back to the host shell for dev/test environments.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use thiserror::Error;
use tokio::process::Command;
use tracing::{debug, warn};

use allternit_driver_interface::{
    CommandSpec, EnvironmentSpec, ExecutionDriver, PolicySpec, ResourceSpec, SpawnSpec, TenantId,
};

/// Specification for a job to be dispatched to a runtime.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobSpec {
    pub command: String,
    #[serde(default)]
    pub args: Vec<String>,
    #[serde(default)]
    pub env: HashMap<String, String>,
    pub working_dir: Option<String>,
}

/// Result of a dispatched job.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: u64,
}

/// Errors that can occur while dispatching or executing a job.
#[derive(Debug, Error)]
pub enum AgentExecutionError {
    #[error("Driver error: {0}")]
    Driver(String),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Output is not valid UTF-8: {0}")]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("No execution runtime is available")]
    NoRuntime,
}

/// Abstraction over an agent execution runtime.
#[async_trait]
pub trait AgentRuntime: Send + Sync + fmt::Debug {
    /// Dispatch a job and return its result.
    async fn dispatch(&self, job: JobSpec) -> Result<JobResult, AgentExecutionError>;
}

/// Local agent runtime that uses an optional execution driver or the host shell.
#[derive(Debug, Clone)]
pub struct LocalAgentRuntime {
    driver: Option<Arc<dyn ExecutionDriver>>,
}

impl LocalAgentRuntime {
    /// Create a new local runtime. If `driver` is `None`, jobs are executed
    /// directly on the host shell (dev/test only).
    pub fn new(driver: Option<Arc<dyn ExecutionDriver>>) -> Self {
        Self { driver }
    }
}

#[async_trait]
impl AgentRuntime for LocalAgentRuntime {
    async fn dispatch(&self, job: JobSpec) -> Result<JobResult, AgentExecutionError> {
        if let Some(ref driver) = self.driver {
            debug!(command = %job.command, "dispatching job via execution driver");
            dispatch_via_driver(&**driver, job).await
        } else {
            debug!(command = %job.command, "dispatching job via host shell");
            dispatch_via_shell(job).await
        }
    }
}

async fn dispatch_via_driver(
    driver: &dyn ExecutionDriver,
    job: JobSpec,
) -> Result<JobResult, AgentExecutionError> {
    let tenant = TenantId::new("local").map_err(|e| AgentExecutionError::Driver(e.to_string()))?;

    let spawn_spec = SpawnSpec {
        tenant,
        project: None,
        workspace: None,
        run_id: None,
        env: EnvironmentSpec {
            working_dir: job.working_dir.clone(),
            ..Default::default()
        },
        policy: PolicySpec::default_permissive(),
        resources: ResourceSpec::minimal(),
        envelope: None,
        prewarm_pool: None,
    };

    let handle = driver
        .spawn(spawn_spec)
        .await
        .map_err(|e| AgentExecutionError::Driver(e.to_string()))?;

    let command = std::iter::once(job.command).chain(job.args).collect();
    let command_spec = CommandSpec {
        command,
        env_vars: job.env,
        working_dir: job.working_dir,
        stdin_data: None,
        capture_stdout: true,
        capture_stderr: true,
    };

    let exec_result = driver
        .exec(&handle, command_spec)
        .await
        .map_err(|e| AgentExecutionError::Driver(e.to_string()))?;

    if let Err(e) = driver.destroy(&handle).await {
        warn!(error = %e, "failed to destroy execution environment");
    }

    Ok(JobResult {
        exit_code: exec_result.exit_code,
        stdout: bytes_to_string(exec_result.stdout)?,
        stderr: bytes_to_string(exec_result.stderr)?,
        duration_ms: exec_result.duration_ms,
    })
}

async fn dispatch_via_shell(job: JobSpec) -> Result<JobResult, AgentExecutionError> {
    let start = std::time::Instant::now();
    let mut cmd = Command::new(&job.command);
    cmd.args(&job.args).envs(&job.env);
    if let Some(dir) = &job.working_dir {
        cmd.current_dir(dir);
    }

    let output = cmd.output().await?;
    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(JobResult {
        exit_code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8(output.stdout)?,
        stderr: String::from_utf8(output.stderr)?,
        duration_ms,
    })
}

fn bytes_to_string(bytes: Option<Vec<u8>>) -> Result<String, AgentExecutionError> {
    match bytes {
        Some(b) => Ok(String::from_utf8(b)?),
        None => Ok(String::new()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_shell_dispatch_echo() {
        let runtime = LocalAgentRuntime::new(None);
        let result = runtime
            .dispatch(JobSpec {
                command: "echo".to_string(),
                args: vec!["hello".to_string()],
                env: HashMap::new(),
                working_dir: None,
            })
            .await
            .expect("dispatch should succeed");

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.trim() == "hello");
        assert!(result.stderr.is_empty());
    }

    #[tokio::test]
    async fn test_shell_dispatch_env() {
        let runtime = LocalAgentRuntime::new(None);
        let result = runtime
            .dispatch(JobSpec {
                command: "env".to_string(),
                args: vec![],
                env: {
                    let mut map = HashMap::new();
                    map.insert("TEST_KEY".to_string(), "test_value".to_string());
                    map
                },
                working_dir: None,
            })
            .await
            .expect("dispatch should succeed");

        assert_eq!(result.exit_code, 0);
        assert!(result.stdout.contains("TEST_KEY=test_value"));
    }

    #[tokio::test]
    async fn test_shell_dispatch_exit_code() {
        let runtime = LocalAgentRuntime::new(None);
        let result = runtime
            .dispatch(JobSpec {
                command: "sh".to_string(),
                args: vec!["-c".to_string(), "exit 7".to_string()],
                env: HashMap::new(),
                working_dir: None,
            })
            .await
            .expect("dispatch should succeed");

        assert_eq!(result.exit_code, 7);
    }

    #[tokio::test]
    async fn test_shell_dispatch_missing_command() {
        let runtime = LocalAgentRuntime::new(None);
        let result = runtime
            .dispatch(JobSpec {
                command: "/nonexistent/binary".to_string(),
                args: vec![],
                env: HashMap::new(),
                working_dir: None,
            })
            .await;

        assert!(matches!(result, Err(AgentExecutionError::Io(_))));
    }

    #[test]
    fn test_local_runtime_implements_trait() {
        fn assert_trait<T: AgentRuntime>() {}
        assert_trait::<LocalAgentRuntime>();
    }
}
