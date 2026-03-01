//! Configuration System Native - OC-035
//!
//! Native Rust implementation of centralized configuration management.
//! Provides a unified interface for reading and writing system configuration
//! with persistence, validation, and history tracking.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Configuration value types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
#[derive(Default)]
pub enum ConfigValue {
    String(String),
    Number(f64),
    Boolean(bool),
    Array(Vec<ConfigValue>),
    Object(HashMap<String, ConfigValue>),
    #[default]
    Null,
}

impl ConfigValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            ConfigValue::String(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            ConfigValue::Number(n) => Some(*n),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            ConfigValue::Boolean(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_array(&self) -> Option<&Vec<ConfigValue>> {
        match self {
            ConfigValue::Array(a) => Some(a),
            _ => None,
        }
    }

    pub fn as_object(&self) -> Option<&HashMap<String, ConfigValue>> {
        match self {
            ConfigValue::Object(o) => Some(o),
            _ => None,
        }
    }
}

impl From<String> for ConfigValue {
    fn from(s: String) -> Self {
        ConfigValue::String(s)
    }
}

impl From<&str> for ConfigValue {
    fn from(s: &str) -> Self {
        ConfigValue::String(s.to_string())
    }
}

impl From<f64> for ConfigValue {
    fn from(n: f64) -> Self {
        ConfigValue::Number(n)
    }
}

impl From<i64> for ConfigValue {
    fn from(n: i64) -> Self {
        ConfigValue::Number(n as f64)
    }
}

impl From<bool> for ConfigValue {
    fn from(b: bool) -> Self {
        ConfigValue::Boolean(b)
    }
}

/// Configuration entry with metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigEntry {
    pub key: String,
    pub value: ConfigValue,
    pub description: Option<String>,
    pub updated_at: DateTime<Utc>,
    pub updated_by: Option<String>,
    pub is_sensitive: bool, // If true, value is redacted in responses
}

/// Configuration change record for audit trail
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigChange {
    pub key: String,
    pub old_value: Option<ConfigValue>,
    pub new_value: ConfigValue,
    pub changed_at: DateTime<Utc>,
    pub changed_by: Option<String>,
}

/// Configuration system configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigSystemConfig {
    pub config_file: PathBuf,
    pub backup_enabled: bool,
    pub max_history_entries: usize,
    pub auto_save: bool,
    pub validate_on_set: bool,
}

impl Default for ConfigSystemConfig {
    fn default() -> Self {
        Self {
            config_file: PathBuf::from("./a2r/system/config.json"),
            backup_enabled: true,
            max_history_entries: 100,
            auto_save: true,
            validate_on_set: true,
        }
    }
}

/// Configuration operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigOperation {
    /// Get configuration value at path (dot notation, e.g., "kernel.url")
    Get { path: Option<String> },

    /// Set configuration value at path
    Set { path: String, value: ConfigValue },

    /// Delete configuration value at path
    Delete { path: String },

    /// Validate current configuration
    Validate,

    /// Apply/apply configuration changes
    Apply,

    /// Get configuration history
    GetHistory {
        path: Option<String>,
        limit: Option<usize>,
    },

    /// Get all configuration keys
    ListKeys { prefix: Option<String> },

    /// Reset configuration to defaults
    Reset { path: Option<String> },
}

/// Configuration context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigContext {
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub source: Option<String>, // "api", "cli", "ui", etc.
}

/// Configuration management request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigManagementRequest {
    pub operation: ConfigOperation,
    pub context: Option<ConfigContext>,
}

