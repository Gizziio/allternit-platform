//! Misfire handling for missed schedules
//!
//! When the scheduler is down or delayed, schedules may be missed.
//! This module handles different misfire policies.

use crate::scheduler::Schedule;
use crate::MisfirePolicy;

/// Action to take for a misfired schedule
#[derive(Debug, Clone)]
pub enum MisfireAction {
    /// Ignore the misfire and move on
    Ignore,
    /// Fire the schedule once (default)
    FireOnce,
    /// Fire the schedule for all missed occurrences
    FireAll { count: usize },
}

/// Handle a misfired schedule based on policy
pub fn handle_misfire(schedule: &Schedule, policy: MisfirePolicy) -> MisfireAction {
    // Also respect schedule-level policy if set
    let effective_policy = parse_schedule_policy(&schedule.misfire_policy)
        .unwrap_or(policy);
    
    match effective_policy {
        MisfirePolicy::Ignore => {
            tracing::info!("Ignoring misfire for schedule {}", schedule.id);
            MisfireAction::Ignore
        }
        MisfirePolicy::FireOnce => {
            tracing::info!("Firing once for misfired schedule {}", schedule.id);
            MisfireAction::FireOnce
        }
        MisfirePolicy::FireAll => {
            // Calculate how many runs were missed
            let missed_count = calculate_missed_count(schedule);
            tracing::info!(
                "Firing all {} missed runs for schedule {}",
                missed_count, schedule.id
            );
            MisfireAction::FireAll { count: missed_count }
        }
    }
}

/// Parse misfire policy string
fn parse_schedule_policy(policy: &str) -> Option<MisfirePolicy> {
    match policy.to_lowercase().as_str() {
        "ignore" => Some(MisfirePolicy::Ignore),
        "fire_once" => Some(MisfirePolicy::FireOnce),
        "fire_all" => Some(MisfirePolicy::FireAll),
        _ => None,
    }
}

/// Calculate how many runs were missed
fn calculate_missed_count(schedule: &Schedule) -> usize {
    use chrono::Duration;
    
    let now = chrono::Utc::now();
    let last_run = schedule.last_run_at.unwrap_or(schedule.created_at);
    let next_run = schedule.next_run_at.unwrap_or(now);
    
    if next_run >= now {
        return 0;
    }
    
    // Estimate based on schedule frequency
    // This is a rough estimate - proper calculation would parse the cron expression
    let time_since_last_run = now.signed_duration_since(last_run);
    let time_between_runs = next_run.signed_duration_since(last_run);
    
    if time_between_runs.num_seconds() <= 0 {
        return 1; // Default to 1 if we can't calculate
    }
    
    let missed = time_since_last_run.num_seconds() / time_between_runs.num_seconds();
    missed.max(1) as usize // At least 1 if we're in misfire handling
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn create_test_schedule(misfire_policy: &str) -> Schedule {
        Schedule {
            id: "test-123".to_string(),
            name: "Test Schedule".to_string(),
            description: None,
            cron_expr: "0 * * * *".to_string(),
            natural_lang: None,
            timezone: "UTC".to_string(),
            job_template: sqlx::types::Json(serde_json::json!({})),
            enabled: true,
            misfire_policy: misfire_policy.to_string(),
            last_run_at: Some(Utc::now() - chrono::Duration::hours(2)),
            next_run_at: Some(Utc::now() - chrono::Duration::hours(1)),
            run_count: 0,
            misfire_count: 0,
            owner_id: None,
            tenant_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_handle_misfire_ignore() {
        let schedule = create_test_schedule("ignore");
        let action = handle_misfire(&schedule, MisfirePolicy::FireOnce);
        
        assert!(matches!(action, MisfireAction::Ignore));
    }

    #[test]
    fn test_handle_misfire_fire_once() {
        let schedule = create_test_schedule("fire_once");
        let action = handle_misfire(&schedule, MisfirePolicy::Ignore);
        
        assert!(matches!(action, MisfireAction::FireOnce));
    }

    #[test]
    fn test_handle_misfire_default_policy() {
        let schedule = create_test_schedule("invalid");
        // Should use default policy when schedule policy is invalid
        let action = handle_misfire(&schedule, MisfirePolicy::FireOnce);
        
        assert!(matches!(action, MisfireAction::FireOnce));
    }
}
