//! Feature Flag System for OpenClaw Strangler Migration
//!
//! Phase 3 (Graduate): Feature flags control whether native Allternit or OpenClaw
//! is the primary implementation. This allows gradual rollout and easy rollback.
//!
//! Architecture LOCK 4: Feature flags gate all graduated components.
//! No component graduates without a feature flag.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Feature flag for a strangler component
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentFeatureFlag {
    /// Component name (e.g., "skill-registry")
    pub component: String,

    /// Whether the native implementation is primary
    pub native_primary: bool,

    /// Percentage of traffic to route to native (0-100)
    pub native_traffic_percent: u8,

    /// Whether to fall back to OpenClaw on native errors
    pub fallback_on_error: bool,

    /// Minimum parity percentage required for graduation
    pub min_parity_percent: f64,

    /// Current measured parity percentage
    pub current_parity_percent: Option<f64>,

    /// When the flag was last updated
    pub last_updated: chrono::DateTime<chrono::Utc>,

    /// Who last updated the flag
    pub updated_by: String,

    /// Notes about the flag state
    pub notes: String,
}

impl ComponentFeatureFlag {
    /// Create a new feature flag for Quarantine phase
    pub fn quarantine(component: &str) -> Self {
        Self {
            component: component.to_string(),
            native_primary: false,
            native_traffic_percent: 0,
            fallback_on_error: true,
            min_parity_percent: 95.0,
            current_parity_percent: None,
            last_updated: chrono::Utc::now(),
            updated_by: "system".to_string(),
            notes: "Quarantine phase - OpenClaw only".to_string(),
        }
    }

    /// Create a new feature flag for Bridge phase
    pub fn bridge(component: &str) -> Self {
        Self {
            component: component.to_string(),
            native_primary: false,
            native_traffic_percent: 0,
            fallback_on_error: true,
            min_parity_percent: 95.0,
            current_parity_percent: None,
            last_updated: chrono::Utc::now(),
            updated_by: "system".to_string(),
            notes: "Bridge phase - native stub".to_string(),
        }
    }

    /// Create a new feature flag for DualRun phase
    pub fn dualrun(component: &str) -> Self {
        Self {
            component: component.to_string(),
            native_primary: false,
            native_traffic_percent: 50,
            fallback_on_error: true,
            min_parity_percent: 95.0,
            current_parity_percent: None,
            last_updated: chrono::Utc::now(),
            updated_by: "system".to_string(),
            notes: "DualRun phase - 50/50 split".to_string(),
        }
    }

    /// Create a new feature flag for Graduate phase
    pub fn graduate(component: &str) -> Self {
        Self {
            component: component.to_string(),
            native_primary: true,
            native_traffic_percent: 100,
            fallback_on_error: true,
            min_parity_percent: 95.0,
            current_parity_percent: Some(98.0),
            last_updated: chrono::Utc::now(),
            updated_by: "system".to_string(),
            notes: "Graduate phase - native primary with fallback".to_string(),
        }
    }

    /// Create a new feature flag for Complete phase
    pub fn complete(component: &str) -> Self {
        Self {
            component: component.to_string(),
            native_primary: true,
            native_traffic_percent: 100,
            fallback_on_error: false,
            min_parity_percent: 95.0,
            current_parity_percent: Some(99.0),
            last_updated: chrono::Utc::now(),
            updated_by: "system".to_string(),
            notes: "Complete phase - native only".to_string(),
        }
    }

    /// Check if the component is ready to graduate
    pub fn can_graduate(&self) -> bool {
        if let Some(parity) = self.current_parity_percent {
            parity >= self.min_parity_percent
        } else {
            false
        }
    }

    /// Update parity measurement
    pub fn update_parity(&mut self, parity: f64) {
        self.current_parity_percent = Some(parity);
        self.last_updated = chrono::Utc::now();
    }

    /// Set native as primary (Graduate phase)
    pub fn set_native_primary(&mut self, primary: bool) {
        self.native_primary = primary;
        self.native_traffic_percent = if primary { 100 } else { 0 };
        self.last_updated = chrono::Utc::now();
    }

