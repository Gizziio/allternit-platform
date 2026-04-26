//! # Allternit Transport SMS
//!
//! SMS transport provider for the Allternit messaging system.
//!
//! ## Overview
//!
//! This crate provides SMS transport capabilities for the Allternit platform,
//! supporting multiple SMS providers including Telnyx and Twilio. It
//! handles message sending, delivery status tracking, and provider
//! abstraction.
//!
//! ## Supported Providers
//!
//! - **Telnyx**: Enterprise SMS API with global reach
//! - **Twilio**: Industry-standard SMS and messaging platform
//!
//! ## Key Concepts
//!
//! - **SmsProvider**: Trait for SMS provider implementations
//! - **SmsMessage**: SMS message structure
//! - **SmsDeliveryStatus**: Delivery tracking and status
//! - **SmsBackend**: Unified backend for multiple providers
//! - **SmsTransport**: High-level transport interface
//!
//! ## Example
//!
//! ```rust,no_run
//! use transport_sms::{SmsTransport, SmsBackend, TelnyxProvider};
//!
//! // Create a Telnyx provider
//! let provider = TelnyxProvider::new(
//!     "your-api-key".to_string(),
//!     "+1234567890".to_string(),
//! );
//!
//! // Create the SMS transport
//! let transport = SmsTransport::new(SmsBackend::Telnyx(provider));
//!
//! // Send a message (in async context)
//! // let message_id = transport.send_message(sms_message).await?;
//! ```

use anyhow::Result;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info};

/// SMS message structure.
///
/// `SmsMessage` represents an SMS message to be sent, including
/// the recipient, sender, message body, and optional media URLs.
///
/// # Examples
///
/// ```
/// use transport_sms::SmsMessage;
///
/// let message = SmsMessage {
///     to: "+1234567890".to_string(),
///     from: "+0987654321".to_string(),
///     body: "Hello from Allternit!".to_string(),
///     media_urls: vec![],
/// };
/// ```
#[derive(Debug, Serialize, Deserialize)]
pub struct SmsMessage {
    /// Recipient phone number (E.164 format recommended)
    pub to: String,
    
    /// Sender phone number (E.164 format)
    pub from: String,
    
    /// Message body text
    pub body: String,
    
    /// Optional media URLs for MMS
    pub media_urls: Vec<String>,
}

impl SmsMessage {
    /// Creates a new SMS message.
    ///
    /// # Arguments
    ///
    /// * `to` - Recipient phone number
    /// * `from` - Sender phone number
    /// * `body` - Message body text
    ///
    /// # Examples
    ///
    /// ```
    /// use transport_sms::SmsMessage;
    ///
    /// let message = SmsMessage::new(
    ///     "+1234567890",
    ///     "+0987654321",
    ///     "Hello!",
    /// );
    ///
    /// assert_eq!(message.to, "+1234567890");
    /// assert_eq!(message.body, "Hello!");
    /// ```
    pub fn new(to: impl Into<String>, from: impl Into<String>, body: impl Into<String>) -> Self {
        Self {
            to: to.into(),
            from: from.into(),
            body: body.into(),
            media_urls: Vec::new(),
        }
    }
    
    /// Adds a media URL to the message (converts to MMS).
    ///
    /// # Arguments
    ///
    /// * `url` - URL to the media file
    ///
    /// # Examples
    ///
    /// ```
    /// use transport_sms::SmsMessage;
    ///
    /// let mut message = SmsMessage::new("+1234567890", "+0987654321", "Check this out!");
    /// message.add_media("https://example.com/image.jpg");
    ///
    /// assert_eq!(message.media_urls.len(), 1);
    /// ```
    pub fn add_media(&mut self, url: impl Into<String>) {
        self.media_urls.push(url.into());
    }
    
    /// Returns true if this is an MMS (has media attachments).
    pub fn is_mms(&self) -> bool {
        !self.media_urls.is_empty()
    }
    
    /// Returns the character count of the message body.
    pub fn character_count(&self) -> usize {
        self.body.chars().count()
    }
    
    /// Returns true if the message body exceeds standard SMS length (160 chars).
    pub fn is_multipart(&self) -> bool {
        self.character_count() > 160
    }
}

/// SMS delivery status.
///
/// `SmsDeliveryStatus` tracks the delivery state of an SMS message
/// from the time it's queued until final delivery or failure.
///
/// # Examples
///
/// ```
/// use transport_sms::{SmsDeliveryStatus, DeliveryStatus};
///
/// let status = SmsDeliveryStatus {
///     message_id: "msg-123".to_string(),
///     status: DeliveryStatus::Delivered,
///     timestamp: 1704067200,
/// };
///
/// assert!(status.is_delivered());
/// ```
#[derive(Debug, Serialize, Deserialize)]
pub struct SmsDeliveryStatus {
    /// Provider-specific message identifier
    pub message_id: String,
    