/// Configuration management response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigManagementResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Default configuration values
fn default_config() -> HashMap<String, ConfigValue> {
    let mut defaults = HashMap::new();

    // Kernel settings
    defaults.insert(
        "kernel.url".to_string(),
        ConfigValue::String("http://127.0.0.1:3004".to_string()),
    );
    defaults.insert(
        "kernel.timeout_seconds".to_string(),
        ConfigValue::Number(30.0),
    );
    defaults.insert(
        "kernel.retry_attempts".to_string(),
        ConfigValue::Number(3.0),
    );

    // API settings
    defaults.insert(
        "api.bind_address".to_string(),
        ConfigValue::String("127.0.0.1:3000".to_string()),
    );
    defaults.insert("api.cors_enabled".to_string(), ConfigValue::Boolean(true));
    defaults.insert(
        "api.rate_limit_requests".to_string(),
        ConfigValue::Number(100.0),
    );

    // Logging settings
    defaults.insert(
        "logging.level".to_string(),
        ConfigValue::String("info".to_string()),
    );
    defaults.insert("logging.stdout".to_string(), ConfigValue::Boolean(true));
    defaults.insert(
        "logging.file_enabled".to_string(),
        ConfigValue::Boolean(true),
    );
    defaults.insert(
        "logging.retention_days".to_string(),
        ConfigValue::Number(7.0),
    );

    // Agent settings
    defaults.insert(
        "agent.default_model".to_string(),
        ConfigValue::String("claude-3-5-sonnet".to_string()),
    );
    defaults.insert(
        "agent.max_iterations".to_string(),
        ConfigValue::Number(10.0),
    );
    defaults.insert(
        "agent.timeout_seconds".to_string(),
        ConfigValue::Number(120.0),
    );

    // Workspace settings
    defaults.insert(
        "workspace.auto_save".to_string(),
        ConfigValue::Boolean(true),
    );
    defaults.insert(
        "workspace.backup_interval_minutes".to_string(),
        ConfigValue::Number(5.0),
    );

    defaults
}

/// Configuration system service
pub struct ConfigSystemService {
    config: ConfigSystemConfig,
    data: HashMap<String, ConfigValue>,
    history: Vec<ConfigChange>,
    defaults: HashMap<String, ConfigValue>,
}

impl Default for ConfigSystemService {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigSystemService {
    /// Create new config system service with default configuration
    pub fn new() -> Self {
        Self {
            config: ConfigSystemConfig::default(),
            data: HashMap::new(),
            history: Vec::new(),
            defaults: default_config(),
        }
    }

    /// Create new config system service with custom configuration
    pub fn with_config(config: ConfigSystemConfig) -> Self {
        Self {
            config,
            data: HashMap::new(),
            history: Vec::new(),
            defaults: default_config(),
        }
    }

    /// Initialize the service by loading existing configuration
    pub async fn initialize(&mut self) -> Result<(), ConfigSystemError> {
        // Ensure config directory exists
        if let Some(parent) = self.config.config_file.parent() {
            fs::create_dir_all(parent).await.map_err(|e| {
                ConfigSystemError::IoError(format!("Failed to create config directory: {}", e))
            })?;
        }

        // Load existing config if file exists
        if self.config.config_file.exists() {
            self.load().await?;
        } else {
            // Initialize with defaults
            self.data = self.defaults.clone();
            if self.config.auto_save {
                self.save().await?;
            }
        }

        Ok(())
    }

    /// Load configuration from disk
    async fn load(&mut self) -> Result<(), ConfigSystemError> {
        let content = fs::read_to_string(&self.config.config_file)
            .await
            .map_err(|e| {
                ConfigSystemError::IoError(format!("Failed to read config file: {}", e))
            })?;

        let loaded: HashMap<String, ConfigValue> = serde_json::from_str(&content).map_err(|e| {
            ConfigSystemError::SerializationError(format!("Failed to parse config: {}", e))
        })?;

        self.data = loaded;
        Ok(())
    }

    /// Save configuration to disk
    async fn save(&self) -> Result<(), ConfigSystemError> {
        let content = serde_json::to_string_pretty(&self.data).map_err(|e| {
            ConfigSystemError::SerializationError(format!("Failed to serialize config: {}", e))
        })?;

        fs::write(&self.config.config_file, content)
            .await
            .map_err(|e| {
                ConfigSystemError::IoError(format!("Failed to write config file: {}", e))
            })?;

        Ok(())
    }

    /// Create backup of current configuration
    async fn backup(&self) -> Result<(), ConfigSystemError> {
        if !self.config.backup_enabled {
            return Ok(());
        }

        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let backup_path = self
            .config
            .config_file
            .with_extension(format!("json.backup.{}", timestamp));

        if self.config.config_file.exists() {
            fs::copy(&self.config.config_file, &backup_path)
                .await
                .map_err(|e| {
                    ConfigSystemError::IoError(format!("Failed to create backup: {}", e))
                })?;
        }

        Ok(())
    }