    /// Set traffic split for canary deployment
    pub fn set_traffic_split(&mut self, native_percent: u8) {
        self.native_traffic_percent = native_percent.min(100);
        self.native_primary = native_percent >= 50;
        self.last_updated = chrono::Utc::now();
    }
}

/// Feature flag registry
#[derive(Debug, Clone)]
pub struct FeatureFlagRegistry {
    flags: Arc<RwLock<HashMap<String, ComponentFeatureFlag>>>,
}

impl FeatureFlagRegistry {
    /// Create a new feature flag registry
    pub fn new() -> Self {
        Self {
            flags: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Initialize default flags for all components
    pub fn initialize_defaults(&self) {
        let components = vec![
            "skill-registry",
            "session-manager",
            "gateway-bridge",
            "provider-router",
        ];

        let mut flags = self.flags.write().unwrap();
        for component in components {
            flags.insert(
                component.to_string(),
                ComponentFeatureFlag::quarantine(component),
            );
        }
    }

    /// Get a feature flag
    pub fn get(&self, component: &str) -> Option<ComponentFeatureFlag> {
        self.flags.read().unwrap().get(component).cloned()
    }

    /// Set a feature flag
    pub fn set(&self, flag: ComponentFeatureFlag) {
        let mut flags = self.flags.write().unwrap();
        flags.insert(flag.component.clone(), flag);
    }

    /// Update a feature flag
    pub fn update<F>(&self, component: &str, f: F) -> anyhow::Result<()>
    where
        F: FnOnce(&mut ComponentFeatureFlag),
    {
        let mut flags = self.flags.write().unwrap();
        if let Some(flag) = flags.get_mut(component) {
            f(flag);
            Ok(())
        } else {
            Err(anyhow::anyhow!(
                "Feature flag not found for component: {}",
                component
            ))
        }
    }

    /// Check if native is primary for a component
    pub fn is_native_primary(&self, component: &str) -> bool {
        self.get(component)
            .map(|f| f.native_primary)
            .unwrap_or(false)
    }

    /// Get traffic split for a component
    pub fn get_traffic_split(&self, component: &str) -> u8 {
        self.get(component)
            .map(|f| f.native_traffic_percent)
            .unwrap_or(0)
    }

    /// Should we fall back to OpenClaw on error?
    pub fn should_fallback(&self, component: &str) -> bool {
        self.get(component)
            .map(|f| f.fallback_on_error)
            .unwrap_or(true)
    }

    /// List all feature flags
    pub fn list_all(&self) -> Vec<ComponentFeatureFlag> {
        self.flags.read().unwrap().values().cloned().collect()
    }

    /// List components ready to graduate
    pub fn ready_to_graduate(&self) -> Vec<String> {
        self.flags
            .read()
            .unwrap()
            .values()
            .filter(|f| f.can_graduate() && !f.native_primary)
            .map(|f| f.component.clone())
            .collect()
    }

    /// List graduated components
    pub fn graduated_components(&self) -> Vec<String> {
        self.flags
            .read()
            .unwrap()
            .values()
            .filter(|f| f.native_primary)
            .map(|f| f.component.clone())
            .collect()
    }

    /// Graduate a component to native primary
    pub fn graduate_component(&self, component: &str, updated_by: &str) -> anyhow::Result<()> {
        self.update(component, |flag| {
            flag.set_native_primary(true);
            flag.updated_by = updated_by.to_string();
            flag.notes = format!("Graduated to native primary on {}", chrono::Utc::now());
        })
    }

    /// Rollback a component to OpenClaw primary
    pub fn rollback_component(&self, component: &str, updated_by: &str) -> anyhow::Result<()> {
        self.update(component, |flag| {
            flag.set_native_primary(false);
            flag.updated_by = updated_by.to_string();
            flag.notes = format!("Rolled back to OpenClaw primary on {}", chrono::Utc::now());
        })
    }

    /// Set canary deployment traffic split
    pub fn set_canary(
        &self,
        component: &str,
        native_percent: u8,
        updated_by: &str,
    ) -> anyhow::Result<()> {
        self.update(component, |flag| {
            flag.set_traffic_split(native_percent);
            flag.updated_by = updated_by.to_string();
            flag.notes = format!("Canary deployment: {}% native", native_percent);
        })
    }
}

impl Default for FeatureFlagRegistry {
    fn default() -> Self {
        let registry = Self::new();
        registry.initialize_defaults();
        registry
    }
}

/// Global feature flag registry (singleton)
lazy_static::lazy_static! {
    static ref GLOBAL_REGISTRY: FeatureFlagRegistry = FeatureFlagRegistry::default();
}

/// Get the global feature flag registry
pub fn global_registry() -> &'static FeatureFlagRegistry {
    &GLOBAL_REGISTRY
}

/// Traffic router for canary deployments
pub struct TrafficRouter {
    registry: FeatureFlagRegistry,
}

impl TrafficRouter {
    /// Create a new traffic router
    pub fn new(registry: FeatureFlagRegistry) -> Self {
        Self { registry }
    }

