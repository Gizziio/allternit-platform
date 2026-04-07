//! Scheduler Service
//!
//! Background service that runs the job scheduler within the API server.
//! Polls schedules from the database and triggers runs when due.
//! Now with multi-region awareness for intelligent run placement.

use crate::db::cowork_models::Schedule;
use crate::db::models::Region;
use crate::ApiState;
use chrono::Utc;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::interval;
use tracing::{debug, error, info, warn};

/// Scheduler configuration
#[derive(Debug, Clone)]
pub struct SchedulerConfig {
    /// Polling interval in seconds
    pub poll_interval_secs: u64,
    /// Max schedules to process per tick
    pub max_schedules_per_tick: i64,
    /// Misfire threshold in seconds
    pub misfire_threshold_secs: i64,
    /// Misfire policy: ignore, fire_once, fire_all
    pub misfire_policy: MisfirePolicy,
    /// Default region for runs without explicit region preference
    pub default_region: Option<String>,
    /// Whether multi-region scheduling is enabled
    pub multi_region_enabled: bool,
    /// User location for proximity-based selection (latitude, longitude)
    pub user_location: Option<(f64, f64)>,
    /// Cost optimization mode
    pub cost_optimization: bool,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            poll_interval_secs: 60,
            max_schedules_per_tick: 100,
            misfire_threshold_secs: 300, // 5 minutes
            misfire_policy: MisfirePolicy::FireOnce,
            default_region: std::env::var("DEFAULT_REGION").ok(),
            multi_region_enabled: std::env::var("MULTI_REGION_ENABLED")
                .ok()
                .and_then(|v| v.parse::<bool>().ok())
                .unwrap_or(true),
            user_location: None,
            cost_optimization: std::env::var("COST_OPTIMIZATION")
                .ok()
                .and_then(|v| v.parse::<bool>().ok())
                .unwrap_or(false),
        }
    }
}

impl SchedulerConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Self {
        Self {
            poll_interval_secs: std::env::var("SCHEDULER_POLL_INTERVAL_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60),
            max_schedules_per_tick: std::env::var("SCHEDULER_MAX_PER_TICK")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(100),
            misfire_threshold_secs: std::env::var("SCHEDULER_MISFIRE_THRESHOLD_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300),
            misfire_policy: std::env::var("SCHEDULER_MISFIRE_POLICY")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(MisfirePolicy::FireOnce),
            default_region: std::env::var("DEFAULT_REGION").ok(),
            multi_region_enabled: std::env::var("MULTI_REGION_ENABLED")
                .ok()
                .and_then(|v| v.parse::<bool>().ok())
                .unwrap_or(true),
            user_location: parse_location_env(),
            cost_optimization: std::env::var("COST_OPTIMIZATION")
                .ok()
                .and_then(|v| v.parse::<bool>().ok())
                .unwrap_or(false),
        }
    }
}

/// Parse USER_LOCATION env var (format: "lat,lon")
fn parse_location_env() -> Option<(f64, f64)> {
    std::env::var("USER_LOCATION").ok().and_then(|s| {
        let parts: Vec<&str> = s.split(',').collect();
        if parts.len() == 2 {
            let lat = parts[0].trim().parse::<f64>().ok()?;
            let lon = parts[1].trim().parse::<f64>().ok()?;
            Some((lat, lon))
        } else {
            None
        }
    })
}

/// Misfire policy for missed schedules
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MisfirePolicy {
    Ignore,
    FireOnce,
    FireAll,
}

impl std::str::FromStr for MisfirePolicy {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "ignore" => Ok(MisfirePolicy::Ignore),
            "fire_once" => Ok(MisfirePolicy::FireOnce),
            "fire_all" => Ok(MisfirePolicy::FireAll),
            _ => Err(format!("Unknown misfire policy: {}", s)),
        }
    }
}

/// Misfire action
enum MisfireAction {
    Ignore,
    FireOnce,
    FireAll { count: i32 },
}

/// Scheduler service that runs as a background task
pub struct SchedulerService {
    config: SchedulerConfig,
}

/// Region selection criteria
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RegionSelectionCriteria {
    /// Select region with most available capacity
    Capacity,
    /// Select region closest to user
    Proximity,
    /// Select cheapest region
    Cost,
    /// Balanced approach (capacity + proximity)
    Balanced,
}

impl Default for RegionSelectionCriteria {
    fn default() -> Self {
        RegionSelectionCriteria::Balanced
    }
}

impl SchedulerService {
    /// Create a new scheduler service
    pub fn new(config: SchedulerConfig) -> Self {
        Self { config }
    }