    /// Get value at path using dot notation (e.g., "kernel.url")
    fn get_value(&self, path: &str) -> Option<&ConfigValue> {
        let parts: Vec<&str> = path.split('.').collect();
        if parts.is_empty() {
            return None;
        }

        // Start with top-level key
        let mut current = self.data.get(parts[0])?;

        // Navigate nested objects
        for part in &parts[1..] {
            match current {
                ConfigValue::Object(obj) => {
                    current = obj.get(*part)?;
                }
                _ => return None,
            }
        }

        Some(current)
    }

    /// Get value at path, falling back to defaults if not found
    fn get_value_or_default(&self, path: &str) -> Option<&ConfigValue> {
        self.get_value(path).or_else(|| self.defaults.get(path))
    }

    /// Set value at path using dot notation
    fn set_value(&mut self, path: &str, value: ConfigValue) -> Result<(), ConfigSystemError> {
        let parts: Vec<&str> = path.split('.').collect();
        if parts.is_empty() {
            return Err(ConfigSystemError::InvalidPath("Empty path".to_string()));
        }

        if parts.len() == 1 {
            // Top-level key
            self.data.insert(parts[0].to_string(), value);
            return Ok(());
        }

        // Navigate/create nested structure
        let top_key = parts[0].to_string();
        if !self.data.contains_key(&top_key) {
            self.data
                .insert(top_key.clone(), ConfigValue::Object(HashMap::new()));
        }

        let mut current = match self.data.get_mut(&top_key) {
            Some(ConfigValue::Object(obj)) => obj,
            Some(_) => {
                // Replace non-object with object
                self.data
                    .insert(top_key.clone(), ConfigValue::Object(HashMap::new()));
                match self.data.get_mut(&top_key) {
                    Some(ConfigValue::Object(obj)) => obj,
                    _ => {
                        return Err(ConfigSystemError::InternalError(
                            "Failed to create object".to_string(),
                        ))
                    }
                }
            }
            None => {
                return Err(ConfigSystemError::InternalError(
                    "Failed to insert top key".to_string(),
                ))
            }
        };

        // Navigate/create intermediate objects
        for part in &parts[1..parts.len() - 1] {
            let part_string = part.to_string();

            // Check if we need to create or replace
            let needs_create_or_replace = match current.get(&part_string) {
                Some(ConfigValue::Object(_)) => false,
                _ => true,
            };

            if needs_create_or_replace {
                current.insert(part_string.clone(), ConfigValue::Object(HashMap::new()));
            }

            current = match current.get_mut(&part_string) {
                Some(ConfigValue::Object(obj)) => obj,
                _ => {
                    return Err(ConfigSystemError::InternalError(
                        "Failed to get nested object".to_string(),
                    ))
                }
            };
        }

        // Set final value
        current.insert(parts.last().unwrap().to_string(), value);
        Ok(())
    }

    /// Delete value at path
    fn delete_value(&mut self, path: &str) -> Result<bool, ConfigSystemError> {
        let parts: Vec<&str> = path.split('.').collect();
        if parts.is_empty() {
            return Err(ConfigSystemError::InvalidPath("Empty path".to_string()));
        }

        if parts.len() == 1 {
            return Ok(self.data.remove(parts[0]).is_some());
        }

        // Navigate to parent
        let mut current: &mut HashMap<String, ConfigValue> = match self.data.get_mut(parts[0]) {
            Some(ConfigValue::Object(obj)) => obj,
            _ => return Ok(false),
        };

        for part in &parts[1..parts.len() - 1] {
            let part_string = part.to_string();
            current = match current.get_mut(&part_string) {
                Some(ConfigValue::Object(obj)) => obj,
                _ => return Ok(false),
            };
        }

        Ok(current.remove(*parts.last().unwrap()).is_some())
    }

    /// Add change to history
    fn add_to_history(&mut self, change: ConfigChange) {
        self.history.push(change);

        // Limit history size
        if self.history.len() > self.config.max_history_entries {
            let excess = self.history.len() - self.config.max_history_entries;
            self.history.drain(0..excess);
        }
    }