    /// Route a request to native or OpenClaw based on traffic split
    /// Returns true if should route to native, false for OpenClaw
    pub fn should_route_native(&self, component: &str, request_id: Option<&str>) -> bool {
        let flag = match self.registry.get(component) {
            Some(f) => f,
            None => return false,
        };

        // If native is primary and 100% traffic, always route native
        if flag.native_primary && flag.native_traffic_percent == 100 {
            return true;
        }

        // If 0% native traffic, always route to OpenClaw
        if flag.native_traffic_percent == 0 {
            return false;
        }

        // Deterministic routing based on request_id if provided
        // Otherwise use random
        let hash = match request_id {
            Some(id) => {
                // Use a simple hash of the request_id
                id.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32))
            }
            None => {
                // Use random value
                rand::random::<u32>()
            }
        };

        let bucket = (hash % 100) as u8;
        bucket < flag.native_traffic_percent
    }
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[test]
    fn test_feature_flag_phases() {
        let quarantine = ComponentFeatureFlag::quarantine("test");
        assert!(!quarantine.native_primary);
        assert_eq!(quarantine.native_traffic_percent, 0);

        let dualrun = ComponentFeatureFlag::dualrun("test");
        assert!(!dualrun.native_primary);
        assert_eq!(dualrun.native_traffic_percent, 50);

        let graduate = ComponentFeatureFlag::graduate("test");
        assert!(graduate.native_primary);
        assert_eq!(graduate.native_traffic_percent, 100);

        let complete = ComponentFeatureFlag::complete("test");
        assert!(complete.native_primary);
        assert!(!complete.fallback_on_error);
    }

    #[test]
    fn test_can_graduate() {
        let mut flag = ComponentFeatureFlag::dualrun("test");
        assert!(!flag.can_graduate());

        flag.update_parity(96.0);
        assert!(flag.can_graduate());

        flag.update_parity(94.0);
        assert!(!flag.can_graduate());
    }

    #[test]
    fn test_feature_flag_registry() {
        let registry = FeatureFlagRegistry::new();
        registry.initialize_defaults();

        // Check default flags exist
        assert!(registry.get("skill-registry").is_some());
        assert!(registry.get("session-manager").is_some());

        // Check default state
        assert!(!registry.is_native_primary("skill-registry"));
        assert_eq!(registry.get_traffic_split("skill-registry"), 0);

        // Graduate a component
        registry
            .graduate_component("skill-registry", "test-user")
            .unwrap();
        assert!(registry.is_native_primary("skill-registry"));

        // Rollback
        registry
            .rollback_component("skill-registry", "test-user")
            .unwrap();
        assert!(!registry.is_native_primary("skill-registry"));
    }

    #[test]
    fn test_traffic_router() {
        let registry = FeatureFlagRegistry::new();
        registry.initialize_defaults();

        let router = TrafficRouter::new(registry.clone());

        // Default is quarantine (0% native)
        assert!(!router.should_route_native("skill-registry", None));

        // Set to 100% native
        registry.set_canary("skill-registry", 100, "test").unwrap();
        assert!(router.should_route_native("skill-registry", None));

        // Set to 50% native
        registry.set_canary("skill-registry", 50, "test").unwrap();
        // With request_id, routing is deterministic
        let route_native = router.should_route_native("skill-registry", Some("req-1"));
        // Same request_id should give same result
        assert_eq!(
            route_native,
            router.should_route_native("skill-registry", Some("req-1"))
        );
    }
}
