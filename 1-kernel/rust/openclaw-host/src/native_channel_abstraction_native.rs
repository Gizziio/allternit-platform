//! Channel Abstraction Native - OC-034
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

/// Channel type
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ChannelType {
    #[serde(rename = "discord")]
    Discord,
    #[serde(rename = "slack")]
    Slack,
    #[serde(rename = "telegram")]
    Telegram,
    #[serde(rename = "whatsapp")]
    WhatsApp,
    #[serde(rename = "imessage")]
    IMessage,
    #[serde(rename = "signal")]
    Signal,
    #[serde(rename = "email")]
    Email,
    #[serde(rename = "web")]
    Web,
    #[serde(rename = "cli")]
    Cli,
    #[serde(rename = "custom")]
    Custom,
}

/// Channel message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelMessage {
    pub id: String,
    pub channel_id: ChannelId,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub content: String,
    pub message_type: MessageType,
    pub timestamp: DateTime<Utc>,
    pub attachments: Option<Vec<Attachment>>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    pub reply_to: Option<String>, // Message ID this is replying to
}

/// Message type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "command")]
    Command,
    #[serde(rename = "notification")]
    Notification,
    #[serde(rename = "system")]
    System,
    #[serde(rename = "tool_result")]
    ToolResult,
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

/// Channel configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfig {
    pub id: ChannelId,
    pub channel_type: ChannelType,
    pub name: String,
    pub enabled: bool,
    pub allow_from: Vec<String>, // Who can send to this channel
    pub block_from: Vec<String>, // Who is blocked from this channel
    pub webhook_url: Option<String>,
    pub api_token: Option<String>,
    pub connection_settings: Option<HashMap<String, serde_json::Value>>,
    pub message_format: MessageFormat,
    pub rate_limits: Option<RateLimitConfig>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Message format configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageFormat {
    pub enable_markdown: bool,
    pub enable_mentions: bool,
    pub enable_attachments: bool,
    pub max_message_length: Option<usize>,
    pub max_attachment_size_mb: Option<u64>,
}

/// Rate limit configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub requests_per_minute: Option<u32>,
    pub burst_limit: Option<u32>,
}

/// Channel abstraction request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelAbstractionRequest {
    pub operation: ChannelOperation,
    pub context: Option<ChannelContext>,
}

/// Channel operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ChannelOperation {
    /// Send a message to a channel
    SendMessage {
        channel_id: ChannelId,
        message: ChannelMessage,
    },

    /// Receive messages from a channel
    ReceiveMessages {
        channel_id: ChannelId,
        limit: Option<usize>,
        since: Option<DateTime<Utc>>,
    },

    /// List all channels
    ListChannels,

    /// Get channel information
    GetChannel { channel_id: ChannelId },

    /// Update channel configuration
    UpdateChannel {
        channel_id: ChannelId,
        config_updates: ChannelConfigUpdates,
    },

    /// Enable/disable a channel
    ToggleChannel {
        channel_id: ChannelId,
        enabled: bool,
    },

    /// Get channel history
    GetHistory {
        channel_id: ChannelId,
        limit: Option<usize>,
        offset: Option<usize>,
    },
}

/// Channel context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// Channel configuration updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelConfigUpdates {
    pub enabled: Option<bool>,
    pub allow_from: Option<Vec<String>>,
    pub block_from: Option<Vec<String>>,
    pub webhook_url: Option<String>,
    pub api_token: Option<String>,
    pub connection_settings: Option<HashMap<String, serde_json::Value>>,
    pub message_format: Option<MessageFormat>,
    pub rate_limits: Option<RateLimitConfig>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Channel abstraction response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelAbstractionResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// Channel abstraction configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelAbstractionConfig {
    pub channels_dir: PathBuf,
    pub enable_persistence: bool,
    pub enable_rate_limiting: bool,
    pub enable_security_controls: bool,
    pub default_rate_limit_requests_per_minute: u32,
    pub default_webhook_timeout_ms: u64,
    pub max_message_history: Option<usize>,
    pub enable_encryption: bool,
    pub encryption_key: Option<String>,
}