    /// Execute a configuration operation
    pub async fn execute(
        &mut self,
        request: ConfigManagementRequest,
    ) -> Result<ConfigManagementResponse, ConfigSystemError> {
        let start_time = std::time::Instant::now();
        let user_id = request.context.as_ref().and_then(|c| c.user_id.clone());

        let result = match request.operation {
            ConfigOperation::Get { path } => self.handle_get(path).await,
            ConfigOperation::Set { path, value } => self.handle_set(path, value, user_id).await,
            ConfigOperation::Delete { path } => self.handle_delete(path, user_id).await,
            ConfigOperation::Validate => self.handle_validate().await,
            ConfigOperation::Apply => self.handle_apply().await,
            ConfigOperation::GetHistory { path, limit } => {
                self.handle_get_history(path, limit).await
            }
            ConfigOperation::ListKeys { prefix } => self.handle_list_keys(prefix).await,
            ConfigOperation::Reset { path } => self.handle_reset(path).await,
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => Ok(ConfigManagementResponse {
                success: true,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(e) => Ok(ConfigManagementResponse {
                success: false,
                result: None,
                error: Some(e.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// Handle Get operation
    async fn handle_get(
        &self,
        path: Option<String>,
    ) -> Result<serde_json::Value, ConfigSystemError> {
        match path {
            Some(p) => {
                // Get specific value
                match self.get_value_or_default(&p) {
                    Some(value) => {
                        Ok(serde_json::json!({
                            "path": p,
                            "value": value,
                            "exists": self.get_value(&p).is_some(),  // true if from data, false if from defaults
                        }))
                    }
                    None => Err(ConfigSystemError::KeyNotFound(p)),
                }
            }
            None => {
                // Get all configuration
                Ok(serde_json::json!({
                    "config": self.data,
                    "defaults": self.defaults,
                }))
            }
        }
    }

    /// Handle Set operation
    async fn handle_set(
        &mut self,
        path: String,
        value: ConfigValue,
        user_id: Option<String>,
    ) -> Result<serde_json::Value, ConfigSystemError> {
        // Validate if enabled
        if self.config.validate_on_set {
            self.validate_value(&path, &value)?;
        }

        // Backup before change
        if self.config.backup_enabled {
            self.backup().await?;
        }

        // Get old value for history
        let old_value = self.get_value(&path).cloned();

        // Set new value
        self.set_value(&path, value.clone())?;

        // Add to history
        self.add_to_history(ConfigChange {
            key: path.clone(),
            old_value,
            new_value: value,
            changed_at: Utc::now(),
            changed_by: user_id,
        });

        // Auto-save if enabled
        if self.config.auto_save {
            self.save().await?;
        }

        Ok(serde_json::json!({
            "status": "config_set",
            "path": path,
        }))
    }

    /// Handle Delete operation
    async fn handle_delete(
        &mut self,
        path: String,
        user_id: Option<String>,
    ) -> Result<serde_json::Value, ConfigSystemError> {
        // Get old value for history
        let old_value = self.get_value(&path).cloned();

        // Delete value
        let deleted = self.delete_value(&path)?;

        if !deleted {
            return Err(ConfigSystemError::KeyNotFound(path));
        }

        // Add to history
        if let Some(old) = old_value {
            self.add_to_history(ConfigChange {
                key: path.clone(),
                old_value: Some(old),
                new_value: ConfigValue::Null,
                changed_at: Utc::now(),
                changed_by: user_id,
            });
        }

        // Auto-save if enabled
        if self.config.auto_save {
            self.save().await?;
        }

        Ok(serde_json::json!({
            "status": "config_deleted",
            "path": path,
        }))
    }

    /// Handle Validate operation
    async fn handle_validate(&self) -> Result<serde_json::Value, ConfigSystemError> {
        let mut errors = Vec::new();

        // Validate kernel URL
        if let Some(url) = self.get_value_or_default("kernel.url") {
            if let Some(url_str) = url.as_str() {
                if !url_str.starts_with("http://") && !url_str.starts_with("https://") {
                    errors.push("kernel.url must start with http:// or https://");
                }
            }
        }

        // Validate timeout values
        if let Some(timeout) = self.get_value_or_default("kernel.timeout_seconds") {
            if let Some(t) = timeout.as_f64() {
                if !(1.0..=300.0).contains(&t) {
                    errors.push("kernel.timeout_seconds must be between 1 and 300");
                }
            }
        }

        // Validate logging level
        if let Some(level) = self.get_value_or_default("logging.level") {
            if let Some(l) = level.as_str() {
                let valid_levels = ["trace", "debug", "info", "warn", "error"];
                if !valid_levels.contains(&l.to_lowercase().as_str()) {
                    errors.push("logging.level must be one of: trace, debug, info, warn, error");
                }
            }
        }

        if errors.is_empty() {
            Ok(serde_json::json!({
                "valid": true,
                "message": "Configuration is valid",
            }))
        } else {
            Ok(serde_json::json!({
                "valid": false,
                "errors": errors,
            }))
        }
    }

    /// Handle Apply operation
    async fn handle_apply(&mut self) -> Result<serde_json::Value, ConfigSystemError> {
        // First validate
        let validation = self.handle_validate().await?;

        if !validation
            .get("valid")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Ok(serde_json::json!({
                "applied": false,
                "error": "Configuration validation failed",
                "details": validation.get("errors"),
            }));
        }

        // Save configuration
        self.save().await?;

        Ok(serde_json::json!({
            "applied": true,
            "message": "Configuration applied successfully",
            "config_file": self.config.config_file.to_string_lossy().to_string(),
        }))
    }

    /// Handle GetHistory operation
    async fn handle_get_history(
        &self,
        path: Option<String>,
        limit: Option<usize>,
    ) -> Result<serde_json::Value, ConfigSystemError> {
        let limit = limit.unwrap_or(50);

        let filtered_history: Vec<&ConfigChange> = self
            .history
            .iter()
            .filter(|change| {
                if let Some(ref p) = path {
                    change.key.starts_with(p)
                } else {
                    true
                }
            })
            .rev() // Most recent first
            .take(limit)
            .collect();

        Ok(serde_json::json!({
            "history": filtered_history,
            "count": filtered_history.len(),
            "total": self.history.len(),
        }))
    }

    /// Handle ListKeys operation
    async fn handle_list_keys(
        &self,
        prefix: Option<String>,
    ) -> Result<serde_json::Value, ConfigSystemError> {
        let keys: Vec<String> = self
            .data
            .keys()
            .filter(|k| {
                if let Some(ref p) = prefix {
                    k.starts_with(p)
                } else {
                    true
                }
            })
            .cloned()
            .collect();

        Ok(serde_json::json!({
            "keys": keys,
            "count": keys.len(),
        }))
    }

    /// Handle Reset operation
    async fn handle_reset(
        &mut self,
        path: Option<String>,
    ) -> Result<serde_json::Value, ConfigSystemError> {
        match path {
            Some(p) => {
                // Reset specific key to default
                if let Some(default_value) = self.defaults.get(&p) {
                    self.data.insert(p.clone(), default_value.clone());
                    self.save().await?;
                    Ok(serde_json::json!({
                        "status": "config_reset",
                        "path": p,
                    }))
                } else {
                    Err(ConfigSystemError::KeyNotFound(p))
                }
            }
            None => {
                // Reset all to defaults
                self.data = self.defaults.clone();
                self.save().await?;
                Ok(serde_json::json!({
                    "status": "config_reset_all",
                }))
            }
        }
    }

    /// Validate a configuration value
    fn validate_value(&self, _path: &str, _value: &ConfigValue) -> Result<(), ConfigSystemError> {
        // Add specific validation rules here
        // For now, accept all values
        Ok(())
    }

    /// Get current configuration
    pub fn config(&self) -> &ConfigSystemConfig {
        &self.config
    }

    /// Get configuration data
    pub fn data(&self) -> &HashMap<String, ConfigValue> {
        &self.data
    }
}

/// Configuration system error
#[derive(Debug, thiserror::Error)]
pub enum ConfigSystemError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Key not found: {0}")]
    KeyNotFound(String),

    #[error("Invalid path: {0}")]
    InvalidPath(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Internal error: {0}")]
    InternalError(String),
}

impl From<serde_json::Error> for ConfigSystemError {
    fn from(error: serde_json::Error) -> Self {
        ConfigSystemError::SerializationError(error.to_string())
    }
}
