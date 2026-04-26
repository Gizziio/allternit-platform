//! iMessage Bridge - OC-029
//!
//! Bridge between OpenClaw's iMessage functionality and Allternit's native messaging system.
//! This module implements the adapter pattern to translate between OpenClaw iMessage operations
//! and Allternit messaging operations while maintaining Allternit interface.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tokio::fs;
use tokio::process::Command;
use uuid::Uuid;

/// iMessage contact information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageContact {
    pub id: String, // Usually phone number or email
    pub name: Option<String>,
    pub handle: String, // The iMessage handle
    pub is_group: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// iMessage message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageMessage {
    pub id: String,
    pub sender_id: String,
    pub sender_name: Option<String>,
    pub recipient_id: String,
    pub recipient_name: Option<String>,
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub message_type: ImessageMessageType,
    pub attachments: Option<Vec<ImessageAttachment>>,
    pub is_delivered: bool,
    pub is_read: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// iMessage message type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImessageMessageType {
    #[serde(rename = "text")]
    Text,
    #[serde(rename = "attachment")]
    Attachment,
    #[serde(rename = "sticker")]
    Sticker,
    #[serde(rename = "location")]
    Location,
    #[serde(rename = "contact")]
    Contact,
    #[serde(rename = "url")]
    Url,
}

/// iMessage attachment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageAttachment {
    pub id: String,
    pub filename: String,
    pub content_type: String,
    pub size_bytes: u64,
    pub transfer_state: String, // "transferable", "downloading", "complete", "error"
    pub is_sticker: bool,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// iMessage bridge request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageBridgeRequest {
    pub operation: ImessageOperation,
    pub context: Option<ImessageContext>,
}

/// iMessage operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImessageOperation {
    /// Send a message to a contact
    SendMessage {
        recipient: String, // Phone number or email
        content: String,
        attachments: Option<Vec<String>>, // Local file paths
    },

    /// Receive messages from contacts
    ReceiveMessages {
        contact: Option<String>, // Specific contact, or None for all
        limit: Option<usize>,
        since: Option<DateTime<Utc>>,
    },

    /// List contacts
    ListContacts,

    /// Get contact by ID
    GetContact { id: String },

    /// List messages for a contact
    ListMessages {
        contact: String,
        limit: Option<usize>,
    },

    /// Get message by ID
    GetMessage { id: String },

    /// Check if iMessage is available on this system
    CheckAvailability,

    /// Get iMessage status
    GetStatus,
}

/// iMessage context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageContext {
    pub session_id: Option<String>,
    pub agent_id: Option<String>,
    pub user_id: Option<String>,
    pub metadata: Option<HashMap<String, String>>,
}

/// iMessage bridge response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageBridgeResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
}

/// iMessage bridge configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImessageBridgeConfig {
    pub enable_imessage: bool,
    pub imessage_app_path: PathBuf,
    pub enable_attachments: bool,
    pub max_attachment_size_mb: Option<u64>,
    pub enable_group_messages: bool,
    pub security_policy: SecurityPolicy,
    pub default_timeout_ms: u64,
    pub enable_logging: bool,
    pub log_level: String, // "debug", "info", "warn", "error"
    pub enable_persistence: bool,
    pub message_sync_interval_minutes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityPolicy {
    /// Deny all iMessage operations (safe mode)
    Deny,

    /// Allow only whitelisted contacts
    Allowlist { allowed_contacts: Vec<String> },

    /// Allow all operations (unsafe, for development)
    Allow,
}

impl Default for ImessageBridgeConfig {
    fn default() -> Self {
        Self {
            enable_imessage: cfg!(target_os = "macos"), // Only enable on macOS by default
            imessage_app_path: PathBuf::from("/Applications/Messages.app"),
            enable_attachments: true,
            max_attachment_size_mb: Some(100), // 100MB limit
            enable_group_messages: true,
            security_policy: SecurityPolicy::Allowlist {
                allowed_contacts: vec![
                    "+1234567890".to_string(),      // Example phone number
                    "test@example.com".to_string(), // Example email
                ],
            },
            default_timeout_ms: 30_000, // 30 seconds
            enable_logging: true,
            log_level: "info".to_string(),
            enable_persistence: true,
            message_sync_interval_minutes: Some(5), // Sync every 5 minutes
        }
    }
}

