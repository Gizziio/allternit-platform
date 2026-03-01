use crate::brain::types::{BrainConfig, BrainEvent, BrainType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tokio::sync::{broadcast, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capability {
    pub id: String,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainProfile {
    pub config: BrainConfig,
    pub capabilities: Vec<String>,
    pub cost_tier: u8, // 0 for local, 1 for cheap api, 2 for expensive
    pub privacy_level: PrivacyLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PrivacyLevel {
    LocalOnly,
    CloudOk,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrainPlan {
    pub primary: BrainConfig,
    pub fallbacks: Vec<BrainConfig>,
    pub requirements_met: bool,
    pub missing_requirements: Vec<String>,
}

#[derive(Debug)]
pub struct ModelRouter {
    profiles: RwLock<Vec<BrainProfile>>,
    integration_events: broadcast::Sender<BrainEvent>,
}

impl ModelRouter {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            profiles: RwLock::new(Vec::new()),
            integration_events: tx,
        }
    }

    pub fn with_integration_events(tx: broadcast::Sender<BrainEvent>) -> Self {
        Self {
            profiles: RwLock::new(Vec::new()),
            integration_events: tx,
        }
    }

    pub fn subscribe_integration_events(&self) -> broadcast::Receiver<BrainEvent> {
        self.integration_events.subscribe()
    }

    pub async fn register_profile(&self, profile: BrainProfile) {
        let profile_id = profile.config.id.clone();
        let mut profiles = self.profiles.write().await;
        profiles.push(profile);

        // Emit integration event for UI feedback
        tracing::info!(
            "[BrainRouter] Emitting IntegrationProfileRegistered for: {}",
            profile_id
        );
        let _ = self
            .integration_events
            .send(BrainEvent::IntegrationProfileRegistered {
                profile_id,
                event_id: None,
            });
    }

    pub async fn list_profiles(&self) -> Vec<BrainProfile> {
        let profiles = self.profiles.read().await;
        profiles.clone()
    }

    pub async fn select_brain(
        &self,
        intent: &str,
        preferred_type: Option<BrainType>,
    ) -> Option<BrainPlan> {
        // Simple routing logic:
        // 1. If preferred_type is given, find the best profile of that type
        // 2. Otherwise, use a simple task classification (e.g. if "code" in intent, prefer CLI)

        let mut candidates = {
            let profiles = self.profiles.read().await;
            profiles.clone()
        };

        if let Some(pt) = preferred_type {
            candidates.retain(|p| p.config.brain_type == pt);
        }

        if candidates.is_empty() {
            return None;
        }

        // Sort by cost tier (lower first) for now
        candidates.sort_by_key(|p| p.cost_tier);

        let primary = candidates.remove(0);
        let fallbacks = candidates.into_iter().map(|p| p.config).collect();

        Some(BrainPlan {
            primary: primary.config,
            fallbacks,
            requirements_met: true, // TODO: Implement check_requirements
            missing_requirements: Vec::new(),
        })
    }
}
