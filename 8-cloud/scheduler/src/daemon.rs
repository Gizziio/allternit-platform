//! Scheduler Daemon
//!
//! Main daemon that polls schedules and triggers runs.

use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::{Pool, Sqlite, SqlitePool};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::interval;
use tracing::{debug, error, info, warn};

use crate::misfire::{handle_misfire, MisfireAction};
use crate::scheduler::{Schedule, ScheduleTrigger};
use crate::SchedulerConfig;

/// Scheduler daemon
pub struct SchedulerDaemon {
    config: SchedulerConfig,
    db: Pool<Sqlite>,
    /// Track scheduled triggers
    triggers: Arc<RwLock<HashMap<String, ScheduleTrigger>>>,
    /// HTTP client for API calls
    http_client: reqwest::Client,
}

impl SchedulerDaemon {
    /// Create a new scheduler daemon
    pub async fn new(config: SchedulerConfig) -> Result<Self> {
        info!("Connecting to database: {}", config.database_url);
        
        let db = SqlitePool::connect(&config.database_url)
            .await
            .context("Failed to connect to database")?;
        
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;
        
        Ok(Self {
            config,
            db,
            triggers: Arc::new(RwLock::new(HashMap::new())),
            http_client,
        })
    }
    
    /// Run the daemon forever
    pub async fn run(&self) -> Result<()> {
        let mut poll_interval = interval(Duration::from_secs(self.config.poll_interval_secs));
        
        info!("Scheduler daemon started");
        
        loop {
            poll_interval.tick().await;
            
            if let Err(e) = self.tick().await {
                error!("Error during scheduler tick: {}", e);
            }
        }
    }
    
    /// Run a single tick (for testing)
    pub async fn run_once(&self) -> Result<()> {
        self.tick().await
    }
    
    /// Single tick - check schedules and trigger due runs
    async fn tick(&self) -> Result<()> {
        let now = Utc::now();
        debug!("Scheduler tick at {}", now);
        
        // Get enabled schedules that are due
        let due_schedules = self.get_due_schedules().await?;
        
        if !due_schedules.is_empty() {
            info!("Found {} due schedules", due_schedules.len());
        }
        
        for schedule in due_schedules {
            if let Err(e) = self.process_schedule(&schedule).await {
                error!("Failed to process schedule {}: {}", schedule.id, e);
            }
        }
        
        // Handle misfires
        self.handle_misfires().await?;
        
        Ok(())
    }
    
    /// Get schedules that are due for execution
    async fn get_due_schedules(&self) -> Result<Vec<Schedule>> {
        let now = Utc::now();
        
        let schedules = sqlx::query_as::<_, Schedule>(
            r#"
            SELECT 
                id, name, description, cron_expr, natural_lang, timezone,
                job_template as "job_template: sqlx::types::Json<serde_json::Value>",
                enabled, misfire_policy, last_run_at, next_run_at, run_count, misfire_count,
                owner_id, tenant_id, created_at, updated_at
            FROM schedules
            WHERE enabled = TRUE
              AND next_run_at IS NOT NULL
              AND next_run_at <= ?
            ORDER BY next_run_at ASC
            LIMIT ?
            "#
        )
        .bind(now)
        .bind(self.config.max_schedules_per_tick as i64)
        .fetch_all(&self.db)
        .await
        .context("Failed to fetch due schedules")?;
        
        Ok(schedules)
    }
    
    /// Process a single schedule (check if due and trigger)
    async fn process_schedule(&self, schedule: &Schedule) -> Result<()> {
        info!("Processing schedule: {} ({})", schedule.id, schedule.name);
        
        let now = Utc::now();
        
        // Calculate next run time
        let next_run = self.calculate_next_run(schedule).await?;
        
        // Trigger the run
        let trigger_result = self.trigger_run(schedule).await;
        
        match trigger_result {
            Ok(run_id) => {
                info!("Triggered run {} for schedule {}", run_id, schedule.id);
                
                // Update schedule status
                self.update_schedule_after_run(schedule, now, next_run).await?;
                
                // Record trigger
                self.record_trigger(schedule, &run_id, true).await?;
            }
            Err(e) => {
                error!("Failed to trigger run for schedule {}: {}", schedule.id, e);
                
                // Record failed trigger
                self.record_trigger(schedule, "", false).await?;
                
                // Still update next_run_at to prevent infinite retries
                self.update_schedule_next_run(schedule, next_run).await?;
            }
        }
        
        Ok(())
    }
    
    /// Calculate next run time for a schedule
    async fn calculate_next_run(&self, schedule: &Schedule) -> Result<Option<chrono::DateTime<Utc>>> {
        // Parse the cron expression
        let parsed = a2r_cron_parser::parse(&schedule.cron_expr)
            .map_err(|e| anyhow::anyhow!("Failed to parse cron expression: {}", e))?;
        
        // Get next occurrence after now
        let next = a2r_cron_parser::next_occurrence(&parsed.expression, Some(Utc::now()))
            .ok_or_else(|| anyhow::anyhow!("Failed to calculate next occurrence"))?;
        
        Ok(Some(next))
    }
    
