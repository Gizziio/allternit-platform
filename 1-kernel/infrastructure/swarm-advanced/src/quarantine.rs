//! Quarantine Protocol
//!
//! Isolates faulty agents to prevent cascading failures.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

/// Quarantined agent information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuarantinedAgent {
    pub agent_id: String,
    pub quarantined_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub reason: String,
    pub quarantine_duration_mins: u64,
}

impl QuarantinedAgent {
    /// Check if quarantine has expired
    pub fn is_expired(&self) -> bool {
        Utc::now() >= self.expires_at
    }

    /// Get remaining quarantine time in minutes
    pub fn remaining_minutes(&self) -> i64 {
        let remaining = self.expires_at.signed_duration_since(Utc::now());
        remaining.num_minutes()
    }
}

/// Quarantine manager for isolating faulty agents
pub struct QuarantineManager {
    quarantined: Arc<RwLock<HashMap<String, QuarantinedAgent>>>,
    default_duration_mins: u64,
}

impl QuarantineManager {
    /// Create a new quarantine manager
    pub fn new(default_duration_mins: u64) -> Self {
        Self {
            quarantined: Arc::new(RwLock::new(HashMap::new())),
            default_duration_mins,
        }
    }

    /// Quarantine an agent
    pub async fn quarantine(&self, agent_id: &str) {
        self.quarantine_with_reason(agent_id, "Circuit breaker opened")
            .await;
    }

    /// Quarantine an agent with a specific reason
    pub async fn quarantine_with_reason(&self, agent_id: &str, reason: &str) {
        let now = Utc::now();
        let expires_at = now + chrono::Duration::minutes(self.default_duration_mins as i64);

        let quarantined_agent = QuarantinedAgent {
            agent_id: agent_id.to_string(),
            quarantined_at: now,
            expires_at,
            reason: reason.to_string(),
            quarantine_duration_mins: self.default_duration_mins,
        };

        let mut q = self.quarantined.write().await;
        q.insert(agent_id.to_string(), quarantined_agent);

        warn!(
            "Agent {} quarantined for {} minutes: {}",
            agent_id, self.default_duration_mins, reason
        );
    }

    /// Release an agent from quarantine
    pub async fn release(&self, agent_id: &str) {
        let mut q = self.quarantined.write().await;
        if let Some(agent) = q.remove(agent_id) {
            info!("Agent {} released from quarantine", agent_id);
        }
    }

    /// Check if an agent is quarantined
    pub async fn is_quarantined(&self, agent_id: &str) -> bool {
        let q = self.quarantined.read().await;

        if let Some(agent) = q.get(agent_id) {
            // Check if quarantine has expired
            if agent.is_expired() {
                drop(q);
                // Auto-release expired quarantine
                self.release(agent_id).await;
                return false;
            }
            true
        } else {
            false
        }
    }

    /// Get quarantine info for an agent
    pub async fn get_quarantine_info(&self, agent_id: &str) -> Option<QuarantinedAgent> {
        let q = self.quarantined.read().await;
        q.get(agent_id).cloned()
    }

    /// Get all quarantined agents
    pub async fn get_quarantined(&self) -> Vec<QuarantinedAgent> {
        let q = self.quarantined.read().await;
        q.values().cloned().collect()
    }

    /// Get count of quarantined agents
    pub async fn count(&self) -> usize {
        let q = self.quarantined.read().await;
        q.len()
    }

    /// Clean up expired quarantines
    pub async fn cleanup_expired(&self) -> Vec<String> {
        let mut q = self.quarantined.write().await;
        let mut released = Vec::new();

        let to_remove: Vec<String> = q
            .iter()
            .filter(|(_, agent)| agent.is_expired())
            .map(|(id, _)| id.clone())
            .collect();

        for id in to_remove {
            q.remove(&id);
            released.push(id.clone());
            info!("Auto-released expired quarantine for agent {}", id);
        }

        released
    }

    /// Extend quarantine duration for an agent
    pub async fn extend(&self, agent_id: &str, additional_mins: u64) -> bool {
        let mut q = self.quarantined.write().await;

        if let Some(agent) = q.get_mut(agent_id) {
            agent.expires_at += chrono::Duration::minutes(additional_mins as i64);
            agent.quarantine_duration_mins += additional_mins;
            info!(
                "Extended quarantine for agent {} by {} minutes",
                agent_id, additional_mins
            );
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_quarantine_creation() {
        let manager = QuarantineManager::new(15);
        let agent_id = "test_agent";

        manager.quarantine(agent_id).await;
        assert!(manager.is_quarantined(agent_id).await);
    }

    #[tokio::test]
    async fn test_quarantine_release() {
        let manager = QuarantineManager::new(15);
        let agent_id = "test_agent";

        manager.quarantine(agent_id).await;
        assert!(manager.is_quarantined(agent_id).await);

        manager.release(agent_id).await;
        assert!(!manager.is_quarantined(agent_id).await);
    }

    #[tokio::test]
    async fn test_quarantine_with_reason() {
        let manager = QuarantineManager::new(30);
        let agent_id = "test_agent";

        manager
            .quarantine_with_reason(agent_id, "Manual quarantine for testing")
            .await;

        let info = manager.get_quarantine_info(agent_id).await;
        assert!(info.is_some());
        assert_eq!(info.unwrap().reason, "Manual quarantine for testing");
    }

    #[tokio::test]
    async fn test_quarantine_expiration() {
        let manager = QuarantineManager::new(1); // 1 minute for quick test
        let agent_id = "test_agent";

        manager.quarantine(agent_id).await;
        assert!(manager.is_quarantined(agent_id).await);

        // Wait for expiration
        tokio::time::sleep(tokio::time::Duration::from_secs(65)).await;

        // Should be auto-released
        assert!(!manager.is_quarantined(agent_id).await);
    }

    #[tokio::test]
    async fn test_quarantine_extension() {
        let manager = QuarantineManager::new(15);
        let agent_id = "test_agent";

        manager.quarantine(agent_id).await;

        let info_before = manager.get_quarantine_info(agent_id).await;
        let expires_before = info_before.unwrap().expires_at;

        manager.extend(agent_id, 30).await;

        let info_after = manager.get_quarantine_info(agent_id).await;
        let expires_after = info_after.unwrap().expires_at;

        // Expiration should be extended by 30 minutes
        let diff = expires_after.signed_duration_since(expires_before);
        assert!(diff.num_minutes() >= 29); // Allow some timing variance
    }

    #[tokio::test]
    async fn test_multiple_quarantines() {
        let manager = QuarantineManager::new(15);

        manager.quarantine("agent_1").await;
        manager.quarantine("agent_2").await;
        manager.quarantine("agent_3").await;

        assert_eq!(manager.count().await, 3);

        let all = manager.get_quarantined().await;
        assert_eq!(all.len(), 3);
    }

    #[tokio::test]
    async fn test_cleanup_expired() {
        let manager = QuarantineManager::new(1); // 1 minute

        manager.quarantine("agent_1").await;
        manager.quarantine("agent_2").await;

        // Wait for expiration
        tokio::time::sleep(tokio::time::Duration::from_secs(65)).await;

        let released = manager.cleanup_expired().await;
        assert_eq!(released.len(), 2);
        assert_eq!(manager.count().await, 0);
    }
}