impl Default for ChannelAbstractionConfig {
    fn default() -> Self {
        Self {
            channels_dir: PathBuf::from("./channels"),
            enable_persistence: true,
            enable_rate_limiting: true,
            enable_security_controls: true,
            default_rate_limit_requests_per_minute: 100,
            default_webhook_timeout_ms: 30_000, // 30 seconds
            max_message_history: Some(10_000),  // 10k messages
            enable_encryption: false,
            encryption_key: None,
        }
    }
}

/// Channel abstraction service
pub struct ChannelAbstractionService {
    config: ChannelAbstractionConfig,
    channels: HashMap<ChannelId, ChannelConfig>,
    message_history: HashMap<ChannelId, Vec<ChannelMessage>>,
    rate_limiters: HashMap<ChannelId, tokio::sync::Semaphore>,
}

impl ChannelAbstractionService {
    /// Create new channel abstraction service with default configuration
    pub fn new() -> Self {
        Self {
            config: ChannelAbstractionConfig::default(),
            channels: HashMap::new(),
            message_history: HashMap::new(),
            rate_limiters: HashMap::new(),
        }
    }

    /// Create new channel abstraction service with custom configuration
    pub fn with_config(config: ChannelAbstractionConfig) -> Self {
        Self {
            config,
            channels: HashMap::new(),
            message_history: HashMap::new(),
            rate_limiters: HashMap::new(),
        }
    }