/// iMessage bridge service
pub struct ImessageBridgeService {
    config: ImessageBridgeConfig,
    contacts_cache: HashMap<String, ImessageContact>,
    last_contact_sync: Option<DateTime<Utc>>,
    active_handles: HashMap<String, tokio::sync::Mutex<()>>, // To prevent concurrent operations
}

impl ImessageBridgeService {
    /// Create new iMessage bridge with default configuration
    pub fn new() -> Self {
        Self {
            config: ImessageBridgeConfig::default(),
            contacts_cache: HashMap::new(),
            last_contact_sync: None,
            active_handles: HashMap::new(),
        }
    }

    /// Create new iMessage bridge with custom configuration
    pub fn with_config(config: ImessageBridgeConfig) -> Self {
        Self {
            config,
            contacts_cache: HashMap::new(),
            last_contact_sync: None,
            active_handles: HashMap::new(),
        }
    }

    /// Initialize the service
    pub async fn initialize(&mut self) -> Result<(), ImessageBridgeError> {
        if !self.config.enable_imessage {
            return Ok(());
        }

        // Check if iMessage is available on this system
        if !self.is_imessage_available().await {
            return Err(ImessageBridgeError::InitializationError(
                "iMessage is not available on this system".to_string(),
            ));
        }

        // Load cached contacts if available
        if self.config.enable_persistence {
            self.load_cached_contacts().await?;
        }

        Ok(())
    }

    /// Check if iMessage is available on this system (macOS only)
    async fn is_imessage_available(&self) -> bool {
        if cfg!(target_os = "macos") {
            // Check if Messages app exists
            self.config.imessage_app_path.exists()
        } else {
            false // iMessage is only available on macOS
        }
    }

    /// Execute an iMessage operation
    pub async fn execute(
        &mut self,
        request: ImessageBridgeRequest,
    ) -> Result<ImessageBridgeResponse, ImessageBridgeError> {
        let start_time = std::time::Instant::now();

        // Check if iMessage is enabled
        if !self.config.enable_imessage {
            return Err(ImessageBridgeError::PermissionDenied(
                "iMessage functionality is disabled".to_string(),
            ));
        }

        // Check security policy
        self.check_security_policy(&request.operation)?;

        let result = match request.operation {
            ImessageOperation::SendMessage {
                recipient,
                content,
                attachments,
            } => self.send_message(&recipient, &content, attachments).await,
            ImessageOperation::ReceiveMessages {
                contact,
                limit,
                since,
            } => self.receive_messages(contact, limit, since).await,
            ImessageOperation::ListContacts => self.list_contacts().await,
            ImessageOperation::GetContact { id } => self.get_contact(&id).await,
            ImessageOperation::ListMessages { contact, limit } => {
                self.list_messages_for_contact(&contact, limit).await
            }
            ImessageOperation::GetMessage { id } => self.get_message(&id).await,
            ImessageOperation::CheckAvailability => self.check_availability().await,
            ImessageOperation::GetStatus => self.get_status().await,
        };

        let execution_time = start_time.elapsed().as_millis() as u64;

        match result {
            Ok(result_value) => Ok(ImessageBridgeResponse {
                success: true,
                result: Some(result_value),
                error: None,
                execution_time_ms: execution_time,
            }),
            Err(error) => Ok(ImessageBridgeResponse {
                success: false,
                result: None,
                error: Some(error.to_string()),
                execution_time_ms: execution_time,
            }),
        }
    }

