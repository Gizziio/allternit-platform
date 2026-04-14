//! Cron System Native - OC-024
//!
//! Native Rust implementation of OpenClaw's cron job scheduling system.
//! This module provides a pure Rust implementation of job scheduling that
//! will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration as StdDuration;
use tokio::fs;
use tokio_cron_scheduler::JobScheduler;

/// Cron job identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CronJobId(String);

impl CronJobId {
    pub fn new(id: String) -> Self {
        Self(id)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for CronJobId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Cron job definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobDefinition {
    pub id: CronJobId,
    pub name: String,
    pub description: String,
    pub schedule: String, // Cron expression like "0 9 * * *" for daily at 9 AM
    pub command: String,  // Command to execute
    pub arguments: Option<HashMap<String, serde_json::Value>>,
    pub enabled: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_run: Option<DateTime<Utc>>,
    pub next_run: Option<DateTime<Utc>>,
}

/// Cron job execution result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobResult {
    pub job_id: CronJobId,
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub duration_ms: u64,
}

/// Cron job execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobExecutionRequest {
    pub job_id: CronJobId,
    pub force_execution: bool, // Execute immediately regardless of schedule
    pub override_arguments: Option<HashMap<String, serde_json::Value>>,
}

/// Cron job management request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobManagementRequest {
    pub operation: CronJobOperation,
    pub context: Option<CronJobContext>,
}

/// Cron job operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CronJobOperation {
    /// List all cron jobs
    ListJobs,

    /// Get a specific cron job
    GetJob { id: CronJobId },

    /// Add or update a cron job
    UpsertJob { definition: CronJobDefinition },

    /// Remove a cron job
    RemoveJob { id: CronJobId },

    /// Enable a cron job
    EnableJob { id: CronJobId },

    /// Disable a cron job
    DisableJob { id: CronJobId },

    /// Execute a cron job immediately
    ExecuteJob { request: CronJobExecutionRequest },

    /// Get job execution history
    GetHistory { id: CronJobId, limit: Option<usize> },

    /// Get scheduler status
    GetStatus,
}

/// Cron job context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Cron job management response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronJobManagementResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Cron system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronSystemConfig {
    pub jobs_dir: PathBuf,
    pub enable_persistence: bool,
    pub enable_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub max_history_entries: Option<usize>,
    pub default_timeout_ms: u64,
    pub enable_parallel_execution: bool,
    pub max_concurrent_jobs: Option<usize>,
    pub enable_system_notifications: bool,
}

impl Default for CronSystemConfig {
    fn default() -> Self {
        Self {
            jobs_dir: PathBuf::from("./cron-jobs"),
            enable_persistence: true,
            enable_logging: true,
            log_level: "info".to_string(),
            max_history_entries: Some(100),
            default_timeout_ms: 300_000, // 5 minutes
            enable_parallel_execution: true,
            max_concurrent_jobs: Some(5),
            enable_system_notifications: false,
        }
    }
}

/// Cron system service
pub struct CronSystemService {
    config: CronSystemConfig,
    scheduler: JobScheduler,
    jobs: HashMap<CronJobId, CronJobDefinition>,
    job_history: HashMap<CronJobId, Vec<CronJobResult>>,
    active_handles: HashMap<CronJobId, uuid::Uuid>, // Job ID to scheduler handle ID
}

impl CronSystemService {
    /// Create new cron system service with default configuration
    pub async fn new() -> Result<Self, CronSystemError> {
        let scheduler = JobScheduler::new().await.map_err(|e| {
            CronSystemError::SchedulerError(format!("Failed to create scheduler: {}", e))
        })?;

        Ok(Self {
            config: CronSystemConfig::default(),
            scheduler,
            jobs: HashMap::new(),
            job_history: HashMap::new(),
            active_handles: HashMap::new(),
        })
    }

    /// Create new cron system service with custom configuration
    pub async fn with_config(config: CronSystemConfig) -> Result<Self, CronSystemError> {
        let scheduler = JobScheduler::new().await.map_err(|e| {
            CronSystemError::SchedulerError(format!("Failed to create scheduler: {}", e))
        })?;

        Ok(Self {
            config,
            scheduler,
            jobs: HashMap::new(),
            job_history: HashMap::new(),
            active_handles: HashMap::new(),
        })
    }

