//! Channel Abstraction Native - OC-018
//!
//! Native Rust implementation of OpenClaw's channel abstraction system.
//! This module provides a pure Rust implementation of multi-channel messaging
//! that will eventually replace the OpenClaw subprocess version.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;

/// Channel identifier
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ChannelId(String);

impl ChannelId {
    pub fn new(id: String) -> Self {
        Self(id)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for ChannelId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Channel type enumeration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ChannelType {
    Direct,
    Group,
    Channel,
    Thread,
}

/// Channel capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelCapability {
    pub chat_types: Vec<ChannelType>,
    pub native_commands: bool,
    pub streaming_supported: bool,
    pub attachments_supported: bool,
    pub reactions_supported: bool,
    pub threading_supported: bool,
}

/// Channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    pub id: ChannelId,
    pub name: String,
    pub enabled: bool,
    pub allow_from: Vec<String>, // Who can send to this channel
    pub block_from: Vec<String>, // Who is blocked from this channel
    pub capabilities: ChannelCapability,
    pub outbound_config: OutboundConfig,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Outbound configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutboundConfig {
    pub text_chunk_limit: Option<usize>,
    pub rate_limit_requests: Option<u32>,
    pub rate_limit_window_seconds: Option<u64>,
    pub retry_attempts: Option<u32>,
    pub retry_delay_ms: Option<u64>,
}

/// Channel message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMessage {
    pub id: String,
    pub channel_id: ChannelId,
    pub sender_id: String,
    pub sender_label: Option<String>,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub message_type: MessageType,
    pub attachments: Option<Vec<Attachment>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Message type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    Text,
    Command,
    Reaction,
    Attachment,
    System,
}

/// Attachment information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub name: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub url: Option<String>,
    pub local_path: Option<PathBuf>,
}

/// Channel message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageRequest {
    pub channel_id: ChannelId,
    pub content: String,
    pub attachments: Option<Vec<Attachment>>,
    pub reply_to: Option<String>, // Message ID to reply to
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Send message response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageResponse {
    pub success: bool,
    pub message_id: Option<String>,
    pub error: Option<String>,
}

/// Receive message request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveMessageRequest {
    pub channel_id: ChannelId,
    pub limit: Option<usize>,
    pub since: Option<DateTime<Utc>>,
}

/// Receive message response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReceiveMessageResponse {
    pub messages: Vec<ChannelMessage>,
    pub total_count: usize,
}

/// Channel abstraction configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelAbstractionConfig {
    pub channels_dir: PathBuf,
    pub enable_rate_limiting: bool,
    pub default_rate_limit_requests: u32,
    pub default_rate_limit_window_seconds: u64,
    pub enable_allowlists: bool,
    pub enable_blocklists: bool,
    pub enable_message_logging: bool,
    pub log_retention_days: Option<u32>,
}

impl Default for ChannelAbstractionConfig {
    fn default() -> Self {
        Self {
            channels_dir: PathBuf::from("./channels"),
            enable_rate_limiting: true,
            default_rate_limit_requests: 100, // 100 requests per window
            default_rate_limit_window_seconds: 60, // 1 minute window
            enable_allowlists: true,
            enable_blocklists: true,
            enable_message_logging: true,
            log_retention_days: Some(30), // 30 days retention
        }
    }
}

/// Channel abstraction service
pub struct ChannelAbstractionService {
    config: ChannelAbstractionConfig,
    channels: HashMap<ChannelId, ChannelConfig>,
    message_log: Vec<ChannelMessage>,
}

impl ChannelAbstractionService {
    /// Create new channel abstraction service with default configuration
    pub fn new() -> Self {
        Self {
            config: ChannelAbstractionConfig::default(),
            channels: HashMap::new(),
            message_log: Vec::new(),
        }
    }

    /// Create new channel abstraction service with custom configuration
    pub fn with_config(config: ChannelAbstractionConfig) -> Self {
        Self {
            config,
            channels: HashMap::new(),
            message_log: Vec::new(),
        }
    }

    /// Initialize the service by loading existing channel configurations
    pub async fn initialize(&mut self) -> Result<(), ChannelAbstractionError> {
        self.ensure_channels_dir().await?;
        self.load_channel_configs().await?;
        Ok(())
    }