    /// Current delivery status
    pub status: DeliveryStatus,
    
    /// Status timestamp (Unix epoch)
    pub timestamp: u64,
}

impl SmsDeliveryStatus {
    /// Returns true if the message was delivered successfully.
    pub fn is_delivered(&self) -> bool {
        matches!(self.status, DeliveryStatus::Delivered)
    }
    
    /// Returns true if the message delivery failed.
    pub fn is_failed(&self) -> bool {
        matches!(self.status, DeliveryStatus::Failed)
    }
    
    /// Returns true if the message is still in progress.
    pub fn is_pending(&self) -> bool {
        matches!(self.status, DeliveryStatus::Queued | DeliveryStatus::Sending | DeliveryStatus::Sent)
    }
}

/// Delivery status variants for SMS messages.
///
/// `DeliveryStatus` represents the lifecycle states of an SMS
/// message as it progresses through the delivery pipeline.
#[derive(Debug, Serialize, Deserialize)]
pub enum DeliveryStatus {
    /// Message is queued for sending
    Queued,
    /// Message is currently being sent
    Sending,
    /// Message has been sent to carrier
    Sent,
    /// Message has been delivered to recipient
    Delivered,
    /// Message delivery failed
    Failed,
}

/// Trait for SMS provider implementations.
///
/// `SmsProvider` defines the interface that all SMS provider
/// implementations must provide. It abstracts the differences
/// between various SMS APIs.
#[async_trait]
pub trait SmsProvider: Send + Sync {
    /// Sends an SMS message.
    ///
    /// # Arguments
    ///
    /// * `message` - The SMS message to send
    ///
    /// # Returns
    ///
    /// The provider-specific message ID, or an error if sending fails
    async fn send_sms(&self, message: &SmsMessage) -> Result<String>;
    
    /// Checks the delivery status of a message.
    ///
    /// # Arguments
    ///
    /// * `message_id` - The provider-specific message ID
    ///
    /// # Returns
    ///
    /// The current delivery status, or an error if the check fails
    async fn check_status(&self, message_id: &str) -> Result<SmsDeliveryStatus>;
    
    /// Returns the provider name.
    fn provider_name(&self) -> &'static str;
}

/// Telnyx SMS provider implementation.
///
/// `TelnyxProvider` implements SMS sending and status checking
/// using the Telnyx messaging API.
pub struct TelnyxProvider {
    api_key: String,
    from_number: String,
}

impl TelnyxProvider {
    /// Creates a new Telnyx provider.
    ///
    /// # Arguments
    ///
    /// * `api_key` - Telnyx API key
    /// * `from_number` - Default sender phone number
    ///
    /// # Examples
    ///
    /// ```
    /// use transport_sms::TelnyxProvider;
    ///
    /// let provider = TelnyxProvider::new(
    ///     "YOUR_API_KEY".to_string(),
    ///     "+1234567890".to_string(),
    /// );
    /// ```
    pub fn new(api_key: String, from_number: String) -> Self {
        Self { api_key, from_number }
    }
    
    /// Sends an SMS via Telnyx API.
    async fn send_via_telnyx(&self, message: &SmsMessage) -> Result<String> {
        let client = reqwest::Client::new();
        let url = "https://api.telnyx.com/v2/messages";

        let payload = serde_json::json!({
            "from": message.from,
            "to": message.to,
            "text": message.body,
            "media_urls": message.media_urls
        });

        let response = client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if response.status().is_success() {
            let response_json: serde_json::Value = response.json().await?;
            let message_id = response_json["data"]["id"].as_str().unwrap_or_default().to_string();
            Ok(message_id)
        } else {
            let error_text = response.text().await?;
            error!("Telnyx API error: {}", error_text);
            Err(anyhow::anyhow!("Telnyx API error: {}", error_text))
        }
    }
}

#[async_trait]
impl SmsProvider for TelnyxProvider {
    async fn send_sms(&self, message: &SmsMessage) -> Result<String> {
        info!("Sending SMS via Telnyx: {} -> {}", message.from, message.to);
        self.send_via_telnyx(message).await
    }