    /// Trigger a run for a schedule
    async fn trigger_run(&self, schedule: &Schedule) -> Result<String> {
        let run_id = uuid::Uuid::new_v4().to_string();
        
        // Build API request to create run
        let url = format!("{}/api/v1/runs", self.config.api_url);
        
        let body = serde_json::json!({
            "name": format!("Scheduled: {}", schedule.name),
            "description": schedule.description,
            "mode": "remote",
            "config": schedule.job_template,
            "auto_start": true,
            "schedule_id": schedule.id,
        });
        
        let mut request = self.http_client
            .post(&url)
            .json(&body);
        
        // Add API key if configured
        if let Some(api_key) = &self.config.api_key {
            request = request.header("Authorization", format!("Bearer {}", api_key));
        }
        
        let response = request
            .send()
            .await
            .context("Failed to send trigger request")?;
        
        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("API error: {}", error_text));
        }
        
        let result: serde_json::Value = response
            .json()
            .await
            .context("Failed to parse API response")?;
        
        let created_run_id = result["id"].as_str()
            .map(|s| s.to_string())
            .unwrap_or(run_id);
        
        Ok(created_run_id)
    }
    
    /// Update schedule after successful run
    async fn update_schedule_after_run(
        &self,
        schedule: &Schedule,
        last_run: chrono::DateTime<Utc>,
        next_run: Option<chrono::DateTime<Utc>>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE schedules
            SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(last_run)
        .bind(next_run)
        .bind(Utc::now())
        .bind(&schedule.id)
        .execute(&self.db)
        .await
        .context("Failed to update schedule")?;
        
        Ok(())
    }
    
    /// Update just the next_run_at field
    async fn update_schedule_next_run(
        &self,
        schedule: &Schedule,
        next_run: Option<chrono::DateTime<Utc>>,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE schedules SET next_run_at = ?, updated_at = ? WHERE id = ?"
        )
        .bind(next_run)
        .bind(Utc::now())
        .bind(&schedule.id)
        .execute(&self.db)
        .await
        .context("Failed to update schedule next_run")?;
        
        Ok(())
    }
    
    /// Record a schedule trigger for auditing
    async fn record_trigger(&self, schedule: &Schedule, run_id: &str, success: bool) -> Result<()> {
        // This could write to a trigger_history table
        // For now, just log it
        if success {
            debug!("Recorded trigger: schedule={}, run_id={}", schedule.id, run_id);
        } else {
            warn!("Recorded failed trigger: schedule={}", schedule.id);
        }
        
        Ok(())
    }
    
    /// Handle misfired schedules
    async fn handle_misfires(&self) -> Result<()> {
        let now = Utc::now();
        let threshold = chrono::Duration::seconds(self.config.misfire_threshold_secs);
        
        // Find schedules that should have run but didn't
        let misfired = sqlx::query_as::<_, Schedule>(
            r#"
            SELECT 
                id, name, description, cron_expr, natural_lang, timezone,
                job_template as "job_template: sqlx::types::Json<serde_json::Value>",
                enabled, misfire_policy, last_run_at, next_run_at, run_count, misfire_count,
                owner_id, tenant_id, created_at, updated_at
            FROM schedules
            WHERE enabled = TRUE
              AND next_run_at IS NOT NULL
              AND next_run_at < ?
              AND (last_run_at IS NULL OR last_run_at < next_run_at)
            "#
        )
        .bind(now - threshold)
        .fetch_all(&self.db)
        .await
        .context("Failed to fetch misfired schedules")?;
        
        for schedule in misfired {
            warn!("Misfired schedule: {} ({})", schedule.id, schedule.name);
            
            match handle_misfire(&schedule, self.config.misfire_policy) {
                MisfireAction::Ignore => {
                    // Just update next_run_at
                    if let Ok(next_run) = self.calculate_next_run(&schedule).await {
                        let _ = self.update_schedule_next_run(&schedule, next_run).await;
                    }
                }
                MisfireAction::FireOnce => {
                    // Trigger one run
                    let _ = self.process_schedule(&schedule).await;
                }
                MisfireAction::FireAll { count } => {
                    // Trigger multiple runs (rare case)
                    warn!("Firing {} misfired runs for {}", count, schedule.id);
                    let _ = self.process_schedule(&schedule).await;
                }
            }
            
            // Increment misfire count
            sqlx::query("UPDATE schedules SET misfire_count = misfire_count + 1 WHERE id = ?")
                .bind(&schedule.id)
                .execute(&self.db)
                .await?;
        }
        
        Ok(())
    }
}