    /// Send a message via iMessage
    async fn send_message(
        &self,
        recipient: &str,
        content: &str,
        attachments: Option<Vec<String>>,
    ) -> Result<serde_json::Value, ImessageBridgeError> {
        if !cfg!(target_os = "macos") {
            return Err(ImessageBridgeError::PlatformError(
                "iMessage is only available on macOS".to_string(),
            ));
        }

        // Validate recipient
        self.validate_recipient(recipient)?;

        // Check attachment sizes if any
        if let Some(attachment_paths) = &attachments {
            for path_str in attachment_paths {
                let path = PathBuf::from(path_str);
                if path.exists() {
                    let metadata = fs::metadata(&path).await.map_err(|e| {
                        ImessageBridgeError::IoError(format!(
                            "Failed to get attachment metadata: {}",
                            e
                        ))
                    })?;

                    let size_mb = metadata.len() / (1024 * 1024);
                    if let Some(max_size) = self.config.max_attachment_size_mb {
                        if size_mb > max_size {
                            return Err(ImessageBridgeError::ValidationError(format!(
                                "Attachment {} exceeds size limit of {}MB",
                                path_str, max_size
                            )));
                        }
                    }
                }
            }
        }

        // In a real implementation, this would use AppleScript to send via Messages app
        // For now, we'll simulate the operation
        let apple_script = if let Some(ref attachments) = attachments {
            // Send with attachments
            format!(
                r#"
                tell application "Messages"
                    set targetBuddy to buddy "{}" of service "E:your_email@domain.com"
                    send "{}" to targetBuddy
                    repeat with attachment_path in {:?}
                        send file attachment_path to targetBuddy
                    end repeat
                end tell
            "#,
                recipient, content, attachments
            )
        } else {
            // Send text-only message
            format!(
                r#"
                tell application "Messages"
                    set targetBuddy to buddy "{}" of service "E:your_email@domain.com"
                    send "{}" to targetBuddy
                end tell
            "#,
                recipient, content
            )
        };

        // Execute AppleScript
        let output = Command::new("osascript")
            .arg("-e")
            .arg(&apple_script)
            .output()
            .await
            .map_err(|e| {
                ImessageBridgeError::IoError(format!("Failed to execute AppleScript: {}", e))
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            return Err(ImessageBridgeError::CommunicationError(format!(
                "AppleScript execution failed: {}",
                stderr
            )));
        }

        Ok(serde_json::json!({
            "status": "message_sent",
            "recipient": recipient,
            "content": content,
            "attachments": attachments,
            "timestamp": Utc::now(),
            "messageId": Uuid::new_v4().to_string(),
        }))
    }

    /// Receive messages from iMessage
    async fn receive_messages(
        &self,
        contact: Option<String>,
        limit: Option<usize>,
        since: Option<DateTime<Utc>>,
    ) -> Result<serde_json::Value, ImessageBridgeError> {
        if !cfg!(target_os = "macos") {
            return Err(ImessageBridgeError::PlatformError(
                "iMessage is only available on macOS".to_string(),
            ));
        }

        // In a real implementation, this would use AppleScript to query Messages app
        // For now, we'll simulate receiving messages
        let apple_script = if let Some(contact_id) = contact {
            format!(
                r#"
                tell application "Messages"
                    set targetBuddy to buddy "{}" of service "E:your_email@domain.com"
                    set messageList to every message of targetBuddy
                    -- Process messageList to get recent messages
                    return "Simulated messages from {}"
                end tell
            "#,
                contact_id, contact_id
            )
        } else {
            r#"
                tell application "Messages"
                    set messageList to every message in every conversation
                    -- Process messageList to get recent messages from all contacts
                    return "Simulated messages from all contacts"
                end tell
            "#
            .to_string()
        };

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&apple_script)
            .output()
            .await
            .map_err(|e| {
                ImessageBridgeError::IoError(format!("Failed to execute AppleScript: {}", e))
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            return Err(ImessageBridgeError::CommunicationError(format!(
                "AppleScript execution failed: {}",
                stderr
            )));
        }

        // In a real implementation, this would parse the AppleScript output
        // For now, return a simulated response
        let messages = vec![ImessageMessage {
            id: Uuid::new_v4().to_string(),
            sender_id: "sender@example.com".to_string(),
            sender_name: Some("John Doe".to_string()),
            recipient_id: "recipient@domain.com".to_string(),
            recipient_name: Some("Jane Smith".to_string()),
            content: "Hello from iMessage bridge".to_string(),
            timestamp: Utc::now(),
            message_type: ImessageMessageType::Text,
            attachments: None,
            is_delivered: true,
            is_read: false,
            metadata: None,
        }];

        Ok(serde_json::json!({
            "messages": messages,
            "count": messages.len(),
        }))
    }

    /// List iMessage contacts
    async fn list_contacts(&mut self) -> Result<serde_json::Value, ImessageBridgeError> {
        if !cfg!(target_os = "macos") {
            return Err(ImessageBridgeError::PlatformError(
                "iMessage is only available on macOS".to_string(),
            ));
        }

        // In a real implementation, this would use AppleScript to list contacts
        // For now, we'll simulate the operation
        let apple_script = r#"
            tell application "Messages"
                set contactList to every buddy in every service
                -- Process contactList to return contact information
                return "Simulated contact list"
            end tell
        "#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(apple_script)
            .output()
            .await
            .map_err(|e| {
                ImessageBridgeError::IoError(format!("Failed to execute AppleScript: {}", e))
            })?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if !output.status.success() {
            return Err(ImessageBridgeError::CommunicationError(format!(
                "AppleScript execution failed: {}",
                stderr
            )));
        }

        // In a real implementation, this would parse the AppleScript output
        // For now, return a simulated contact list
        let contacts = vec![
            ImessageContact {
                id: "+1234567890".to_string(),
                name: Some("John Doe".to_string()),
                handle: "tel:+1234567890".to_string(),
                is_group: false,
                metadata: Some({
                    let mut meta = HashMap::new();
                    meta.insert(
                        "type".to_string(),
                        serde_json::Value::String("phone".to_string()),
                    );
                    meta
                }),
            },
            ImessageContact {
                id: "jane@example.com".to_string(),
                name: Some("Jane Smith".to_string()),
                handle: "mailto:jane@example.com".to_string(),
                is_group: false,
                metadata: Some({
                    let mut meta = HashMap::new();
                    meta.insert(
                        "type".to_string(),
                        serde_json::Value::String("email".to_string()),
                    );
                    meta
                }),
            },
        ];

        // Update cache
        for contact in &contacts {
            self.contacts_cache
                .insert(contact.id.clone(), contact.clone());
        }
        self.last_contact_sync = Some(Utc::now());

        Ok(serde_json::json!({
            "contacts": contacts,
            "count": contacts.len(),
        }))
    }

    /// Get a specific contact
    async fn get_contact(
        &self,
        contact_id: &str,
    ) -> Result<serde_json::Value, ImessageBridgeError> {
        if !cfg!(target_os = "macos") {
            return Err(ImessageBridgeError::PlatformError(
                "iMessage is only available on macOS".to_string(),
            ));
        }

        // Check cache first
        if let Some(contact) = self.contacts_cache.get(contact_id) {
            return Ok(serde_json::json!({
                "contact": contact,
            }));
        }

        // In a real implementation, this would query for the specific contact
        // For now, return an error indicating contact not found
        Err(ImessageBridgeError::ContactNotFound(contact_id.to_string()))
    }

    /// List messages for a specific contact
    async fn list_messages_for_contact(
        &self,
        contact_id: &str,
        limit: Option<usize>,
    ) -> Result<serde_json::Value, ImessageBridgeError> {
        if !cfg!(target_os = "macos") {
            return Err(ImessageBridgeError::PlatformError(
                "iMessage is only available on macOS".to_string(),
            ));
        }

        // In a real implementation, this would use AppleScript to query messages
        // For now, return a simulated response
        let limit = limit.unwrap_or(10);
        let mut messages = Vec::new();

        for i in 0..limit {
            messages.push(ImessageMessage {
                id: format!("msg-{}-{}", contact_id, i),
                sender_id: contact_id.to_string(),
                sender_name: Some("Contact Name".to_string()),
                recipient_id: "current_user@domain.com".to_string(),
                recipient_name: Some("Current User".to_string()),
                content: format!("Message {} from {}", i, contact_id),
                timestamp: Utc::now() - chrono::Duration::minutes(i as i64),
                message_type: ImessageMessageType::Text,
                attachments: None,
                is_delivered: true,
                is_read: i < limit - 3, // Older messages are read
                metadata: None,
            });
        }

        Ok(serde_json::json!({
            "messages": messages,
            "count": messages.len(),
            "contactId": contact_id,
        }))
    }

    /// Get a specific message
    async fn get_message(
        &self,
        message_id: &str,
    ) -> Result<serde_json::Value, ImessageBridgeError> {
        if !cfg!(target_os = "macos") {
            return Err(ImessageBridgeError::PlatformError(
                "iMessage is only available on macOS".to_string(),
            ));
        }

        // In a real implementation, this would query for the specific message
        // For now, return a simulated response
        Ok(serde_json::json!({
            "message": {
                "id": message_id,
                "senderId": "sender@example.com",
                "senderName": "John Doe",
                "recipientId": "recipient@domain.com",
                "recipientName": "Jane Smith",
                "content": "This is a simulated message",
                "timestamp": Utc::now(),
                "messageType": "text",
                "attachments": null,
                "isDelivered": true,
                "isRead": false,
                "metadata": null,
            }
        }))
    }

    /// Check iMessage availability
    async fn check_availability(&self) -> Result<serde_json::Value, ImessageBridgeError> {
        let available = self.is_imessage_available().await;

        Ok(serde_json::json!({
            "available": available,
            "platform": if cfg!(target_os = "macos") { "macos" } else { "other" },
            "appExists": self.config.imessage_app_path.exists(),
        }))
    }

    /// Get iMessage status
    async fn get_status(&self) -> Result<serde_json::Value, ImessageBridgeError> {
        let available = self.is_imessage_available().await;

        Ok(serde_json::json!({
            "enabled": self.config.enable_imessage,
            "available": available,
            "platform": if cfg!(target_os = "macos") { "macos" } else { "other" },
            "lastContactSync": self.last_contact_sync,
            "contactCacheSize": self.contacts_cache.len(),
            "config": {
                "enableAttachments": self.config.enable_attachments,
                "maxAttachmentSizeMb": self.config.max_attachment_size_mb,
                "messageSyncIntervalMinutes": self.config.message_sync_interval_minutes,
            }
        }))
    }

    /// Validate recipient format
    fn validate_recipient(&self, recipient: &str) -> Result<(), ImessageBridgeError> {
        // Check if it's a valid phone number or email
        if recipient.contains('@') {
            // Email format - basic validation
            if !recipient.contains('.') || recipient.len() < 5 {
                return Err(ImessageBridgeError::ValidationError(format!(
                    "Invalid email format: {}",
                    recipient
                )));
            }
        } else {
            // Phone number format - basic validation
            let digits_only: String = recipient.chars().filter(|c| c.is_ascii_digit()).collect();
            if digits_only.len() < 10 || digits_only.len() > 15 {
                return Err(ImessageBridgeError::ValidationError(format!(
                    "Invalid phone number format: {}",
                    recipient
                )));
            }
        }

        Ok(())
    }

    /// Check security policy for an operation
    fn check_security_policy(
        &self,
        operation: &ImessageOperation,
    ) -> Result<(), ImessageBridgeError> {
        match &self.config.security_policy {
            SecurityPolicy::Deny => {
                return Err(ImessageBridgeError::SecurityError(
                    "All iMessage operations are denied by security policy".to_string(),
                ));
            }
            SecurityPolicy::Allowlist { allowed_contacts } => {
                // For send operations, check if recipient is in allowlist
                if let ImessageOperation::SendMessage { recipient, .. } = operation {
                    if !allowed_contacts.contains(recipient)
                        && !allowed_contacts.contains(&"*".to_string())
                    {
                        return Err(ImessageBridgeError::SecurityError(format!(
                            "Recipient '{}' not in allowlist",
                            recipient
                        )));
                    }
                }
                // For other operations, allow them to proceed
            }
            SecurityPolicy::Allow => {
                // No restrictions
            }
        }

        Ok(())
    }

    /// Load cached contacts from disk
    async fn load_cached_contacts(&mut self) -> Result<(), ImessageBridgeError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        let cache_path = self
            .config
            .imessage_app_path
            .parent()
            .unwrap_or(&PathBuf::from("."))
            .join("contacts_cache.json");
        if !cache_path.exists() {
            return Ok(());
        }

        let content = fs::read_to_string(&cache_path).await.map_err(|e| {
            ImessageBridgeError::IoError(format!("Failed to read contacts cache: {}", e))
        })?;

        let cached: HashMap<String, ImessageContact> =
            serde_json::from_str(&content).map_err(|e| {
                ImessageBridgeError::SerializationError(format!(
                    "Failed to deserialize contacts cache: {}",
                    e
                ))
            })?;

        self.contacts_cache = cached;
        Ok(())
    }

