//! Identity management for WASM backend

use serde::{Serialize, Deserialize};
use crate::wasm::storage::BrowserStorage;
use crate::Result;

/// Agent identity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Identity {
    pub name: String,
    pub role: String,
    pub capabilities: Vec<String>,
    pub preferences: Option<serde_json::Value>,
    pub soul: Option<SoulConfig>,
}

impl Default for Identity {
    fn default() -> Self {
        Self {
            name: "A2R Agent".to_string(),
            role: "assistant".to_string(),
            capabilities: vec!["code".to_string(), "analysis".to_string(), "planning".to_string()],
            preferences: None,
            soul: Some(SoulConfig::default()),
        }
    }
}

/// Soul configuration (personality, values)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoulConfig {
    pub values: Vec<String>,
    pub personality: String,
    pub communication_style: String,
    pub working_preferences: WorkingPreferences,
}

impl Default for SoulConfig {
    fn default() -> Self {
        Self {
            values: vec![
                "helpful".to_string(),
                "honest".to_string(),
                "harmless".to_string(),
                "thorough".to_string(),
            ],
            personality: "Professional and thorough".to_string(),
            communication_style: "Clear and concise".to_string(),
            working_preferences: WorkingPreferences::default(),
        }
    }
}

/// Working preferences
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingPreferences {
    pub detail_level: String,  // "brief", "detailed", "comprehensive"
    pub proactive: bool,
    pub ask_before_acting: bool,
    pub preferred_languages: Vec<String>,
    pub session_memory: bool,
}

impl Default for WorkingPreferences {
    fn default() -> Self {
        Self {
            detail_level: "detailed".to_string(),
            proactive: true,
            ask_before_acting: true,
            preferred_languages: vec!["rust".to_string(), "typescript".to_string()],
            session_memory: true,
        }
    }
}

/// Identity manager
pub struct IdentityManager {
    storage: BrowserStorage,
    workspace_id: String,
}

impl IdentityManager {
    /// Create new identity manager
    pub fn new(storage: BrowserStorage, workspace_id: &str) -> Self {
        Self {
            storage,
            workspace_id: workspace_id.to_string(),
        }
    }
    
    fn identity_key(&self) -> String {
        format!("{}/identity", self.workspace_id)
    }
    
    /// Initialize default identity if none exists
    pub fn init_default(&self) -> Result<Identity> {
        match self.get_identity()? {
            Some(identity) => Ok(identity),
            None => {
                let default = Identity::default();
                self.storage.set(&self.identity_key(), &default)?;
                Ok(default)
            }
        }
    }
    
    /// Get current identity
    pub fn get_identity(&self) -> Result<Option<Identity>> {
        self.storage.get(&self.identity_key())
    }
    
    /// Update identity
    pub fn update_identity(&self, updates: IdentityUpdate) -> Result<Identity> {
        let mut identity = self.get_identity()?.unwrap_or_default();
        
        if let Some(name) = updates.name {
            identity.name = name;
        }
        if let Some(role) = updates.role {
            identity.role = role;
        }
        if let Some(capabilities) = updates.capabilities {
            identity.capabilities = capabilities;
        }
        if let Some(preferences) = updates.preferences {
            identity.preferences = Some(preferences);
        }
        if let Some(soul) = updates.soul {
            identity.soul = Some(soul);
        }
        
        self.storage.set(&self.identity_key(), &identity)?;
        Ok(identity)
    }
    
    /// Update soul configuration
    pub fn update_soul(&self, updates: SoulUpdate) -> Result<Identity> {
        let mut identity = self.get_identity()?.unwrap_or_default();
        let mut soul = identity.soul.unwrap_or_default();
        
        if let Some(values) = updates.values {
            soul.values = values;
        }
        if let Some(personality) = updates.personality {
            soul.personality = personality;
        }
        if let Some(style) = updates.communication_style {
            soul.communication_style = style;
        }
        if let Some(prefs) = updates.working_preferences {
            soul.working_preferences = prefs;
        }
        
        identity.soul = Some(soul);
        self.storage.set(&self.identity_key(), &identity)?;
        Ok(identity)
    }
    
    /// Add capability
    pub fn add_capability(&self, capability: impl Into<String>) -> Result<Identity> {
        let mut identity = self.get_identity()?.unwrap_or_default();
        let cap = capability.into();
        if !identity.capabilities.contains(&cap) {
            identity.capabilities.push(cap);
            self.storage.set(&self.identity_key(), &identity)?;
        }
        Ok(identity)
    }
    
    /// Remove capability
    pub fn remove_capability(&self, capability: &str) -> Result<Identity> {
        let mut identity = self.get_identity()?.unwrap_or_default();
        identity.capabilities.retain(|c| c != capability);
        self.storage.set(&self.identity_key(), &identity)?;
        Ok(identity)
    }
    
    /// Check if has capability
    pub fn has_capability(&self, capability: &str) -> Result<bool> {
        match self.get_identity()? {
            Some(identity) => Ok(identity.capabilities.contains(&capability.to_string())),
            None => Ok(false),
        }
    }
    
    /// Get working preferences
    pub fn get_working_preferences(&self) -> Result<WorkingPreferences> {
        match self.get_identity()? {
            Some(identity) => {
                Ok(identity.soul.map(|s| s.working_preferences).unwrap_or_default())
            }
            None => Ok(WorkingPreferences::default()),
        }
    }
    
    /// Reset to defaults
    pub fn reset(&self) -> Result<Identity> {
        let default = Identity::default();
        self.storage.set(&self.identity_key(), &default)?;
        Ok(default)
    }
}

/// Identity update input
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IdentityUpdate {
    pub name: Option<String>,
    pub role: Option<String>,
    pub capabilities: Option<Vec<String>>,
    pub preferences: Option<serde_json::Value>,
    pub soul: Option<SoulConfig>,
}

/// Soul update input
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SoulUpdate {
    pub values: Option<Vec<String>>,
    pub personality: Option<String>,
    pub communication_style: Option<String>,
    pub working_preferences: Option<WorkingPreferences>,
}