    /// Start the scheduler background task
    pub fn start(self, state: Arc<ApiState>) {
        tokio::spawn(async move {
            let mut poll_interval = interval(Duration::from_secs(self.config.poll_interval_secs));

            info!(
                "Scheduler service started (poll_interval: {}s, multi_region: {})",
                self.config.poll_interval_secs, self.config.multi_region_enabled
            );

            loop {
                poll_interval.tick().await;

                if let Err(e) = self.tick(&state).await {
                    error!("Error during scheduler tick: {}", e);
                }
            }
        });
    }

    /// Single tick - check schedules and trigger due runs
    async fn tick(&self, state: &Arc<ApiState>) -> anyhow::Result<()> {
        let now = Utc::now();
        debug!("Scheduler tick at {}", now);

        // Get enabled schedules that are due
        let due_schedules = self.get_due_schedules(state).await?;

        if !due_schedules.is_empty() {
            info!("Found {} due schedules", due_schedules.len());
        }

        for schedule in due_schedules {
            if let Err(e) = self.process_schedule(state, &schedule).await {
                error!("Failed to process schedule {}: {}", schedule.id, e);
            }
        }

        // Handle misfires
        self.handle_misfires(state).await?;

        Ok(())
    }

    /// Get schedules that are due for execution
    async fn get_due_schedules(&self, state: &Arc<ApiState>) -> anyhow::Result<Vec<Schedule>> {
        let now = Utc::now();

        let schedules = sqlx::query_as::<_, Schedule>(
            r#"
            SELECT 
                id, name, description, cron_expr, natural_lang, timezone,
                job_template as "job_template: sqlx::types::Json<serde_json::Value>",
                enabled, misfire_policy, last_run_at, next_run_at, run_count, misfire_count,
                owner_id, tenant_id, region_id, created_at, updated_at
            FROM schedules
            WHERE enabled = TRUE
              AND next_run_at IS NOT NULL
              AND next_run_at <= ?
            ORDER BY next_run_at ASC
            LIMIT ?
            "#,
        )
        .bind(now)
        .bind(self.config.max_schedules_per_tick)
        .fetch_all(&state.db)
        .await?;

        Ok(schedules)
    }

    /// Process a single schedule (check if due and trigger)
    async fn process_schedule(
        &self,
        state: &Arc<ApiState>,
        schedule: &Schedule,
    ) -> anyhow::Result<()> {
        info!("Processing schedule: {} ({})", schedule.id, schedule.name);

        let now = Utc::now();

        // Calculate next run time
        let next_run = self.calculate_next_run(schedule).await?;

        // Determine region for this run
        let region_id = if self.config.multi_region_enabled {
            self.select_region_for_schedule(state, schedule).await?
        } else {
            self.config.default_region.clone()
        };

        if let Some(ref r) = region_id {
            debug!("Selected region '{}' for schedule {}", r, schedule.id);
        }

        // Trigger the run directly in the database
        let trigger_result = self.trigger_run(state, schedule, region_id).await;

        match trigger_result {
            Ok(run_id) => {
                info!("Triggered run {} for schedule {}", run_id, schedule.id);

                // Update schedule status
                self.update_schedule_after_run(state, schedule, now, next_run)
                    .await?;
            }
            Err(e) => {
                error!("Failed to trigger run for schedule {}: {}", schedule.id, e);

                // Still update next_run_at to prevent infinite retries
                self.update_schedule_next_run(state, schedule, next_run).await?;
            }
        }

        Ok(())
    }

    /// Select appropriate region for a schedule
    async fn select_region_for_schedule(
        &self,
        state: &Arc<ApiState>,
        schedule: &Schedule,
    ) -> anyhow::Result<Option<String>> {
        // If schedule has explicit region preference, use it (if active)
        if let Some(ref region_id) = schedule.region_id {
            let is_active: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM regions WHERE id = ? AND active = TRUE)"
            )
            .bind(region_id)
            .fetch_one(&state.db)
            .await?;