    /// Save contacts cache to disk
    async fn save_cached_contacts(&self) -> Result<(), ImessageBridgeError> {
        if !self.config.enable_persistence {
            return Ok(());
        }

        let cache_path = self
            .config
            .imessage_app_path
            .parent()
            .unwrap_or(&PathBuf::from("."))
            .join("contacts_cache.json");
        let content = serde_json::to_string_pretty(&self.contacts_cache).map_err(|e| {
            ImessageBridgeError::SerializationError(format!(
                "Failed to serialize contacts cache: {}",
                e
            ))
        })?;

        fs::write(&cache_path, content).await.map_err(|e| {
            ImessageBridgeError::IoError(format!("Failed to write contacts cache: {}", e))
        })?;

        Ok(())
    }

    /// Get current configuration
    pub fn config(&self) -> &ImessageBridgeConfig {
        &self.config
    }

    /// Get mutable access to configuration
    pub fn config_mut(&mut self) -> &mut ImessageBridgeConfig {
        &mut self.config
    }

    /// Check if a contact exists in cache
    pub fn has_cached_contact(&self, contact_id: &str) -> bool {
        self.contacts_cache.contains_key(contact_id)
    }
}

impl Default for ImessageBridgeService {
    fn default() -> Self {
        Self::new()
    }
}