    async fn check_status(&self, message_id: &str) -> Result<SmsDeliveryStatus> {
        let client = reqwest::Client::new();
        let url = format!("https://api.telnyx.com/v2/messages/{}", message_id);

        let response = client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await?;

        if response.status().is_success() {
            let response_json: serde_json::Value = response.json().await?;
            let status_str = response_json["data"]["status"].as_str().unwrap_or("unknown");
            
            let status = match status_str {
                "queued" => DeliveryStatus::Queued,
                "sending" => DeliveryStatus::Sending,
                "sent" => DeliveryStatus::Sent,
                "delivered" => DeliveryStatus::Delivered,
                "failed" => DeliveryStatus::Failed,
                _ => DeliveryStatus::Failed,
            };

            Ok(SmsDeliveryStatus {
                message_id: message_id.to_string(),
                status,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            })
        } else {
            let error_text = response.text().await?;
            error!("Telnyx status check error: {}", error_text);
            Err(anyhow::anyhow!("Telnyx status check error: {}", error_text))
        }
    }
    
    fn provider_name(&self) -> &'static str {
        "telnyx"
    }
}

/// Twilio SMS provider implementation.
///
/// `TwilioProvider` implements SMS sending and status checking
/// using the Twilio messaging API.
pub struct TwilioProvider {
    account_sid: String,
    auth_token: String,
    from_number: String,
}

impl TwilioProvider {
    /// Creates a new Twilio provider.
    ///
    /// # Arguments
    ///
    /// * `account_sid` - Twilio Account SID
    /// * `auth_token` - Twilio Auth Token
    /// * `from_number` - Default sender phone number
    ///
    /// # Examples
    ///
    /// ```
    /// use transport_sms::TwilioProvider;
    ///
    /// let provider = TwilioProvider::new(
    ///     "YOUR_ACCOUNT_SID".to_string(),
    ///     "YOUR_AUTH_TOKEN".to_string(),
    ///     "+1234567890".to_string(),
    /// );
    /// ```
    pub fn new(account_sid: String, auth_token: String, from_number: String) -> Self {
        Self {
            account_sid,
            auth_token,
            from_number,
        }
    }
    
    /// Sends an SMS via Twilio API.
    async fn send_via_twilio(&self, message: &SmsMessage) -> Result<String> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            self.account_sid
        );

        let mut params = HashMap::new();
        params.insert("From", &message.from);
        params.insert("To", &message.to);
        params.insert("Body", &message.body);

        let response = client
            .post(&url)
            .basic_auth(&self.account_sid, Some(&self.auth_token))
            .form(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let response_json: serde_json::Value = response.json().await?;
            let message_sid = response_json["sid"].as_str().unwrap_or_default().to_string();
            Ok(message_sid)
        } else {
            let error_text = response.text().await?;
            error!("Twilio API error: {}", error_text);
            Err(anyhow::anyhow!("Twilio API error: {}", error_text))
        }
    }
}

#[async_trait]
impl SmsProvider for TwilioProvider {
    async fn send_sms(&self, message: &SmsMessage) -> Result<String> {
        info!("Sending SMS via Twilio: {} -> {}", message.from, message.to);
        self.send_via_twilio(message).await
    }

    async fn check_status(&self, message_id: &str) -> Result<SmsDeliveryStatus> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages/{}.json",
            self.account_sid, message_id
        );

        let response = client
            .get(&url)
            .basic_auth(&self.account_sid, Some(&self.auth_token))
            .send()
            .await?;

        if response.status().is_success() {
            let response_json: serde_json::Value = response.json().await?;
            let status_str = response_json["status"].as_str().unwrap_or("unknown");
            
            let status = match status_str {
                "queued" => DeliveryStatus::Queued,
                "sending" => DeliveryStatus::Sending,
                "sent" => DeliveryStatus::Sent,
                "delivered" => DeliveryStatus::Delivered,
                "failed" => DeliveryStatus::Failed,
                _ => DeliveryStatus::Failed,
            };

            Ok(SmsDeliveryStatus {
                message_id: message_id.to_string(),
                status,
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap()
                    .as_secs(),
            })
        } else {
            let error_text = response.text().await?;
            error!("Twilio status check error: {}", error_text);
            Err(anyhow::anyhow!("Twilio status check error: {}", error_text))
        }
    }
    
    fn provider_name(&self) -> &'static str {
        "twilio"
    }
}

/// Unified SMS backend supporting multiple providers.
///
/// `SmsBackend` provides a unified interface over multiple SMS
/// provider implementations, allowing runtime provider selection.
pub enum SmsBackend {
    /// Telnyx provider backend
    Telnyx(TelnyxProvider),
    /// Twilio provider backend
    Twilio(TwilioProvider),
}

#[async_trait]
impl SmsProvider for SmsBackend {
    async fn send_sms(&self, message: &SmsMessage) -> Result<String> {
        match self {
            SmsBackend::Telnyx(provider) => provider.send_sms(message).await,
            SmsBackend::Twilio(provider) => provider.send_sms(message).await,
        }
    }