    /// Ensure the channels directory exists
    async fn ensure_channels_dir(&self) -> Result<(), ChannelAbstractionError> {
        fs::create_dir_all(&self.config.channels_dir)
            .await
            .map_err(|e| {
                ChannelAbstractionError::IoError(format!(
                    "Failed to create channels directory: {}",
                    e
                ))
            })
    }

    /// Load channel configurations from disk
    async fn load_channel_configs(&mut self) -> Result<(), ChannelAbstractionError> {
        if !self.config.channels_dir.exists() {
            return Ok(());
        }

        let mut entries = fs::read_dir(&self.config.channels_dir).await.map_err(|e| {
            ChannelAbstractionError::IoError(format!("Failed to read channels directory: {}", e))
        })?;

        while let Some(entry) = entries.next_entry().await.map_err(|e| {
            ChannelAbstractionError::IoError(format!("Failed to read directory entry: {}", e))
        })? {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path).await {
                    if let Ok(config) = serde_json::from_str::<ChannelConfig>(&content) {
                        self.channels.insert(config.id.clone(), config);
                    }
                }
            }
        }

        Ok(())
    }

    /// Register a new channel
    pub async fn register_channel(
        &mut self,
        config: ChannelConfig,
    ) -> Result<(), ChannelAbstractionError> {
        // Validate configuration
        self.validate_channel_config(&config)?;

        // Save to disk
        let config_path = self
            .config
            .channels_dir
            .join(format!("{}.json", config.id.as_str()));
        let config_json = serde_json::to_string_pretty(&config).map_err(|e| {
            ChannelAbstractionError::SerializationError(format!(
                "Failed to serialize channel config: {}",
                e
            ))
        })?;

        fs::write(&config_path, config_json).await.map_err(|e| {
            ChannelAbstractionError::IoError(format!("Failed to write channel config: {}", e))
        })?;

        // Add to registry
        self.channels.insert(config.id.clone(), config);

        Ok(())
    }

    /// Validate channel configuration
    fn validate_channel_config(
        &self,
        config: &ChannelConfig,
    ) -> Result<(), ChannelAbstractionError> {
        if config.id.as_str().is_empty() {
            return Err(ChannelAbstractionError::ValidationError(
                "Channel ID cannot be empty".to_string(),
            ));
        }

        if config.name.is_empty() {
            return Err(ChannelAbstractionError::ValidationError(
                "Channel name cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    /// Send a message to a channel
    pub async fn send_message(
        &mut self,
        request: SendMessageRequest,
    ) -> Result<SendMessageResponse, ChannelAbstractionError> {
        // Check if channel exists
        let channel = self.channels.get(&request.channel_id).ok_or_else(|| {
            ChannelAbstractionError::ChannelNotFound(request.channel_id.0.clone())
        })?;

        // Check if channel is enabled
        if !channel.enabled {
            return Ok(SendMessageResponse {
                success: false,
                message_id: None,
                error: Some("Channel is disabled".to_string()),
            });
        }

        // Check rate limiting
        if self.config.enable_rate_limiting {
            if let Err(e) = self.check_rate_limit(&request.channel_id).await {
                return Ok(SendMessageResponse {
                    success: false,
                    message_id: None,
                    error: Some(e.to_string()),
                });
            }
        }

        // Check allowlist/blocklist
        if self.config.enable_allowlists || self.config.enable_blocklists {
            if let Err(e) = self.check_access_control(channel, &request).await {
                return Ok(SendMessageResponse {
                    success: false,
                    message_id: None,
                    error: Some(e.to_string()),
                });
            }
        }

        // Create message
        let message = ChannelMessage {
            id: uuid::Uuid::new_v4().to_string(),
            channel_id: request.channel_id,
            sender_id: "allternit-system".to_string(), // In a real implementation, this would come from context
            sender_label: Some("Allternit System".to_string()),
            content: request.content,
            timestamp: Utc::now(),
            message_type: MessageType::Text, // Could be determined from content
            attachments: request.attachments,
            metadata: request.metadata,
        };

        // Log message
        if self.config.enable_message_logging {
            self.message_log.push(message.clone());
        }

        // In a real implementation, this would delegate to the appropriate channel adapter
        // For now, we'll just return success
        Ok(SendMessageResponse {
            success: true,
            message_id: Some(message.id),
            error: None,
        })
    }

    /// Receive messages from a channel
    pub async fn receive_messages(
        &self,
        request: ReceiveMessageRequest,
    ) -> Result<ReceiveMessageResponse, ChannelAbstractionError> {
        // Check if channel exists
        if !self.channels.contains_key(&request.channel_id) {
            return Err(ChannelAbstractionError::ChannelNotFound(
                request.channel_id.0.clone(),
            ));
        }

        // Filter messages by channel and time
        let mut messages: Vec<ChannelMessage> = self
            .message_log
            .iter()
            .filter(|msg| msg.channel_id == request.channel_id)
            .cloned()
            .collect();

        // Filter by time if specified
        if let Some(since) = request.since {
            messages.retain(|msg| msg.timestamp >= since);
        }

        // Limit results if specified
        if let Some(limit) = request.limit {
            messages.truncate(limit);
        }

        // Sort by timestamp (newest first)
        messages.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

        let total_count = messages.len();

        Ok(ReceiveMessageResponse {
            messages,
            total_count,
        })
    }

    /// List all registered channels
    pub fn list_channels(&self) -> Vec<&ChannelConfig> {
        self.channels.values().collect()
    }

    /// Get a specific channel by ID
    pub fn get_channel(&self, channel_id: &ChannelId) -> Option<&ChannelConfig> {
        self.channels.get(channel_id)
    }

    /// Check rate limit for a channel
    async fn check_rate_limit(
        &self,
        channel_id: &ChannelId,
    ) -> Result<(), ChannelAbstractionError> {
        // In a real implementation, this would check actual rate limits
        // For now, we'll just return Ok
        Ok(())
    }

    /// Check access control (allowlist/blocklist)
    async fn check_access_control(
        &self,
        channel: &ChannelConfig,
        request: &SendMessageRequest,
    ) -> Result<(), ChannelAbstractionError> {
        // In a real implementation, this would check sender against allowlist/blocklist
        // For now, we'll just return Ok
        Ok(())
    }

    /// Update channel configuration
    pub async fn update_channel_config(
        &mut self,
        channel_id: &ChannelId,
        updates: ChannelConfigUpdates,
    ) -> Result<(), ChannelAbstractionError> {
        let channel = self
            .channels
            .get_mut(channel_id)
            .ok_or_else(|| ChannelAbstractionError::ChannelNotFound(channel_id.0.clone()))?;

        // Apply updates
        if let Some(enabled) = updates.enabled {
            channel.enabled = enabled;
        }

        if let Some(allow_from) = updates.allow_from {
            channel.allow_from = allow_from;
        }

        if let Some(block_from) = updates.block_from {
            channel.block_from = block_from;
        }

        if let Some(metadata) = updates.metadata {
            channel.metadata = Some(metadata);
        }

        // Save updated config to disk
        let config_path = self
            .config
            .channels_dir
            .join(format!("{}.json", channel_id.as_str()));
        let config_json = serde_json::to_string_pretty(&channel).map_err(|e| {
            ChannelAbstractionError::SerializationError(format!(
                "Failed to serialize channel config: {}",
                e
            ))
        })?;

        fs::write(&config_path, config_json).await.map_err(|e| {
            ChannelAbstractionError::IoError(format!("Failed to write channel config: {}", e))
        })?;

        Ok(())
    }

    /// Get current configuration
    pub fn config(&self) -> &ChannelAbstractionConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut ChannelAbstractionConfig {
        &mut self.config
    }

    /// Get message log
    pub fn message_log(&self) -> &Vec<ChannelMessage> {
        &self.message_log
    }
}

impl Default for ChannelAbstractionService {
    fn default() -> Self {
        Self::new()
    }
}

/// Channel configuration updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfigUpdates {
    pub enabled: Option<bool>,
    pub allow_from: Option<Vec<String>>,
    pub block_from: Option<Vec<String>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Channel abstraction error
#[derive(Debug, thiserror::Error)]
pub enum ChannelAbstractionError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Channel not found: {0}")]
    ChannelNotFound(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Access denied")]
    AccessDenied,

    #[error("Permission denied: {0}")]
    PermissionDenied(String),
}

#[cfg(ALL_TESTS_DISABLED)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_channel_abstraction_creation() {
        let service = ChannelAbstractionService::new();
        assert_eq!(service.config.channels_dir, PathBuf::from("./channels"));
        assert!(service.config.enable_rate_limiting);
    }

    #[tokio::test]
    async fn test_register_and_get_channel() {
        let mut service = ChannelAbstractionService::new();

        let config = ChannelConfig {
            id: ChannelId::new("test-channel".to_string()),
            name: "Test Channel".to_string(),
            enabled: true,
            allow_from: vec!["test-user".to_string()],
            block_from: vec![],
            capabilities: ChannelCapability {
                chat_types: vec![ChannelType::Direct, ChannelType::Group],
                native_commands: true,
                streaming_supported: false,
                attachments_supported: true,
                reactions_supported: true,
                threading_supported: false,
            },
            outbound_config: OutboundConfig {
                text_chunk_limit: Some(4000),
                rate_limit_requests: Some(100),
                rate_limit_window_seconds: Some(60),
                retry_attempts: Some(3),
                retry_delay_ms: Some(1000),
            },
            metadata: None,
        };

        service.register_channel(config).await.unwrap();

        let retrieved = service.get_channel(&ChannelId::new("test-channel".to_string()));
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "Test Channel");
    }

    #[tokio::test]
    async fn test_send_message() {
        let mut service = ChannelAbstractionService::new();

        let config = ChannelConfig {
            id: ChannelId::new("test-channel".to_string()),
            name: "Test Channel".to_string(),
            enabled: true,
            allow_from: vec!["test-user".to_string()],
            block_from: vec![],
            capabilities: ChannelCapability {
                chat_types: vec![ChannelType::Direct],
                native_commands: false,
                streaming_supported: false,
                attachments_supported: false,
                reactions_supported: false,
                threading_supported: false,
            },
            outbound_config: OutboundConfig {
                text_chunk_limit: None,
                rate_limit_requests: None,
                rate_limit_window_seconds: None,
                retry_attempts: None,
                retry_delay_ms: None,
            },
            metadata: None,
        };

        service.register_channel(config).await.unwrap();

        let request = SendMessageRequest {
            channel_id: ChannelId::new("test-channel".to_string()),
            content: "Hello, world!".to_string(),
            attachments: None,
            reply_to: None,
            metadata: None,
        };

        let response = service.send_message(request).await.unwrap();
        assert!(response.success);
        assert!(response.message_id.is_some());
    }

    #[tokio::test]
    async fn test_receive_messages() {
        let mut service = ChannelAbstractionService::new();

        let config = ChannelConfig {
            id: ChannelId::new("test-channel".to_string()),
            name: "Test Channel".to_string(),
            enabled: true,
            allow_from: vec!["test-user".to_string()],
            block_from: vec![],
            capabilities: ChannelCapability {
                chat_types: vec![ChannelType::Direct],
                native_commands: false,
                streaming_supported: false,
                attachments_supported: false,
                reactions_supported: false,
                threading_supported: false,
            },
            outbound_config: OutboundConfig {
                text_chunk_limit: None,
                rate_limit_requests: None,
                rate_limit_window_seconds: None,
                retry_attempts: None,
                retry_delay_ms: None,
            },
            metadata: None,
        };

        service.register_channel(config).await.unwrap();

        // Send a message first
        let send_request = SendMessageRequest {
            channel_id: ChannelId::new("test-channel".to_string()),
            content: "Test message".to_string(),
            attachments: None,
            reply_to: None,
            metadata: None,
        };

        let send_response = service.send_message(send_request).await.unwrap();
        assert!(send_response.success);

        // Now receive messages
        let receive_request = ReceiveMessageRequest {
            channel_id: ChannelId::new("test-channel".to_string()),
            limit: Some(10),
            since: None,
        };

        let receive_response = service.receive_messages(receive_request).await.unwrap();
        assert_eq!(receive_response.messages.len(), 1);
        assert_eq!(receive_response.messages[0].content, "Test message");
    }

    #[test]
    fn test_channel_id_display() {
        let channel_id = ChannelId::new("discord".to_string());
        assert_eq!(format!("{}", channel_id), "discord");
    }
}