            if is_active {
                return Ok(Some(region_id.clone()));
            } else {
                warn!(
                    "Schedule {} preferred region '{}' is inactive, selecting alternative",
                    schedule.id, region_id
                );
            }
        }

        // Otherwise, auto-select based on criteria
        self.select_best_region(state).await
    }

    /// Select the best region based on capacity, proximity, and cost
    async fn select_best_region(
        &self,
        state: &Arc<ApiState>,
    ) -> anyhow::Result<Option<String>> {
        // Get all active regions with capacity info
        let regions = sqlx::query_as::<_, Region>(
            r#"
            SELECT 
                r.id, r.name, r.provider, r.endpoint, r.capacity, r.active,
                r.cost_factor, r.location_lat, r.location_lon, r.metadata,
                r.created_at, r.updated_at
            FROM regions r
            WHERE r.active = TRUE
            "#
        )
        .fetch_all(&state.db)
        .await?;

        if regions.is_empty() {
            warn!("No active regions available for scheduling");
            return Ok(self.config.default_region.clone());
        }

        // Get capacity info for each region
        let mut candidates = Vec::new();
        for region in &regions {
            let capacity_info: Option<(i32, i32)> = sqlx::query_as(
                "SELECT COALESCE(current_runs, 0), COALESCE(queued_runs, 0) FROM region_capacity WHERE region_id = ?"
            )
            .bind(&region.id)
            .fetch_optional(&state.db)
            .await?;

            let (current, queued) = capacity_info.unwrap_or((0, 0));
            let available = region.capacity - current - queued;

            if available > 0 {
                candidates.push((region.clone(), available));
            }
        }

        if candidates.is_empty() {
            warn!("All regions at capacity, using default region");
            return Ok(self.config.default_region.clone());
        }

        // Select based on criteria
        let selected = if self.config.cost_optimization {
            // Select cheapest region with capacity
            candidates
                .into_iter()
                .min_by(|a, b| {
                    a.0.cost_factor
                        .partial_cmp(&b.0.cost_factor)
                        .unwrap_or(std::cmp::Ordering::Equal)
                })
                .map(|(r, _)| r.id)
        } else if let Some((user_lat, user_lon)) = self.config.user_location {
            // Select closest region with capacity
            let closest = candidates
                .iter()
                .filter_map(|(r, available)| {
                    r.location_lat.and_then(|lat| {
                        r.location_lon.map(|lon| {
                            let dist = haversine_distance(user_lat, user_lon, lat, lon);
                            (r.clone(), *available, dist)
                        })
                    })
                })
                .min_by(|a, b| a.2.partial_cmp(&b.2).unwrap_or(std::cmp::Ordering::Equal))
                .map(|(r, _, _)| r.id);
            
            closest.or_else(|| {
                // Fallback to capacity if no location data
                candidates
                    .into_iter()
                    .max_by_key(|(_, available)| *available)
                    .map(|(r, _)| r.id)
            })
        } else {
            // Select region with most available capacity
            candidates
                .into_iter()
                .max_by_key(|(_, available)| *available)
                .map(|(r, _)| r.id)
        };

        Ok(selected.or_else(|| self.config.default_region.clone()))
    }

    /// Calculate next run time for a schedule using cron parser
    async fn calculate_next_run(
        &self,
        schedule: &Schedule,
    ) -> anyhow::Result<Option<chrono::DateTime<Utc>>> {
        use std::str::FromStr;
        use chrono_tz::Tz;

        // Parse the cron expression
        let cron = cron::Schedule::from_str(&schedule.cron_expr)
            .map_err(|e| anyhow::anyhow!("Invalid cron expression '{}': {}", schedule.cron_expr, e))?;

        // Parse timezone, fallback to UTC if invalid
        let tz: Tz = schedule.timezone.parse().unwrap_or(chrono_tz::UTC);

        // Get next occurrence in target timezone after now
        let next = cron.upcoming(tz).next()
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .ok_or_else(|| anyhow::anyhow!("Failed to calculate next occurrence"))?;

        Ok(Some(next))
    }
    /// Trigger a run for a schedule - creates run directly in database
    async fn trigger_run(
        &self,
        state: &Arc<ApiState>,
        schedule: &Schedule,
        region_id: Option<String>,
    ) -> anyhow::Result<String> {
        let run_id = uuid::Uuid::new_v4().to_string();
        let now = Utc::now();

        // Create run directly in database instead of via HTTP API
        sqlx::query(
            r#"
            INSERT INTO runs (
                id, name, description, mode, status, step_cursor, total_steps, completed_steps,
                config, owner_id, tenant_id, runtime_id, runtime_type, schedule_id, region_id,
                created_at, updated_at, started_at, completed_at, error_message, error_details
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&run_id)
        .bind(format!("Scheduled: {}", schedule.name))
        .bind(&schedule.description)
        .bind("remote")
        .bind("queued") // Start as queued, will be picked up by runtime
        .bind(None::<String>)
        .bind(None::<i32>)
        .bind(0i32)
        .bind(&schedule.job_template)
        .bind(&schedule.owner_id)
        .bind(&schedule.tenant_id)
        .bind(None::<String>) // runtime_id - will be assigned by orchestrator
        .bind(None::<String>) // runtime_type
        .bind(&schedule.id)
        .bind(&region_id) // region_id for multi-region scheduling
        .bind(now)
        .bind(now)
        .bind(None::<chrono::DateTime<Utc>>)
        .bind(None::<chrono::DateTime<Utc>>)
        .bind(None::<String>)
        .bind(None::<String>)
        .execute(&state.db)
        .await?;

        // Initialize cost tracking for the run
        // Use defaults - in a full implementation these would come from 
        // schedule configuration or target pool settings
        let provider = "hetzner";
        let region = region_id.as_deref().unwrap_or("fsn1");
        let instance_type = "cx11";
        
        let _ = crate::services::init_run_cost_tracking(
            &state.db,
            &run_id,
            provider,
            region,
            instance_type,
        ).await;
        
        // Emit run created event
        let _ = crate::services::EventStore::append(
            state.event_store.as_ref(),
            &run_id,
            crate::db::cowork_models::EventType::RunCreated,
            serde_json::json!({
                "schedule_id": schedule.id,
                "schedule_name": schedule.name,
                "triggered_at": now,
                "region_id": region_id,
            }),
        )
        .await;

        Ok(run_id)
    }

    /// Update schedule after successful run
    async fn update_schedule_after_run(
        &self,
        state: &Arc<ApiState>,
        schedule: &Schedule,
        last_run: chrono::DateTime<Utc>,
        next_run: Option<chrono::DateTime<Utc>>,
    ) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            UPDATE schedules
            SET last_run_at = ?, next_run_at = ?, run_count = run_count + 1, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(last_run)
        .bind(next_run)
        .bind(Utc::now())
        .bind(&schedule.id)
        .execute(&state.db)
        .await?;

        Ok(())
    }

    /// Update just the next_run_at field
    async fn update_schedule_next_run(
        &self,
        state: &Arc<ApiState>,
        schedule: &Schedule,
        next_run: Option<chrono::DateTime<Utc>>,
    ) -> anyhow::Result<()> {
        sqlx::query(
            "UPDATE schedules SET next_run_at = ?, updated_at = ? WHERE id = ?",
        )
        .bind(next_run)
        .bind(Utc::now())
        .bind(&schedule.id)
        .execute(&state.db)
        .await?;

        Ok(())
    }

    /// Handle misfired schedules
    async fn handle_misfires(&self, state: &Arc<ApiState>) -> anyhow::Result<()> {
        let now = Utc::now();
        let threshold = chrono::Duration::seconds(self.config.misfire_threshold_secs);

        // Find schedules that should have run but didn't
        let misfired = sqlx::query_as::<_, Schedule>(
            r#"
            SELECT 
                id, name, description, cron_expr, natural_lang, timezone,
                job_template as "job_template: sqlx::types::Json<serde_json::Value>",
                enabled, misfire_policy, last_run_at, next_run_at, run_count, misfire_count,
                owner_id, tenant_id, region_id, created_at, updated_at
            FROM schedules
            WHERE enabled = TRUE
              AND next_run_at IS NOT NULL
              AND next_run_at < ?
              AND (last_run_at IS NULL OR last_run_at < next_run_at)
            "#,
        )
        .bind(now - threshold)
        .fetch_all(&state.db)
        .await?;

        for schedule in misfired {
            warn!("Misfired schedule: {} ({})", schedule.id, schedule.name);

            match self.handle_misfire(&schedule) {
                MisfireAction::Ignore => {
                    // Just update next_run_at
                    if let Ok(next_run) = self.calculate_next_run(&schedule).await {
                        let _ = self.update_schedule_next_run(state, &schedule, next_run).await;
                    }
                }
                MisfireAction::FireOnce => {
                    // Trigger one run
                    let _ = self.process_schedule(state, &schedule).await;
                }
                MisfireAction::FireAll { count: _ } => {
                    // Trigger multiple runs (rare case)
                    warn!("Firing misfired run for {}", schedule.id);
                    let _ = self.process_schedule(state, &schedule).await;
                }
            }

            // Increment misfire count
            sqlx::query("UPDATE schedules SET misfire_count = misfire_count + 1 WHERE id = ?")
                .bind(&schedule.id)
                .execute(&state.db)
                .await?;
        }

        Ok(())
    }

    /// Handle misfire based on policy
    fn handle_misfire(&self, _schedule: &Schedule) -> MisfireAction {
        // Use config misfire policy
        match self.config.misfire_policy {
            MisfirePolicy::Ignore => MisfireAction::Ignore,
            MisfirePolicy::FireOnce => MisfireAction::FireOnce,
            MisfirePolicy::FireAll => {
                // Calculate how many runs were missed (simplified)
                MisfireAction::FireAll { count: 1 }
            }
        }
    }
}

/// Calculate Haversine distance between two points (in km)
fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6371.0; // Earth's radius in km

    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();
    let delta_lat = (lat2 - lat1).to_radians();
    let delta_lon = (lon2 - lon1).to_radians();

    let a = (delta_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (delta_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    R * c
}

/// Initialize and start the scheduler service
pub fn start_scheduler_service(state: Arc<ApiState>, config: SchedulerConfig) {
    let service = SchedulerService::new(config);
    service.start(state);
}