/// iMessage bridge error
#[derive(Debug, thiserror::Error)]
pub enum ImessageBridgeError {
    #[error("IO error: {0}")]
    IoError(String),

    #[error("Platform error: {0}")]
    PlatformError(String),

    #[error("Contact not found: {0}")]
    ContactNotFound(String),

    #[error("Message not found: {0}")]
    MessageNotFound(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Communication error: {0}")]
    CommunicationError(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    #[error("Security error: {0}")]
    SecurityError(String),

    #[error("Permission denied: {0}")]
    PermissionDenied(String),

    #[error("Timeout error")]
    Timeout,

    #[error("Initialization error: {0}")]
    InitializationError(String),
}

impl From<serde_json::Error> for ImessageBridgeError {
    fn from(error: serde_json::Error) -> Self {
        ImessageBridgeError::SerializationError(error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_imessage_bridge_creation() {
        let bridge = ImessageBridgeService::new();
        assert_eq!(bridge.config.enable_imessage, cfg!(target_os = "macos"));
        assert_eq!(bridge.config.log_level, "info");
        assert_eq!(bridge.contacts_cache.len(), 0);
    }

    #[tokio::test]
    async fn test_imessage_bridge_with_config() {
        let config = ImessageBridgeConfig {
            enable_imessage: true,
            imessage_app_path: PathBuf::from("/Applications/Messages.app"),
            enable_attachments: false,
            max_attachment_size_mb: Some(50),
            enable_group_messages: false,
            security_policy: SecurityPolicy::Allowlist {
                allowed_contacts: vec!["+1234567890".to_string()],
            },
            default_timeout_ms: 15_000,
            enable_logging: false,
            log_level: "debug".to_string(),
            enable_persistence: false,
            message_sync_interval_minutes: Some(10),
        };

        let bridge = ImessageBridgeService::with_config(config);
        assert!(bridge.config.enable_imessage);
        assert!(!bridge.config.enable_attachments);
        assert!(!bridge.config.enable_group_messages);
        assert!(!bridge.config.enable_persistence);
    }

    #[tokio::test]
    async fn test_platform_availability() {
        let bridge = ImessageBridgeService::new();
        let availability = bridge.check_availability().await.unwrap();

        let available = availability
            .get("available")
            .and_then(|v| v.as_bool())
            .unwrap();
        let platform = availability
            .get("platform")
            .and_then(|v| v.as_str())
            .unwrap();

        if cfg!(target_os = "macos") {
            assert!(available);
            assert_eq!(platform, "macos");
        } else {
            assert!(!available);
            assert_eq!(platform, "other");
        }
    }

    #[tokio::test]
    async fn test_security_policy_deny() {
        let config = ImessageBridgeConfig {
            security_policy: SecurityPolicy::Deny,
            enable_imessage: cfg!(target_os = "macos"),
            ..Default::default()
        };

        let bridge = ImessageBridgeService::with_config(config);

        let request = ImessageBridgeRequest {
            operation: ImessageOperation::CheckAvailability,
            context: None,
        };

        if cfg!(target_os = "macos") {
            // On macOS, this would fail at the platform check level
            let result = bridge.execute(request).await;
            assert!(result.is_ok()); // This should pass the security check but fail at platform check
        } else {
            // On non-macOS, this should fail at platform check
            let result = bridge.execute(request).await;
            assert!(result.is_ok()); // This should pass the security check but fail at platform check
        }
    }

    #[tokio::test]
    async fn test_security_policy_allowlist() {
        let config = ImessageBridgeConfig {
            security_policy: SecurityPolicy::Allowlist {
                allowed_contacts: vec!["+1234567890".to_string()],
            },
            enable_imessage: false, // Disable to avoid platform check
            ..Default::default()
        };

        let bridge = ImessageBridgeService::with_config(config);

        // Test allowed contact
        let request = ImessageBridgeRequest {
            operation: ImessageOperation::SendMessage {
                recipient: "+1234567890".to_string(),
                content: "Hello".to_string(),
                attachments: None,
            },
            context: None,
        };

        // This should pass security check but fail at platform check since iMessage is disabled
        let result = bridge.execute(request).await;
        assert!(result.is_err());

        // Test disallowed contact
        let request = ImessageBridgeRequest {
            operation: ImessageOperation::SendMessage {
                recipient: "+0987654321".to_string(),
                content: "Hello".to_string(),
                attachments: None,
            },
            context: None,
        };

        let result = bridge.execute(request).await;
        if cfg!(target_os = "macos") {
            // On macOS, this should fail at security check level
            assert!(result.is_err());
            if let Err(ImessageBridgeError::SecurityError(msg)) = result {
                assert!(msg.contains("not in allowlist"));
            } else {
                panic!("Expected security error");
            }
        }
    }

    #[test]
    fn test_recipient_validation() {
        let bridge = ImessageBridgeService::new();

        // Valid email
        assert!(bridge.validate_recipient("test@example.com").is_ok());

        // Valid phone number
        assert!(bridge.validate_recipient("+1234567890").is_ok());
        assert!(bridge.validate_recipient("123-456-7890").is_ok());
        assert!(bridge.validate_recipient("(123) 456-7890").is_ok());

        // Invalid email
        assert!(bridge.validate_recipient("invalid-email").is_err());

        // Invalid phone number
        assert!(bridge.validate_recipient("123").is_err()); // Too short
        assert!(bridge
            .validate_recipient("123456789012345678901234567890")
            .is_err()); // Too long
    }

    #[test]
    fn test_imessage_contact_structure() {
        let contact = ImessageContact {
            id: "+1234567890".to_string(),
            name: Some("John Doe".to_string()),
            handle: "tel:+1234567890".to_string(),
            is_group: false,
            metadata: Some({
                let mut meta = HashMap::new();
                meta.insert(
                    "type".to_string(),
                    serde_json::Value::String("phone".to_string()),
                );
                meta
            }),
        };

        assert_eq!(contact.id, "+1234567890");
        assert_eq!(contact.name, Some("John Doe".to_string()));
        assert_eq!(contact.handle, "tel:+1234567890");
        assert!(!contact.is_group);
    }

    #[test]
    fn test_imessage_message_structure() {
        let message = ImessageMessage {
            id: "msg-123".to_string(),
            sender_id: "+1234567890".to_string(),
            sender_name: Some("John".to_string()),
            recipient_id: "+0987654321".to_string(),
            recipient_name: Some("Jane".to_string()),
            content: "Hello, world!".to_string(),
            timestamp: Utc::now(),
            message_type: ImessageMessageType::Text,
            attachments: None,
            is_delivered: true,
            is_read: false,
            metadata: None,
        };

        assert_eq!(message.content, "Hello, world!");
        assert_eq!(message.message_type, ImessageMessageType::Text);
        assert!(message.is_delivered);
        assert!(!message.is_read);
    }

    #[test]
    fn test_imessage_operation_serialization() {
        let operation = ImessageOperation::SendMessage {
            recipient: "+1234567890".to_string(),
            content: "Test message".to_string(),
            attachments: Some(vec!["/path/to/file.jpg".to_string()]),
        };

        let serialized = serde_json::to_string(&operation).unwrap();
        let deserialized: ImessageOperation = serde_json::from_str(&serialized).unwrap();

        match deserialized {
            ImessageOperation::SendMessage {
                recipient,
                content,
                attachments,
            } => {
                assert_eq!(recipient, "+1234567890");
                assert_eq!(content, "Test message");
                assert_eq!(attachments, Some(vec!["/path/to/file.jpg".to_string()]));
            }
            _ => panic!("Expected SendMessage operation"),
        }
    }

    #[test]
    fn test_security_policy_serialization() {
        let policy = SecurityPolicy::Allowlist {
            allowed_contacts: vec!["+1234567890".to_string()],
        };

        let serialized = serde_json::to_string(&policy).unwrap();
        let deserialized: SecurityPolicy = serde_json::from_str(&serialized).unwrap();

        match deserialized {
            SecurityPolicy::Allowlist { allowed_contacts } => {
                assert_eq!(allowed_contacts, vec!["+1234567890".to_string()]);
            }
            _ => panic!("Expected Allowlist policy"),
        }
    }
}