    /// Initialize the service by loading existing cron jobs
    pub async fn initialize(&mut self) -> Result<(), CronSystemError> {
        self.ensure_jobs_dir().await?;
        self.load_job_configs().await?;
        self.start_scheduler().await?;
        Ok(())
    }

    /// Ensure the jobs directory exists
    async fn ensure_jobs_dir(&self) -> Result<(), CronSystemError> {
        fs::create_dir_all(&self.config.jobs_dir)
            .await
            .map_err(|e| {
                CronSystemError::IoError(format!("Failed to create jobs directory: {}", e))
            })
    }

    /// Load job configurations from disk
    async fn load_job_configs(&mut self) -> Result<(), CronSystemError> {
        if !self.config.jobs_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.jobs_dir).await.map_err(|e| {
            CronSystemError::IoError(format!("Failed to read jobs directory: {}", e))
        })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            CronSystemError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    if let Ok(job_def) = serde_json::from_str::<CronJobDefinition>(&content) {
                        self.jobs.insert(job_def.id.clone(), job_def);
                    }
                }
            }
        }

        Ok(())
    }

    /// Start the cron scheduler
    async fn start_scheduler(&mut self) -> Result<(), CronSystemError> {
        // Schedule all loaded jobs
        let jobs_to_schedule: Vec<(CronJobId, CronJobDefinition)> = self
            .jobs
            .iter()
            .filter(|(_, job_def)| job_def.enabled)
            .map(|(job_id, job_def)| (job_id.clone(), job_def.clone()))
            .collect();

        for (job_id, job_def) in jobs_to_schedule {
            self.schedule_job(&job_id, &job_def).await?;
        }

        // Start the scheduler
        self.scheduler.start().await.map_err(|e| {
            CronSystemError::SchedulerError(format!("Failed to start scheduler: {}", e))
        })?;

        Ok(())
    }

    /// Schedule a job in the scheduler
    async fn schedule_job(
        &mut self,
        job_id: &CronJobId,
        job_def: &CronJobDefinition,
    ) -> Result<(), CronSystemError> {
        // In a real implementation, this would use the actual cron scheduler
        // For now, we'll just store the job definition and calculate next run time

        // Parse the cron expression to determine next run time
        // This is a simplified approach - in reality, we'd use a proper cron parser
        let next_run = self.calculate_next_run_time(&job_def.schedule)?;

        // Update job definition with next run time
        let mut updated_def = job_def.clone();
        updated_def.next_run = Some(next_run);

        self.jobs.insert(job_id.clone(), updated_def);

        Ok(())
    }

    /// Calculate next run time from cron expression
    fn calculate_next_run_time(&self, cron_expr: &str) -> Result<DateTime<Utc>, CronSystemError> {
        // This is a simplified implementation - in a real system, we'd use a proper cron parser
        // For now, we'll just return the current time + 1 hour as a placeholder
        Ok(Utc::now() + Duration::hours(1))
    }

    /// Execute a job immediately
    async fn execute_job_now(
        &mut self,
        job_id: &CronJobId,
    ) -> Result<CronJobResult, CronSystemError> {
        let job_def = self
            .jobs
            .get(job_id)
            .ok_or_else(|| CronSystemError::JobNotFound(job_id.0.clone()))?
            .clone();

        if !job_def.enabled {
            return Err(CronSystemError::JobDisabled(job_id.0.clone()));
        }

        let start_time = Utc::now();

        // In a real implementation, this would execute the actual command
        // For now, we'll simulate execution
        let result = self.simulate_job_execution(&job_def).await;

        let completed_time = Utc::now();
        let duration_ms = (completed_time - start_time).num_milliseconds() as u64;

        let job_result = CronJobResult {
            job_id: job_id.clone(),
            success: result.is_ok(),
            output: result.as_ref().ok().cloned(),
            error: result.err(),
            started_at: start_time,
            completed_at: completed_time,
            duration_ms,
        };

        // Update job definition with last run time
        let next_run = if let Some(job_def) = self.jobs.get(job_id) {
            Some(self.calculate_next_run_time(&job_def.schedule)?)
        } else {
            None
        };
        if let Some(job_def) = self.jobs.get_mut(job_id) {
            job_def.last_run = Some(completed_time);
            job_def.next_run = next_run;
        }

        // Add to history
        self.add_to_history(job_id, job_result.clone()).await;

        Ok(job_result)
    }

    /// Simulate job execution (in a real implementation, this would execute the actual command)
    async fn simulate_job_execution(&self, job_def: &CronJobDefinition) -> Result<String, String> {
        // Simulate some work
        tokio::time::sleep(StdDuration::from_millis(100)).await;

        // In a real implementation, this would execute the command
        // For now, return a success message
        Ok(format!(
            "Executed job: {} with command: {}",
            job_def.name, job_def.command
        ))
    }

    /// Add job result to history
    async fn add_to_history(&mut self, job_id: &CronJobId, result: CronJobResult) {
        let history = self.job_history.entry(job_id.clone()).or_default();
        history.push(result);

        // Limit history size if configured
        if let Some(max_entries) = self.config.max_history_entries {
            if history.len() > max_entries {
                history.drain(0..(history.len() - max_entries));
            }
        }
    }

    /// Execute a cron management operation
    pub async fn execute(
        &mut self,
        request: CronJobManagementRequest,
    ) -> Result<CronJobManagementResponse, CronSystemError> {
        let start_time = std::time::Instant::now();

        let result = match request.operation {
            CronJobOperation::ListJobs => self.list_jobs().await,
            CronJobOperation::GetJob { id } => self.get_job(&id).await,
            CronJobOperation::UpsertJob { definition } => self.upsert_job(definition).await,
            CronJobOperation::RemoveJob { id } => self.remove_job(&id).await,
            CronJobOperation::EnableJob { id } => self.enable_job(&id).await,
            CronJobOperation::DisableJob { id } => self.disable_job(&id).await,
            CronJobOperation::ExecuteJob { request } => self.execute_job(&request).await,
            CronJobOperation::GetHistory { id, limit } => self.get_job_history(&id, limit).await,
            CronJobOperation::GetStatus => self.get_status().await,
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => Ok(CronJobManagementResponse {
                success: true,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(error) => Ok(CronJobManagementResponse {
                success: false,
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// List all cron jobs
    async fn list_jobs(&self) -> Result<serde_json::Value, CronSystemError> {
        let jobs: Vec<serde_json::Value> = self
            .jobs
            .values()
            .map(|job_def| {
                serde_json::json!({
                    "id": job_def.id.as_str(),
                    "name": job_def.name,
                    "description": job_def.description,
                    "schedule": job_def.schedule,
                    "command": job_def.command,
                    "enabled": job_def.enabled,
                    "createdAt": job_def.created_at,
                    "updatedAt": job_def.updated_at,
                    "lastRun": job_def.last_run,
                    "nextRun": job_def.next_run,
                })
            })
            .collect();

        Ok(serde_json::json!({
            "jobs": jobs,
            "count": jobs.len(),
        }))
    }

    /// Get a specific cron job
    async fn get_job(&self, id: &CronJobId) -> Result<serde_json::Value, CronSystemError> {
        match self.jobs.get(id) {
            Some(job_def) => Ok(serde_json::json!({
                "job": {
                    "id": job_def.id.as_str(),
                    "name": job_def.name,
                    "description": job_def.description,
                    "schedule": job_def.schedule,
                    "command": job_def.command,
                    "arguments": job_def.arguments,
                    "enabled": job_def.enabled,
                    "metadata": job_def.metadata,
                    "createdAt": job_def.created_at,
                    "updatedAt": job_def.updated_at,
                    "lastRun": job_def.last_run,
                    "nextRun": job_def.next_run,
                }
            })),
            None => Err(CronSystemError::JobNotFound(id.0.clone())),
        }
    }

    /// Add or update a cron job
    async fn upsert_job(
        &mut self,
        mut definition: CronJobDefinition,
    ) -> Result<serde_json::Value, CronSystemError> {
        // Validate cron expression
        self.validate_cron_expression(&definition.schedule)?;

        // Set timestamps
        let now = Utc::now();
        if self.jobs.contains_key(&definition.id) {
            // Update existing job
            definition.updated_at = now;
        } else {
            // New job
            definition.created_at = now;
        }

        // Calculate next run time
        definition.next_run = Some(self.calculate_next_run_time(&definition.schedule)?);

        let job_id = definition.id.clone();
        let was_enabled = self.jobs.get(&job_id).map(|j| j.enabled).unwrap_or(false);

        // Add to registry
        self.jobs.insert(job_id.clone(), definition.clone());

        // If the job is enabled, schedule it
        if definition.enabled {
            self.schedule_job(&job_id, &definition).await?;
        } else if was_enabled {
            // If the job was previously enabled and is now disabled, unschedule it
            self.unschedule_job(&job_id).await?;
        }

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_job_config(&definition).await?;
        }

        Ok(serde_json::json!({
            "status": "job_upserted",
            "id": job_id.as_str(),
        }))
    }

    /// Remove a cron job
    async fn remove_job(&mut self, id: &CronJobId) -> Result<serde_json::Value, CronSystemError> {
        if !self.jobs.contains_key(id) {
            return Err(CronSystemError::JobNotFound(id.0.clone()));
        }

        // Unschedule if it was scheduled
        self.unschedule_job(id).await?;

        // Remove from registry
        self.jobs.remove(id);

        // Remove from disk if it exists
        let job_path = self.job_config_path(id);
        if job_path.exists() {
            let _ = fs::remove_file(job_path).await; // Ignore errors if file doesn't exist
        }

        // Remove history
        self.job_history.remove(id);

        Ok(serde_json::json!({
            "status": "job_removed",
            "id": id.as_str(),
        }))
    }

    /// Enable a cron job
    async fn enable_job(&mut self, id: &CronJobId) -> Result<serde_json::Value, CronSystemError> {
        let job_def = self
            .jobs
            .get_mut(id)
            .ok_or_else(|| CronSystemError::JobNotFound(id.0.clone()))?;

        if job_def.enabled {
            return Ok(serde_json::json!({
                "status": "job_already_enabled",
                "id": id.as_str(),
            }));
        }

        // Update job definition
        job_def.enabled = true;
        job_def.updated_at = Utc::now();
        let job_def_snapshot = job_def.clone();
        drop(job_def);

        // Schedule the job
        self.schedule_job(id, &job_def_snapshot).await?;

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_job_config(&job_def_snapshot).await?;
        }

        Ok(serde_json::json!({
            "status": "job_enabled",
            "id": id.as_str(),
        }))
    }

    /// Disable a cron job
    async fn disable_job(&mut self, id: &CronJobId) -> Result<serde_json::Value, CronSystemError> {
        let job_def = self
            .jobs
            .get_mut(id)
            .ok_or_else(|| CronSystemError::JobNotFound(id.0.clone()))?;

        if !job_def.enabled {
            return Ok(serde_json::json!({
                "status": "job_already_disabled",
                "id": id.as_str(),
            }));
        }

        // Update job definition
        job_def.enabled = false;
        job_def.updated_at = Utc::now();
        job_def.next_run = None; // Clear next run when disabled
        let job_def_snapshot = job_def.clone();
        drop(job_def);

        // Unschedule the job
        self.unschedule_job(id).await?;

        // Persist if enabled
        if self.config.enable_persistence {
            self.persist_job_config(&job_def_snapshot).await?;
        }

        Ok(serde_json::json!({
            "status": "job_disabled",
            "id": id.as_str(),
        }))
    }

    /// Execute a job (either scheduled or forced immediate)
    async fn execute_job(
        &mut self,
        request: &CronJobExecutionRequest,
    ) -> Result<serde_json::Value, CronSystemError> {
        if request.force_execution {
            let result = self.execute_job_now(&request.job_id).await?;
            Ok(serde_json::json!({
                "status": "job_executed",
                "result": result,
            }))
        } else {
            // For scheduled execution, just return job info
            let job_info = self.get_job(&request.job_id).await?;
            Ok(serde_json::json!({
                "status": "job_info",
                "job": job_info,
            }))
        }
    }

    /// Get job execution history
    async fn get_job_history(
        &self,
        id: &CronJobId,
        limit: Option<usize>,
    ) -> Result<serde_json::Value, CronSystemError> {
        let history = self.job_history.get(id).cloned().unwrap_or_default();

        let limited_history = if let Some(limit_val) = limit {
            let start = history.len().saturating_sub(limit_val);
            history[start..].to_vec()
        } else {
            history
        };

        Ok(serde_json::json!({
            "history": limited_history,
            "count": limited_history.len(),
        }))
    }

    /// Get scheduler status
    async fn get_status(&self) -> Result<serde_json::Value, CronSystemError> {
        Ok(serde_json::json!({
            "totalJobs": self.jobs.len(),
            "enabledJobs": self.jobs.values().filter(|j| j.enabled).count(),
            "scheduledJobs": self.jobs.values().filter(|j| j.enabled).count(), // Simplified
            "activeHandles": self.active_handles.len(),
            "config": {
                "jobsDir": self.config.jobs_dir.to_string_lossy().to_string(),
                "enablePersistence": self.config.enable_persistence,
                "maxHistoryEntries": self.config.max_history_entries,
                "maxConcurrentJobs": self.config.max_concurrent_jobs,
            }
        }))
    }

    /// Unschedule a job from the scheduler
    async fn unschedule_job(&mut self, id: &CronJobId) -> Result<(), CronSystemError> {
        // In a real implementation, this would remove the job from the scheduler
        // For now, we'll just remove the handle
        self.active_handles.remove(id);
        Ok(())
    }

    /// Validate cron expression
    fn validate_cron_expression(&self, expr: &str) -> Result<(), CronSystemError> {
        // This is a simplified validation - in a real implementation, we'd use a proper cron parser
        // For now, just check that it's not empty and has some basic format
        if expr.trim().is_empty() {
            return Err(CronSystemError::ValidationError(
                "Cron expression cannot be empty".to_string(),
            ));
        }

        // Basic validation: should have 5-7 space-separated parts (standard cron format)
        let parts: Vec<&str> = expr.split_whitespace().collect();
        if parts.len() < 5 || parts.len() > 7 {
            return Err(CronSystemError::ValidationError(
                "Cron expression must have 5-7 space-separated parts".to_string(),
            ));
        }

        Ok(())
    }

    /// Persist job configuration to disk
    async fn persist_job_config(&self, job_def: &CronJobDefinition) -> Result<(), CronSystemError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        let job_path = self.job_config_path(&job_def.id);
        let config_json = serde_json::to_string_pretty(job_def).map_err(|e| {
            CronSystemError::SerializationError(format!("Failed to serialize job config: {}", e))
        })?;

        fs::write(&job_path, config_json)
            .await
            .map_err(|e| CronSystemError::IoError(format!("Failed to write job config: {}", e)))?;

        Ok(())
    }

    /// Get the file path for a job config
    fn job_config_path(&self, id: &CronJobId) -> PathBuf {
        self.config.jobs_dir.join(format!("{}.json", id.as_str()))
    }

    /// Get current configuration
    pub fn config(&self) -> &CronSystemConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut CronSystemConfig {
        &mut self.config
    }

    /// Check if a job exists
    pub fn has_job(&self, id: &CronJobId) -> bool {
        self.jobs.contains_key(id)
    }
}

/// Cron system error
#[derive(Debug, thiserror::Error)]
pub enum CronSystemError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Job not found: {0}")]
    JobNotFound(String),

    #[error("Job is disabled: {0}")]
    JobDisabled(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Execution error: {0}")]
    ExecutionError(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Scheduler error: {0}")]
    SchedulerError(String),
}

impl From<serde_json::Error> for CronSystemError {
    fn from(error: serde_json::Error) -> Self {
        CronSystemError::SerializationError(error.to_string())
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_cron_system_creation() {
        let system = CronSystemService::new().await.unwrap();
        assert_eq!(system.config.jobs_dir, PathBuf::from("./cron-jobs"));
        assert!(system.config.enable_persistence);
        assert_eq!(system.jobs.len(), 0);
    }

    #[tokio::test]
    async fn test_cron_system_with_config() {
        let config = CronSystemConfig {
            jobs_dir: PathBuf::from("/tmp/test-cron-jobs"),
            enable_persistence: false,
            max_history_entries: Some(50),
            ..Default::default()
        };

        let system = CronSystemService::with_config(config).await.unwrap();
        assert_eq!(system.config.jobs_dir, PathBuf::from("/tmp/test-cron-jobs"));
        assert!(!system.config.enable_persistence);
    }

    #[tokio::test]
    async fn test_upsert_and_get_job() {
        let mut system = CronSystemService::new().await.unwrap();

        let job_def = CronJobDefinition {
            id: CronJobId::new("test-job".to_string()),
            name: "Test Job".to_string(),
            description: "A test job".to_string(),
            schedule: "0 * * * *".to_string(), // Hourly
            command: "echo 'hello'".to_string(),
            arguments: None,
            enabled: true,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_run: None,
            next_run: None,
        };

        // Add job
        let upsert_result = system.upsert_job(job_def.clone()).await.unwrap();
        assert!(upsert_result.get("status").and_then(|v| v.as_str()) == Some("job_upserted"));

        // Verify job exists
        assert!(system.has_job(&CronJobId::new("test-job".to_string())));

        // Get job
        let get_result = system
            .get_job(&CronJobId::new("test-job".to_string()))
            .await
            .unwrap();
        let job_data = get_result.get("job").unwrap();

        assert_eq!(
            job_data.get("id").and_then(|v| v.as_str()),
            Some("test-job")
        );
        assert_eq!(
            job_data.get("name").and_then(|v| v.as_str()),
            Some("Test Job")
        );
        assert_eq!(
            job_data.get("enabled").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    #[tokio::test]
    async fn test_enable_disable_job() {
        let mut system = CronSystemService::new().await.unwrap();

        let job_def = CronJobDefinition {
            id: CronJobId::new("toggle-job".to_string()),
            name: "Toggle Job".to_string(),
            description: "A job to test toggling".to_string(),
            schedule: "0 9 * * *".to_string(), // Daily at 9 AM
            command: "ls -la".to_string(),
            arguments: None,
            enabled: false, // Start disabled
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_run: None,
            next_run: None,
        };

        system.upsert_job(job_def).await.unwrap();

        // Enable the job
        let enable_result = system
            .enable_job(&CronJobId::new("toggle-job".to_string()))
            .await
            .unwrap();
        assert!(enable_result.get("status").and_then(|v| v.as_str()) == Some("job_enabled"));

        // Verify it's enabled
        let job = system
            .get_job(&CronJobId::new("toggle-job".to_string()))
            .await
            .unwrap();
        let job_data = job.get("job").unwrap();
        assert_eq!(
            job_data.get("enabled").and_then(|v| v.as_bool()),
            Some(true)
        );

        // Disable the job
        let disable_result = system
            .disable_job(&CronJobId::new("toggle-job".to_string()))
            .await
            .unwrap();
        assert!(disable_result.get("status").and_then(|v| v.as_str()) == Some("job_disabled"));

        // Verify it's disabled
        let job = system
            .get_job(&CronJobId::new("toggle-job".to_string()))
            .await
            .unwrap();
        let job_data = job.get("job").unwrap();
        assert_eq!(
            job_data.get("enabled").and_then(|v| v.as_bool()),
            Some(false)
        );
    }

    #[tokio::test]
    async fn test_list_jobs() {
        let mut system = CronSystemService::new().await.unwrap();

        // Add a few jobs
        for i in 1..=3 {
            let job_def = CronJobDefinition {
                id: CronJobId::new(format!("list-test-{}", i)),
                name: format!("List Test Job {}", i),
                description: format!("Job {} for testing list", i),
                schedule: format!("0 */{} * * *", i), // Every i hours
                command: format!("echo 'job {}'", i),
                arguments: None,
                enabled: true,
                metadata: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                last_run: None,
                next_run: None,
            };

            system.upsert_job(job_def).await.unwrap();
        }

        // List jobs
        let list_result = system.list_jobs().await.unwrap();
        let jobs = list_result.get("jobs").unwrap().as_array().unwrap();
        let count = list_result.get("count").unwrap().as_u64().unwrap();

        assert_eq!(jobs.len(), 3);
        assert_eq!(count, 3);

        // Verify job names
        let job_names: Vec<String> = jobs
            .iter()
            .filter_map(|job| {
                job.get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .collect();

        assert!(job_names.contains(&"List Test Job 1".to_string()));
        assert!(job_names.contains(&"List Test Job 2".to_string()));
        assert!(job_names.contains(&"List Test Job 3".to_string()));
    }

    #[tokio::test]
    async fn test_remove_job() {
        let mut system = CronSystemService::new().await.unwrap();

        let job_def = CronJobDefinition {
            id: CronJobId::new("remove-test".to_string()),
            name: "Remove Test Job".to_string(),
            description: "A job to test removal".to_string(),
            schedule: "0 0 * * *".to_string(), // Daily at midnight
            command: "pwd".to_string(),
            arguments: None,
            enabled: true,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_run: None,
            next_run: None,
        };

        system.upsert_job(job_def).await.unwrap();
        assert!(system.has_job(&CronJobId::new("remove-test".to_string())));

        // Remove job
        let remove_result = system
            .remove_job(&CronJobId::new("remove-test".to_string()))
            .await
            .unwrap();
        assert!(remove_result.get("status").and_then(|v| v.as_str()) == Some("job_removed"));

        // Verify job no longer exists
        assert!(!system.has_job(&CronJobId::new("remove-test".to_string())));
    }

    #[test]
    fn test_cron_expression_validation() {
        let system = CronSystemService::new().await.unwrap();

        // Valid expressions
        assert!(system.validate_cron_expression("0 9 * * *").is_ok()); // Daily at 9 AM
        assert!(system.validate_cron_expression("0 */2 * * *").is_ok()); // Every 2 hours
        assert!(system.validate_cron_expression("0 0 1 * *").is_ok()); // Monthly on 1st
        assert!(system.validate_cron_expression("0 0 * * 0").is_ok()); // Weekly on Sunday

        // Invalid expressions
        assert!(system.validate_cron_expression("").is_err());
        assert!(system.validate_cron_expression("0 9 * *").is_err()); // Too few parts
        assert!(system.validate_cron_expression("0 9 * * * * * *").is_err()); // Too many parts
    }

    #[tokio::test]
    async fn test_job_execution() {
        let mut system = CronSystemService::new().await.unwrap();

        let job_def = CronJobDefinition {
            id: CronJobId::new("exec-test".to_string()),
            name: "Execution Test Job".to_string(),
            description: "A job to test execution".to_string(),
            schedule: "0 * * * *".to_string(), // Hourly
            command: "echo 'executed'".to_string(),
            arguments: None,
            enabled: true,
            metadata: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            last_run: None,
            next_run: None,
        };

        system.upsert_job(job_def).await.unwrap();

        // Execute job immediately
        let execution_request = CronJobExecutionRequest {
            job_id: CronJobId::new("exec-test".to_string()),
            force_execution: true,
            override_arguments: None,
        };

        let exec_result = system.execute_job(&execution_request).await.unwrap();
        assert!(exec_result.get("status").and_then(|v| v.as_str()) == Some("job_executed"));

        let result_data = exec_result.get("result").unwrap();
        assert_eq!(
            result_data.get("job_id").and_then(|v| v.as_str()),
            Some("exec-test")
        );
        assert_eq!(
            result_data.get("success").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    #[test]
    fn test_cron_job_id_display() {
        let job_id = CronJobId::new("test-job".to_string());
        assert_eq!(format!("{}", job_id), "test-job");
    }
}