    async fn check_status(&self, message_id: &str) -> Result<SmsDeliveryStatus> {
        match self {
            SmsBackend::Telnyx(provider) => provider.check_status(message_id).await,
            SmsBackend::Twilio(provider) => provider.check_status(message_id).await,
        }
    }
    
    fn provider_name(&self) -> &'static str {
        match self {
            SmsBackend::Telnyx(_) => "telnyx",
            SmsBackend::Twilio(_) => "twilio",
        }
    }
}

/// High-level SMS transport interface.
///
/// `SmsTransport` provides a simplified interface for sending
/// SMS messages and checking their delivery status.
pub struct SmsTransport {
    provider: SmsBackend,
}

impl SmsTransport {
    /// Creates a new SMS transport with the given provider backend.
    ///
    /// # Arguments
    ///
    /// * `provider` - The SMS provider backend to use
    ///
    /// # Examples
    ///
    /// ```
    /// use transport_sms::{SmsTransport, SmsBackend, TelnyxProvider};
    ///
    /// let provider = TelnyxProvider::new("api-key".to_string(), "+1234567890".to_string());
    /// let transport = SmsTransport::new(SmsBackend::Telnyx(provider));
    /// ```
    pub fn new(provider: SmsBackend) -> Self {
        Self { provider }
    }

    /// Sends an SMS message.
    ///
    /// # Arguments
    ///
    /// * `message` - The SMS message to send
    ///
    /// # Returns
    ///
    /// The provider-specific message ID
    ///
    /// # Examples
    ///
    /// ```rust,ignore
    /// use transport_sms::{SmsTransport, SmsBackend, TelnyxProvider, SmsMessage};
    ///
    /// async fn example() -> anyhow::Result<()> {
    ///     let provider = TelnyxProvider::new("api-key".to_string(), "+1234567890".to_string());
    ///     let transport = SmsTransport::new(SmsBackend::Telnyx(provider));
    ///
    ///     let message = SmsMessage::new("+1234567890", "+0987654321", "Hello!");
    ///     let message_id = transport.send_message(message).await?;
    ///
    ///     Ok(())
    /// }
    /// ```
    pub async fn send_message(&self, message: SmsMessage) -> Result<String> {
        self.provider.send_sms(&message).await
    }

    /// Checks the delivery status of a message.
    ///
    /// # Arguments
    ///
    /// * `message_id` - The provider-specific message ID
    ///
    /// # Returns
    ///
    /// The current delivery status
    pub async fn check_message_status(&self, message_id: &str) -> Result<SmsDeliveryStatus> {
        self.provider.check_status(message_id).await
    }
    
    /// Returns the active provider name.
    pub fn provider_name(&self) -> &'static str {
        self.provider.provider_name()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test SMS message creation
    #[test]
    fn test_sms_message() {
        let message = SmsMessage::new("+1234567890", "+0987654321", "Hello!");
        
        assert_eq!(message.to, "+1234567890");
        assert_eq!(message.from, "+0987654321");
        assert_eq!(message.body, "Hello!");
        assert!(!message.is_mms());
        assert!(!message.is_multipart());
    }

    /// Test MMS message with media
    #[test]
    fn test_mms_message() {
        let mut message = SmsMessage::new("+1234567890", "+0987654321", "Check this out!");
        message.add_media("https://example.com/image.jpg");
        
        assert!(message.is_mms());
        assert_eq!(message.media_urls.len(), 1);
    }

    /// Test multipart message detection
    #[test]
    fn test_multipart_detection() {
        let short = SmsMessage::new("+1234567890", "+0987654321", "Short");
        assert!(!short.is_multipart());
        
        let long = SmsMessage::new("+1234567890", "+0987654321", "a".repeat(200));
        assert!(long.is_multipart());
    }

    /// Test delivery status
    #[test]
    fn test_delivery_status() {
        let delivered = SmsDeliveryStatus {
            message_id: "msg-1".to_string(),
            status: DeliveryStatus::Delivered,
            timestamp: 1704067200,
        };
        assert!(delivered.is_delivered());
        assert!(!delivered.is_failed());
        
        let failed = SmsDeliveryStatus {
            message_id: "msg-2".to_string(),
            status: DeliveryStatus::Failed,
            timestamp: 1704067200,
        };
        assert!(!failed.is_delivered());
        assert!(failed.is_failed());
        
        let queued = SmsDeliveryStatus {
            message_id: "msg-3".to_string(),
            status: DeliveryStatus::Queued,
            timestamp: 1704067200,
        };
        assert!(queued.is_pending());
    }
}