    /// Initialize the service by loading existing channel configurations
    pub async fn initialize(&mut self) -> Result<(), ChannelAbstractionError> {
        self.ensure_channels_dir().await?;
        self.load_channel_configs().await?;
        self.initialize_rate_limiters();
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
                    if let Ok(channel_config) = serde_json::from_str::<ChannelConfig>(&content) {
                        self.channels
                            .insert(channel_config.id.clone(), channel_config);
                    }
                }
            }
        }

        Ok(())
    }

    /// Initialize rate limiters for each channel
    fn initialize_rate_limiters(&mut self) {
        for (channel_id, config) in &self.channels {
            let max_requests = config
                .rate_limits
                .as_ref()
                .and_then(|rl| rl.requests_per_minute)
                .unwrap_or(self.config.default_rate_limit_requests_per_minute);

            self.rate_limiters.insert(
                channel_id.clone(),
                tokio::sync::Semaphore::new(max_requests as usize),
            );
        }
    }

    /// Execute a channel abstraction operation
    pub async fn execute(
        &mut self,
        request: ChannelAbstractionRequest,
    ) -> Result<ChannelAbstractionResponse, ChannelAbstractionError> {
        let start_time = std::time::Instant::now();

        let result = match request.operation {
            ChannelOperation::SendMessage {
                channel_id,
                message,
            } => self.send_message(channel_id, message).await,
            ChannelOperation::ReceiveMessages {
                channel_id,
                limit,
                since,
            } => self.receive_messages(channel_id, limit, since).await,
            ChannelOperation::ListChannels => self.list_channels().await,
            ChannelOperation::GetChannel { channel_id } => self.get_channel(channel_id).await,
            ChannelOperation::UpdateChannel {
                channel_id,
                config_updates,
            } => self.update_channel(channel_id, config_updates).await,
            ChannelOperation::ToggleChannel {
                channel_id,
                enabled,
            } => self.toggle_channel(channel_id, enabled).await,
            ChannelOperation::GetHistory {
                channel_id,
                limit,
                offset,
            } => self.get_history(channel_id, limit, offset).await,
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => Ok(ChannelAbstractionResponse {
                success: true,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(error) => Ok(ChannelAbstractionResponse {
                success: false,
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// Send a message to a channel
    async fn send_message(
        &mut self,
        channel_id: ChannelId,
        mut message: ChannelMessage,
    ) -> Result<serde_json::Value, ChannelAbstractionError> {
        // Check if channel exists
        let channel = self
            .channels
            .get(&channel_id)
            .ok_or_else(|| ChannelAbstractionError::ChannelNotFound(channel_id.0.clone()))?;

        // Check if channel is enabled
        if !channel.enabled {
            return Err(ChannelAbstractionError::PermissionDenied(format!(
                "Channel {} is disabled",
                channel_id.0
            )));
        }

        // Check rate limits
        if self.config.enable_rate_limiting {
            self.check_rate_limit(&channel_id).await?;
        }

        // Check security controls
        if self.config.enable_security_controls {
            self.check_security_controls(channel, &message)?;
        }

        // Update message timestamp
        message.timestamp = Utc::now();

        // Add to message history
        self.message_history
            .entry(channel_id.clone())
            .or_default()
            .push(message.clone());

        // Limit history size if configured
        if let Some(max_history) = self.config.max_message_history {
            if let Some(history) = self.message_history.get_mut(&channel_id) {
                if history.len() > max_history {
                    history.drain(0..(history.len() - max_history));
                }
            }
        }

        // In a real implementation, this would send the message to the actual channel
        // For now, we'll just return success
        Ok(serde_json::json!({
            "status": "message_sent",
            "messageId": message.id,
            "channelId": channel_id.as_str(),
        }))
    }

    /// Receive messages from a channel
    async fn receive_messages(
        &self,
        channel_id: ChannelId,
        limit: Option<usize>,
        since: Option<DateTime<Utc>>,
    ) -> Result<serde_json::Value, ChannelAbstractionError> {
        // Check if channel exists
        if !self.channels.contains_key(&channel_id) {
            return Err(ChannelAbstractionError::ChannelNotFound(
                channel_id.0.clone(),
            ));
        }

        // Get messages from history
        let messages = self
            .message_history
            .get(&channel_id)
            .cloned()
            .unwrap_or_default();

        // Filter by time if specified
        let filtered_messages = if let Some(since_time) = since {
            messages
                .into_iter()
                .filter(|msg| msg.timestamp >= since_time)
                .collect()
        } else {
            messages
        };

        // Apply limit if specified
        let limited_messages = if let Some(limit_val) = limit {
            let start_idx = filtered_messages.len().saturating_sub(limit_val);
            filtered_messages[start_idx..].to_vec()
        } else {
            filtered_messages
        };

        Ok(serde_json::json!({
            "messages": limited_messages,
            "count": limited_messages.len(),
        }))
    }

    /// List all channels
    async fn list_channels(&self) -> Result<serde_json::Value, ChannelAbstractionError> {
        let channels: Vec<serde_json::Value> = self
            .channels
            .values()
            .map(|config| {
                serde_json::json!({
                    "id": config.id.as_str(),
                    "type": match config.channel_type {
                        ChannelType::Discord => "discord",
                        ChannelType::Slack => "slack",
                        ChannelType::Telegram => "telegram",
                        ChannelType::WhatsApp => "whatsapp",
                        ChannelType::IMessage => "imessage",
                        ChannelType::Signal => "signal",
                        ChannelType::Email => "email",
                        ChannelType::Web => "web",
                        ChannelType::Cli => "cli",
                        ChannelType::Custom => "custom",
                    },
                    "name": config.name,
                    "enabled": config.enabled,
                    "allowFrom": config.allow_from,
                    "blockFrom": config.block_from,
                    "hasWebhook": config.webhook_url.is_some(),
                    "hasApiToken": config.api_token.is_some(),
                })
            })
            .collect();

        Ok(serde_json::json!({
            "channels": channels,
            "count": channels.len(),
        }))
    }

    /// Get a specific channel
    async fn get_channel(
        &self,
        channel_id: ChannelId,
    ) -> Result<serde_json::Value, ChannelAbstractionError> {
        match self.channels.get(&channel_id) {
            Some(config) => Ok(serde_json::json!({
                "channel": {
                    "id": config.id.as_str(),
                    "type": match config.channel_type {
                        ChannelType::Discord => "discord",
                        ChannelType::Slack => "slack",
                        ChannelType::Telegram => "telegram",
                        ChannelType::WhatsApp => "whatsapp",
                        ChannelType::IMessage => "imessage",
                        ChannelType::Signal => "signal",
                        ChannelType::Email => "email",
                        ChannelType::Web => "web",
                        ChannelType::Cli => "cli",
                        ChannelType::Custom => "custom",
                    },
                    "name": config.name,
                    "enabled": config.enabled,
                    "allowFrom": config.allow_from,
                    "blockFrom": config.block_from,
                    "webhookUrl": config.webhook_url,
                    "connectionSettings": config.connection_settings,
                    "messageFormat": config.message_format,
                    "rateLimits": config.rate_limits,
                    "metadata": config.metadata,
                }
            })),
            None => Err(ChannelAbstractionError::ChannelNotFound(channel_id.0)),
        }
    }

    /// Update channel configuration
    async fn update_channel(
        &mut self,
        channel_id: ChannelId,
        updates: ChannelConfigUpdates,
    ) -> Result<serde_json::Value, ChannelAbstractionError> {
        let channel = self
            .channels
            .get_mut(&channel_id)
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

        if let Some(webhook_url) = updates.webhook_url {
            channel.webhook_url = Some(webhook_url);
        }

        if let Some(api_token) = updates.api_token {
            channel.api_token = Some(api_token);
        }

        if let Some(connection_settings) = updates.connection_settings {
            channel.connection_settings = Some(connection_settings);
        }

        if let Some(message_format) = updates.message_format {
            channel.message_format = message_format;
        }

        if let Some(rate_limits) = updates.rate_limits {
            // Update the rate limiter for this channel
            let max_requests = rate_limits
                .requests_per_minute
                .unwrap_or(self.config.default_rate_limit_requests_per_minute);
            channel.rate_limits = Some(rate_limits);
            self.rate_limiters.insert(
                channel_id.clone(),
                tokio::sync::Semaphore::new(max_requests as usize),
            );
        }

        if let Some(metadata) = updates.metadata {
            channel.metadata = Some(metadata);
        }

        // Persist if enabled
        let persist_config = if self.config.enable_persistence {
            Some(channel.clone())
        } else {
            None
        };
        drop(channel);
        if let Some(config) = persist_config {
            self.persist_channel_config(&config).await?;
        }

        Ok(serde_json::json!({
            "status": "channel_updated",
            "channelId": channel_id.as_str(),
        }))
    }

    /// Toggle channel enabled/disabled
    async fn toggle_channel(
        &mut self,
        channel_id: ChannelId,
        enabled: bool,
    ) -> Result<serde_json::Value, ChannelAbstractionError> {
        let channel = self
            .channels
            .get_mut(&channel_id)
            .ok_or_else(|| ChannelAbstractionError::ChannelNotFound(channel_id.0.clone()))?;

        channel.enabled = enabled;

        // Persist if enabled
        let persist_config = if self.config.enable_persistence {
            Some(channel.clone())
        } else {
            None
        };
        drop(channel);
        if let Some(config) = persist_config {
            self.persist_channel_config(&config).await?;
        }

        Ok(serde_json::json!({
            "status": if enabled { "channel_enabled" } else { "channel_disabled" },
            "channelId": channel_id.as_str(),
        }))
    }

    /// Get message history for a channel
    async fn get_history(
        &self,
        channel_id: ChannelId,
        limit: Option<usize>,
        offset: Option<usize>,
    ) -> Result<serde_json::Value, ChannelAbstractionError> {
        // Check if channel exists
        if !self.channels.contains_key(&channel_id) {
            return Err(ChannelAbstractionError::ChannelNotFound(
                channel_id.0.clone(),
            ));
        }

        let messages = self
            .message_history
            .get(&channel_id)
            .cloned()
            .unwrap_or_default();

        // Apply offset
        let offset_messages = if let Some(offset_val) = offset {
            if offset_val < messages.len() {
                messages[offset_val..].to_vec()
            } else {
                vec![]
            }
        } else {
            messages
        };

        // Apply limit
        let limited_messages = if let Some(limit_val) = limit {
            if limit_val < offset_messages.len() {
                offset_messages[..limit_val].to_vec()
            } else {
                offset_messages
            }
        } else {
            offset_messages
        };

        Ok(serde_json::json!({
            "messages": limited_messages,
            "count": limited_messages.len(),
            "totalAvailable": self.message_history.get(&channel_id).map(|m| m.len()).unwrap_or(0),
        }))
    }

    /// Check rate limit for a channel
    async fn check_rate_limit(
        &self,
        channel_id: &ChannelId,
    ) -> Result<(), ChannelAbstractionError> {
        if let Some(semaphore) = self.rate_limiters.get(channel_id) {
            // Try to acquire a permit with timeout
            match tokio::time::timeout(std::time::Duration::from_millis(100), semaphore.acquire())
                .await
            {
                Ok(Ok(_permit)) => {
                    // Got permit, continue
                    Ok(())
                }
                Ok(Err(_)) => {
                    // Semaphore closed
                    Err(ChannelAbstractionError::RateLimitExceeded(format!(
                        "Rate limiter closed for channel {}",
                        channel_id.0
                    )))
                }
                Err(_) => {
                    // Timeout - rate limit exceeded
                    Err(ChannelAbstractionError::RateLimitExceeded(format!(
                        "Rate limit exceeded for channel {}",
                        channel_id.0
                    )))
                }
            }
        } else {
            // No rate limiter for this channel
            Ok(())
        }
    }

    /// Check security controls for a message
    fn check_security_controls(
        &self,
        channel: &ChannelConfig,
        message: &ChannelMessage,
    ) -> Result<(), ChannelAbstractionError> {
        // Check if sender is blocked
        if channel.block_from.contains(&message.sender_id) {
            return Err(ChannelAbstractionError::PermissionDenied(format!(
                "Sender {} is blocked from channel {}",
                message.sender_id, channel.id.0
            )));
        }

        // Check if sender is allowed (if allowlist is configured)
        if !channel.allow_from.is_empty() && !channel.allow_from.contains(&message.sender_id) {
            return Err(ChannelAbstractionError::PermissionDenied(format!(
                "Sender {} is not allowed in channel {}",
                message.sender_id, channel.id.0
            )));
        }

        // Check message length if configured
        if let Some(max_length) = channel.message_format.max_message_length {
            if message.content.len() > max_length {
                return Err(ChannelAbstractionError::ValidationError(format!(
                    "Message exceeds maximum length of {} characters",
                    max_length
                )));
            }
        }

        Ok(())
    }

    /// Persist channel configuration to disk
    async fn persist_channel_config(
        &self,
        config: &ChannelConfig,
    ) -> Result<(), ChannelAbstractionError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        let channel_path = self
            .config
            .channels_dir
            .join(format!("{}.json", config.id.as_str()));
        let config_json = serde_json::to_string_pretty(config).map_err(|e| {
            ChannelAbstractionError::SerializationError(format!(
                "Failed to serialize channel config: {}",
                e
            ))
        })?;

        fs::write(&channel_path, config_json).await.map_err(|e| {
            ChannelAbstractionError::IoError(format!("Failed to write channel config: {}", e))
        })?;

        Ok(())
    }

    /// Get the file path for a channel config
    fn channel_config_path(&self, id: &ChannelId) -> PathBuf {
        self.config
            .channels_dir
            .join(format!("{}.json", id.as_str()))
    }

    /// Get current configuration
    pub fn config(&self) -> &ChannelAbstractionConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut ChannelAbstractionConfig {
        &mut self.config
    }

    /// Check if a channel exists
    pub fn has_channel(&self, id: &ChannelId) -> bool {
        self.channels.contains_key(id)
    }
}

impl Default for ChannelAbstractionService {
    fn default() -> Self {
        Self::new()
    }
}

/// Channel abstraction error
#[derive(Debug, thiserror::Error)]
pub enum ChannelAbstractionError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Channel not found: {0}")]
    ChannelNotFound(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Security violation: {0}")]
    SecurityViolation(String),

    #[error("Timeout error")]
    Timeout,
}

impl From<serde_json::Error> for ChannelAbstractionError {
    fn from(error: serde_json::Error) -> Self {
        ChannelAbstractionError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_channel_abstraction_creation() {
        let service = ChannelAbstractionService::new();
        assert_eq!(service.config.channels_dir, PathBuf::from("./channels"));
        assert!(service.config.enable_persistence);
        assert_eq!(service.channels.len(), 0);
    }

    #[tokio::test]
    async fn test_channel_abstraction_with_config() {
        let config = ChannelAbstractionConfig {
            channels_dir: PathBuf::from("/tmp/test-channels"),
            enable_persistence: false,
            enable_rate_limiting: true,
            default_rate_limit_requests_per_minute: 50,
            max_message_history: Some(100),
            ..Default::default()
        };

        let service = ChannelAbstractionService::with_config(config);
        assert_eq!(
            service.config.channels_dir,
            PathBuf::from("/tmp/test-channels")
        );
        assert!(!service.config.enable_persistence);
        assert_eq!(service.config.default_rate_limit_requests_per_minute, 50);
    }

    #[tokio::test]
    async fn test_register_and_get_channel() {
        let mut service = ChannelAbstractionService::new();

        let channel_config = ChannelConfig {
            id: ChannelId::new("test-channel".to_string()),
            channel_type: ChannelType::Discord,
            name: "Test Channel".to_string(),
            enabled: true,
            allow_from: vec!["user123".to_string()],
            block_from: vec![],
            webhook_url: Some("https://discord.com/api/webhooks/...".to_string()),
            api_token: None,
            connection_settings: None,
            message_format: MessageFormat {
                enable_markdown: true,
                enable_mentions: true,
                enable_attachments: false,
                max_message_length: Some(2000),
                max_attachment_size_mb: Some(8),
            },
            rate_limits: Some(RateLimitConfig {
                requests_per_minute: Some(60),
                burst_limit: Some(5),
            }),
            metadata: None,
        };

        service
            .channels
            .insert(channel_config.id.clone(), channel_config);

        // Get the channel
        let get_request = ChannelOperation::GetChannel {
            channel_id: ChannelId::new("test-channel".to_string()),
        };

        let response = service
            .execute(ChannelAbstractionRequest {
                operation: get_request,
                context: None,
            })
            .await
            .unwrap();

        assert!(response.success);
        assert!(response.result.is_some());

        let result = response.result.unwrap();
        let channel_data = result.get("channel").unwrap();
        assert_eq!(
            channel_data.get("name").and_then(|v| v.as_str()),
            Some("Test Channel")
        );
        assert_eq!(
            channel_data.get("enabled").and_then(|v| v.as_bool()),
            Some(true)
        );
    }

    #[tokio::test]
    async fn test_send_and_receive_message() {
        let mut service = ChannelAbstractionService::new();

        // Register a channel first
        let channel_config = ChannelConfig {
            id: ChannelId::new("messaging-test".to_string()),
            channel_type: ChannelType::Slack,
            name: "Messaging Test".to_string(),
            enabled: true,
            allow_from: vec!["test-user".to_string()],
            block_from: vec![],
            webhook_url: None,
            api_token: Some("xoxb-...".to_string()),
            connection_settings: None,
            message_format: MessageFormat {
                enable_markdown: true,
                enable_mentions: true,
                enable_attachments: true,
                max_message_length: Some(4000),
                max_attachment_size_mb: Some(10),
            },
            rate_limits: None,
            metadata: None,
        };

        service
            .channels
            .insert(channel_config.id.clone(), channel_config);

        // Send a message
        let message = ChannelMessage {
            id: Uuid::new_v4().to_string(),
            channel_id: ChannelId::new("messaging-test".to_string()),
            sender_id: "test-user".to_string(),
            sender_name: Some("Test User".to_string()),
            content: "Hello, world!".to_string(),
            message_type: MessageType::Text,
            timestamp: Utc::now(),
            attachments: None,
            metadata: None,
            reply_to: None,
        };

        let send_request = ChannelOperation::SendMessage {
            channel_id: ChannelId::new("messaging-test".to_string()),
            message: message.clone(),
        };

        let send_response = service
            .execute(ChannelAbstractionRequest {
                operation: send_request,
                context: None,
            })
            .await
            .unwrap();

        assert!(send_response.success);

        // Receive messages
        let receive_request = ChannelOperation::ReceiveMessages {
            channel_id: ChannelId::new("messaging-test".to_string()),
            limit: Some(10),
            since: None,
        };

        let receive_response = service
            .execute(ChannelAbstractionRequest {
                operation: receive_request,
                context: None,
            })
            .await
            .unwrap();

        assert!(receive_response.success);
        assert!(receive_response.result.is_some());

        let result = receive_response.result.unwrap();
        let messages = result.get("messages").unwrap().as_array().unwrap();
        assert_eq!(messages.len(), 1);
        assert_eq!(
            messages[0].get("content").and_then(|v| v.as_str()),
            Some("Hello, world!")
        );
    }

    #[tokio::test]
    async fn test_list_channels() {
        let mut service = ChannelAbstractionService::new();

        // Add a few channels
        for i in 1..=3 {
            let channel_config = ChannelConfig {
                id: ChannelId::new(format!("list-test-{}", i)),
                channel_type: ChannelType::Telegram,
                name: format!("List Test Channel {}", i),
                enabled: true,
                allow_from: vec!["all".to_string()],
                block_from: vec![],
                webhook_url: None,
                api_token: None,
                connection_settings: None,
                message_format: MessageFormat::default(),
                rate_limits: None,
                metadata: None,
            };

            service
                .channels
                .insert(channel_config.id.clone(), channel_config);
        }

        // List channels
        let list_request = ChannelOperation::ListChannels;
        let list_response = service
            .execute(ChannelAbstractionRequest {
                operation: list_request,
                context: None,
            })
            .await
            .unwrap();

        assert!(list_response.success);
        assert!(list_response.result.is_some());

        let result = list_response.result.unwrap();
        let channels = result.get("channels").unwrap().as_array().unwrap();
        let count = result.get("count").unwrap().as_u64().unwrap();

        assert_eq!(channels.len(), 3);
        assert_eq!(count, 3);

        // Verify channel names
        let channel_names: Vec<String> = channels
            .iter()
            .filter_map(|c| {
                c.get("name")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string())
            })
            .collect();

        assert!(channel_names.contains(&"List Test Channel 1".to_string()));
        assert!(channel_names.contains(&"List Test Channel 2".to_string()));
        assert!(channel_names.contains(&"List Test Channel 3".to_string()));
    }

    #[tokio::test]
    async fn test_toggle_channel() {
        let mut service = ChannelAbstractionService::new();

        // Register a channel
        let channel_config = ChannelConfig {
            id: ChannelId::new("toggle-test".to_string()),
            channel_type: ChannelType::WhatsApp,
            name: "Toggle Test".to_string(),
            enabled: true, // Start enabled
            allow_from: vec!["test-user".to_string()],
            block_from: vec![],
            webhook_url: None,
            api_token: None,
            connection_settings: None,
            message_format: MessageFormat::default(),
            rate_limits: None,
            metadata: None,
        };

        service
            .channels
            .insert(channel_config.id.clone(), channel_config);

        // Verify it's initially enabled
        let channel = service
            .channels
            .get(&ChannelId::new("toggle-test".to_string()))
            .unwrap();
        assert!(channel.enabled);

        // Disable the channel
        let toggle_request = ChannelOperation::ToggleChannel {
            channel_id: ChannelId::new("toggle-test".to_string()),
            enabled: false,
        };

        let toggle_response = service
            .execute(ChannelAbstractionRequest {
                operation: toggle_request,
                context: None,
            })
            .await
            .unwrap();

        assert!(toggle_response.success);

        // Verify it's now disabled
        let channel = service
            .channels
            .get(&ChannelId::new("toggle-test".to_string()))
            .unwrap();
        assert!(!channel.enabled);

        // Enable the channel again
        let toggle_request = ChannelOperation::ToggleChannel {
            channel_id: ChannelId::new("toggle-test".to_string()),
            enabled: true,
        };

        let toggle_response = service
            .execute(ChannelAbstractionRequest {
                operation: toggle_request,
                context: None,
            })
            .await
            .unwrap();

        assert!(toggle_response.success);

        // Verify it's now enabled
        let channel = service
            .channels
            .get(&ChannelId::new("toggle-test".to_string()))
            .unwrap();
        assert!(channel.enabled);
    }

    #[test]
    fn test_channel_id_display() {
        let channel_id = ChannelId::new("discord".to_string());
        assert_eq!(format!("{}", channel_id), "discord");
    }

    #[test]
    fn test_channel_types() {
        assert_eq!(
            serde_json::to_string(&ChannelType::Discord).unwrap(),
            "\"discord\""
        );
        assert_eq!(
            serde_json::to_string(&ChannelType::Slack).unwrap(),
            "\"slack\""
        );
        assert_eq!(
            serde_json::to_string(&ChannelType::Telegram).unwrap(),
            "\"telegram\""
        );
    }
}
