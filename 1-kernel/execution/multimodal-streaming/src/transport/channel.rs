//! SCTP Data Channel Implementation
//!
//! WIH: GAP-42, Owner: T2-A4
//! Dependencies: GAP-42 (DTLS Transport)
//! Coordinates with: T2-A5 (Signaling Integration for channel setup)
//!
//! This module implements SCTP-based data channels for WebRTC
//! as defined in RFC 4960 (SCTP) and RFC 8832 (WebRTC Data Channels).
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for SCTP implementation pending full stack
//! - Binary data support for arbitrary payloads

use crate::types::{StreamingError, StreamingResult};
use crate::transport::dtls::DtlsTransport;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{Duration, Instant};
use tracing::{debug, error, info, trace, warn};

/// Data channel version
pub const DATA_CHANNEL_VERSION: &str = "0.1.0";

/// Default data channel buffer size
pub const DEFAULT_BUFFER_SIZE: usize = 256 * 1024; // 256KB

/// Maximum data channel message size
pub const MAX_MESSAGE_SIZE: usize = 256 * 1024; // 256KB

/// Data channel configuration
#[derive(Debug, Clone)]
pub struct DataChannelConfig {
    /// Channel label (identifier)
    pub label: String,
    /// Whether channel is ordered (guaranteed delivery order)
    pub ordered: bool,
    /// Maximum retransmissions (0 = reliable, >0 = partially reliable)
    pub max_retransmits: Option<u16>,
    /// Maximum packet lifetime in milliseconds
    pub max_packet_life: Option<u16>,
    /// Protocol string
    pub protocol: String,
    /// Whether negotiated out-of-band
    pub negotiated: bool,
    /// Negotiated channel ID (if negotiated)
    pub id: Option<u16>,
    /// Buffer size in bytes
    pub buffer_size: usize,
    /// Priority
    pub priority: DataChannelPriority,
}

impl Default for DataChannelConfig {
    fn default() -> Self {
        Self {
            label: "default".to_string(),
            ordered: true,
            max_retransmits: None,
            max_packet_life: None,
            protocol: "".to_string(),
            negotiated: false,
            id: None,
            buffer_size: DEFAULT_BUFFER_SIZE,
            priority: DataChannelPriority::Normal,
        }
    }
}

/// Data channel priority
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum DataChannelPriority {
    /// Very low priority
    VeryLow = 0,
    /// Low priority
    Low = 1,
    /// Normal priority
    Normal = 2,
    /// High priority
    High = 3,
    /// Very high priority
    VeryHigh = 4,
}

/// Data channel state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DataChannelState {
    /// Connecting (initializing)
    Connecting,
    /// Open and ready for data
    Open,
    /// Closing
    Closing,
    /// Closed
    Closed,
}

/// Data channel message type
#[derive(Debug, Clone)]
pub enum DataChannelMessage {
    /// String message (UTF-8 text)
    Text(String),
    /// Binary message
    Binary(Vec<u8>),
}

impl DataChannelMessage {
    /// Get message as bytes
    pub fn as_bytes(&self) -> Vec<u8> {
        match self {
            DataChannelMessage::Text(text) => text.as_bytes().to_vec(),
            DataChannelMessage::Binary(data) => data.clone(),
        }
    }

    /// Get message size in bytes
    pub fn len(&self) -> usize {
        match self {
            DataChannelMessage::Text(text) => text.len(),
            DataChannelMessage::Binary(data) => data.len(),
        }
    }

    /// Check if message is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Check if this is a binary message
    pub fn is_binary(&self) -> bool {
        matches!(self, DataChannelMessage::Binary(_))
    }

    /// Check if this is a text message
    pub fn is_text(&self) -> bool {
        matches!(self, DataChannelMessage::Text(_))
    }
}

/// Data channel for reliable/unordered binary data transfer
///
/// WIH: GAP-42, Owner: T2-A4
#[derive(Clone)]
pub struct DataChannel {
    /// Channel ID
    channel_id: String,
    /// SCTP stream ID
    stream_id: u16,
    /// Configuration
    config: DataChannelConfig,
    /// Current state
    state: Arc<RwLock<DataChannelState>>,
    /// Message sender
    message_sender: mpsc::UnboundedSender<DataChannelMessage>,
    /// Message receiver (held internally)
    message_receiver: Arc<Mutex<mpsc::UnboundedReceiver<DataChannelMessage>>>,
    /// Buffered amount (pending bytes)
    buffered_amount: Arc<RwLock<usize>>,
    /// Total bytes sent
    bytes_sent: Arc<RwLock<u64>>,
    /// Total bytes received
    bytes_received: Arc<RwLock<u64>>,
    /// Messages sent
    messages_sent: Arc<RwLock<u64>>,
    /// Messages received
    messages_received: Arc<RwLock<u64>>,
    /// Opened at timestamp
    opened_at: Arc<RwLock<Option<Instant>>>,
    /// Close signal sender
    close_sender: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
}

impl std::fmt::Debug for DataChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DataChannel")
            .field("channel_id", &self.channel_id)
            .field("stream_id", &self.stream_id)
            .field("label", &self.config.label)
            .finish()
    }
}

impl DataChannel {
    /// Create a new data channel
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub fn new(
        channel_id: impl Into<String>,
        stream_id: u16,
        config: DataChannelConfig,
    ) -> Self {
        let channel_id = channel_id.into();
        let (sender, receiver) = mpsc::unbounded_channel();

        info!("DataChannel {}: Created '{}' (stream_id: {})",
            channel_id, config.label, stream_id);

        Self {
            channel_id,
            stream_id,
            config,
            state: Arc::new(RwLock::new(DataChannelState::Connecting)),
            message_sender: sender,
            message_receiver: Arc::new(Mutex::new(receiver)),
            buffered_amount: Arc::new(RwLock::new(0)),
            bytes_sent: Arc::new(RwLock::new(0)),
            bytes_received: Arc::new(RwLock::new(0)),
            messages_sent: Arc::new(RwLock::new(0)),
            messages_received: Arc::new(RwLock::new(0)),
            opened_at: Arc::new(RwLock::new(None)),
            close_sender: Arc::new(Mutex::new(None)),
        }
    }

    /// Get channel ID
    pub fn channel_id(&self) -> &str {
        &self.channel_id
    }

    /// Get stream ID
    pub fn stream_id(&self) -> u16 {
        self.stream_id
    }

    /// Get label
    pub fn label(&self) -> &str {
        &self.config.label
    }

    /// Get current state
    pub async fn state(&self) -> DataChannelState {
        *self.state.read().await
    }

    /// Get configuration
    pub fn config(&self) -> &DataChannelConfig {
        &self.config
    }

    /// Open the data channel
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn open(&self) -> StreamingResult<()> {
        info!("DataChannel {}: Opening", self.channel_id);

        let mut state = self.state.write().await;
        if *state != DataChannelState::Connecting {
            return Err(StreamingError::WebRtc(
                "Channel not in Connecting state".to_string()
            ));
        }
        *state = DataChannelState::Open;
        drop(state);

        let mut opened_at = self.opened_at.write().await;
        *opened_at = Some(Instant::now());

        info!("DataChannel {}: Opened", self.channel_id);
        Ok(())
    }

    /// Send a text message
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn send_text(&self, text: impl Into<String>) -> StreamingResult<()> {
        let text = text.into();
        
        if text.len() > MAX_MESSAGE_SIZE {
            return Err(StreamingError::WebRtc(
                format!("Message too large: {} bytes", text.len())
            ));
        }

        let state = self.state.read().await;
        if *state != DataChannelState::Open {
            return Err(StreamingError::WebRtc(
                "Channel not open".to_string()
            ));
        }
        drop(state);

        let message = DataChannelMessage::Text(text);
        let size = message.len();

        self.message_sender.send(message)
            .map_err(|_| StreamingError::WebRtc(
                "Message channel closed".to_string()
            ))?;

        // Update stats
        {
            let mut buffered = self.buffered_amount.write().await;
            *buffered += size;
        }
        {
            let mut bytes = self.bytes_sent.write().await;
            *bytes += size as u64;
        }
        {
            let mut messages = self.messages_sent.write().await;
            *messages += 1;
        }

        trace!("DataChannel {}: Sent text message ({} bytes)", 
            self.channel_id, size);

        Ok(())
    }

    /// Send binary data
    ///
    /// Used for sending arbitrary binary data over the secure channel.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn send_binary(&self, data: Vec<u8>) -> StreamingResult<()> {
        if data.len() > MAX_MESSAGE_SIZE {
            return Err(StreamingError::WebRtc(
                format!("Binary data too large: {} bytes", data.len())
            ));
        }

        let state = self.state.read().await;
        if *state != DataChannelState::Open {
            return Err(StreamingError::WebRtc(
                "Channel not open".to_string()
            ));
        }
        drop(state);

        let message = DataChannelMessage::Binary(data);
        let size = message.len();

        self.message_sender.send(message)
            .map_err(|_| StreamingError::WebRtc(
                "Message channel closed".to_string()
            ))?;

        // Update stats
        {
            let mut buffered = self.buffered_amount.write().await;
            *buffered += size;
        }
        {
            let mut bytes = self.bytes_sent.write().await;
            *bytes += size as u64;
        }
        {
            let mut messages = self.messages_sent.write().await;
            *messages += 1;
        }

        trace!("DataChannel {}: Sent binary message ({} bytes)", 
            self.channel_id, size);

        Ok(())
    }

    /// Receive a message (non-blocking)
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn receive(&self) -> Option<DataChannelMessage> {
        let mut receiver = self.message_receiver.lock().await;
        
        match receiver.try_recv() {
            Ok(message) => {
                let size = message.len();
                
                // Update stats
                {
                    let mut bytes = self.bytes_received.write().await;
                    *bytes += size as u64;
                }
                {
                    let mut messages = self.messages_received.write().await;
                    *messages += 1;
                }
                {
                    let mut buffered = self.buffered_amount.write().await;
                    *buffered = buffered.saturating_sub(size);
                }

                trace!("DataChannel {}: Received message ({} bytes)",
                    self.channel_id, size);

                Some(message)
            }
            Err(_) => None,
        }
    }

    /// Receive a message (blocking with timeout)
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn receive_timeout(&self, duration: Duration) -> Option<DataChannelMessage> {
        let mut receiver = self.message_receiver.lock().await;
        
        match tokio::time::timeout(duration, receiver.recv()).await {
            Ok(Some(message)) => {
                let size = message.len();
                
                // Update stats
                {
                    let mut bytes = self.bytes_received.write().await;
                    *bytes += size as u64;
                }
                {
                    let mut messages = self.messages_received.write().await;
                    *messages += 1;
                }
                {
                    let mut buffered = self.buffered_amount.write().await;
                    *buffered = buffered.saturating_sub(size);
                }

                Some(message)
            }
            _ => None,
        }
    }

    /// Get buffered amount (pending bytes)
    pub async fn buffered_amount(&self) -> usize {
        *self.buffered_amount.read().await
    }

    /// Close the data channel
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn close(&self) -> StreamingResult<()> {
        info!("DataChannel {}: Closing", self.channel_id);

        let mut state = self.state.write().await;
        if *state == DataChannelState::Closed {
            return Ok(());
        }
        *state = DataChannelState::Closing;
        drop(state);

        // Signal close
        let mut close_sender = self.close_sender.lock().await;
        if let Some(sender) = close_sender.take() {
            let _ = sender.send(());
        }

        let mut state = self.state.write().await;
        *state = DataChannelState::Closed;

        info!("DataChannel {}: Closed", self.channel_id);
        Ok(())
    }

    /// Get channel statistics
    pub async fn stats(&self) -> DataChannelStats {
        DataChannelStats {
            channel_id: self.channel_id.clone(),
            stream_id: self.stream_id,
            label: self.config.label.clone(),
            state: self.state().await,
            buffered_amount: *self.buffered_amount.read().await,
            bytes_sent: *self.bytes_sent.read().await,
            bytes_received: *self.bytes_received.read().await,
            messages_sent: *self.messages_sent.read().await,
            messages_received: *self.messages_received.read().await,
            uptime_secs: self.opened_at.read().await.map(|t| t.elapsed().as_secs()),
        }
    }
}

/// Data channel statistics
#[derive(Debug, Clone)]
pub struct DataChannelStats {
    pub channel_id: String,
    pub stream_id: u16,
    pub label: String,
    pub state: DataChannelState,
    pub buffered_amount: usize,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub messages_sent: u64,
    pub messages_received: u64,
    pub uptime_secs: Option<u64>,
}

/// Data channel manager for handling multiple channels
///
/// WIH: GAP-42, Owner: T2-A4
pub struct DataChannelManager {
    /// Manager ID
    manager_id: String,
    /// Active channels
    channels: Arc<RwLock<HashMap<String, DataChannel>>>,
    /// Stream ID to channel mapping
    stream_to_channel: Arc<RwLock<HashMap<u16, String>>>,
    /// Next stream ID
    next_stream_id: Arc<RwLock<u16>>,
    /// DTLS transport
    dtls_transport: Arc<RwLock<Option<DtlsTransport>>>,
}

impl DataChannelManager {
    /// Create a new data channel manager
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub fn new(manager_id: impl Into<String>) -> Self {
        Self {
            manager_id: manager_id.into(),
            channels: Arc::new(RwLock::new(HashMap::new())),
            stream_to_channel: Arc::new(RwLock::new(HashMap::new())),
            next_stream_id: Arc::new(RwLock::new(0)),
            dtls_transport: Arc::new(RwLock::new(None)),
        }
    }

    /// Create a new data channel
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn create_channel(
        &mut self,
        label: impl Into<String>,
        config: DataChannelConfig,
        dtls: DtlsTransport,
    ) -> StreamingResult<DataChannel> {
        let label = label.into();
        let stream_id = self.allocate_stream_id().await;
        let channel_id = format!("{}_{}", self.manager_id, label);

        info!("DataChannelManager {}: Creating channel '{}' on stream {}",
            self.manager_id, label, stream_id);

        let mut channel_config = config;
        channel_config.label = label.clone();
        
        let channel = DataChannel::new(
            channel_id.clone(),
            stream_id,
            channel_config,
        );

        // Store channel
        let mut channels = self.channels.write().await;
        channels.insert(channel_id.clone(), channel.clone());
        drop(channels);

        let mut stream_map = self.stream_to_channel.write().await;
        stream_map.insert(stream_id, channel_id.clone());
        drop(stream_map);

        // Store DTLS transport
        let mut dtls_transport = self.dtls_transport.write().await;
        *dtls_transport = Some(dtls);

        // Open the channel
        channel.open().await?;

        info!("DataChannelManager {}: Channel '{}' created successfully",
            self.manager_id, label);

        Ok(channel)
    }

    /// Get a channel by ID
    pub async fn get_channel(&self, channel_id: &str) -> Option<DataChannel> {
        let channels = self.channels.read().await;
        channels.get(channel_id).cloned()
    }

    /// Get a channel by stream ID
    pub async fn get_channel_by_stream(&self, stream_id: u16) -> Option<DataChannel> {
        let stream_map = self.stream_to_channel.read().await;
        stream_map.get(&stream_id)
            .and_then(|channel_id| {
                let channels = self.channels.blocking_read();
                channels.get(channel_id).cloned()
            })
    }

    /// Close a specific channel
    pub async fn close_channel(&self, channel_id: &str) -> StreamingResult<()> {
        info!("DataChannelManager {}: Closing channel '{}'", 
            self.manager_id, channel_id);

        let mut channels = self.channels.write().await;
        if let Some(channel) = channels.get(channel_id) {
            channel.close().await?;
            channels.remove(channel_id);
        }

        Ok(())
    }

    /// Close all channels
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn close_all(&self) -> StreamingResult<()> {
        info!("DataChannelManager {}: Closing all channels", self.manager_id);

        let mut channels = self.channels.write().await;
        for (id, channel) in channels.iter() {
            info!("DataChannelManager {}: Closing channel '{}'", 
                self.manager_id, id);
            let _ = channel.close().await;
        }
        channels.clear();

        // Clear stream mapping
        let mut stream_map = self.stream_to_channel.write().await;
        stream_map.clear();

        info!("DataChannelManager {}: All channels closed", self.manager_id);
        Ok(())
    }

    /// Get all channel IDs
    pub async fn channel_ids(&self) -> Vec<String> {
        let channels = self.channels.read().await;
        channels.keys().cloned().collect()
    }

    /// Get channel count
    pub async fn channel_count(&self) -> usize {
        let channels = self.channels.read().await;
        channels.len()
    }

    /// Allocate a new stream ID
    async fn allocate_stream_id(&self) -> u16 {
        let mut next_id = self.next_stream_id.write().await;
        let stream_id = *next_id;
        *next_id += 2; // Use even IDs for client-initiated
        stream_id
    }

    /// Get manager statistics
    pub async fn stats(&self) -> DataChannelManagerStats {
        let channels = self.channels.read().await;
        let mut channel_stats = Vec::new();
        let mut total_bytes_sent = 0u64;
        let mut total_bytes_received = 0u64;

        for channel in channels.values() {
            let stats = channel.stats().await;
            total_bytes_sent += stats.bytes_sent;
            total_bytes_received += stats.bytes_received;
            channel_stats.push(stats);
        }

        DataChannelManagerStats {
            manager_id: self.manager_id.clone(),
            channel_count: channels.len(),
            total_bytes_sent,
            total_bytes_received,
            channel_stats,
        }
    }
}

impl Clone for DataChannelManager {
    fn clone(&self) -> Self {
        // Create a new manager with shared state
        Self {
            manager_id: self.manager_id.clone(),
            channels: Arc::clone(&self.channels),
            stream_to_channel: Arc::clone(&self.stream_to_channel),
            next_stream_id: Arc::clone(&self.next_stream_id),
            dtls_transport: Arc::clone(&self.dtls_transport),
        }
    }
}

/// Data channel manager statistics
#[derive(Debug, Clone)]
pub struct DataChannelManagerStats {
    pub manager_id: String,
    pub channel_count: usize,
    pub total_bytes_sent: u64,
    pub total_bytes_received: u64,
    pub channel_stats: Vec<DataChannelStats>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_channel_config_default() {
        let config = DataChannelConfig::default();
        assert_eq!(config.label, "default");
        assert!(config.ordered);
        assert!(config.max_retransmits.is_none());
        assert_eq!(config.buffer_size, DEFAULT_BUFFER_SIZE);
    }

    #[test]
    fn test_data_channel_message() {
        let text_msg = DataChannelMessage::Text("Hello".to_string());
        assert!(text_msg.is_text());
        assert!(!text_msg.is_binary());
        assert_eq!(text_msg.len(), 5);

        let binary_msg = DataChannelMessage::Binary(vec![1, 2, 3, 4, 5]);
        assert!(binary_msg.is_binary());
        assert!(!binary_msg.is_text());
        assert_eq!(binary_msg.len(), 5);

        let bytes = binary_msg.as_bytes();
        assert_eq!(bytes, vec![1, 2, 3, 4, 5]);
    }

    #[tokio::test]
    async fn test_data_channel_creation() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);

        assert_eq!(channel.channel_id(), "test_ch");
        assert_eq!(channel.stream_id(), 0);
        assert_eq!(channel.label(), "default");
        assert_eq!(channel.state().await, DataChannelState::Connecting);
    }

    #[tokio::test]
    async fn test_data_channel_open_close() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);

        channel.open().await.unwrap();
        assert_eq!(channel.state().await, DataChannelState::Open);

        channel.close().await.unwrap();
        assert_eq!(channel.state().await, DataChannelState::Closed);
    }

    #[tokio::test]
    async fn test_send_text_message() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);
        channel.open().await.unwrap();

        channel.send_text("Hello, World!").await.unwrap();

        // Receive the message
        let msg = channel.receive().await.unwrap();
        assert!(msg.is_text());
        assert_eq!(msg.as_bytes(), b"Hello, World!");
    }

    #[tokio::test]
    async fn test_send_binary_data() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);
        channel.open().await.unwrap();

        let data = vec![0x01, 0x02, 0x03, 0x04, 0x05];
        channel.send_binary(data.clone()).await.unwrap();

        // Receive the message
        let msg = channel.receive().await.unwrap();
        assert!(msg.is_binary());
        assert_eq!(msg.as_bytes(), data);
    }

    #[tokio::test]
    async fn test_send_while_closed() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);
        // Don't open - remains in Connecting state

        let result = channel.send_text("Test").await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("not open"));
    }

    #[tokio::test]
    async fn test_message_too_large() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);
        channel.open().await.unwrap();

        let large_data = vec![0u8; MAX_MESSAGE_SIZE + 1];
        let result = channel.send_binary(large_data).await;
        
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("too large"));
    }

    #[tokio::test]
    async fn test_channel_stats() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);
        channel.open().await.unwrap();

        channel.send_text("Hello").await.unwrap();
        let _ = channel.receive().await;

        let stats = channel.stats().await;
        assert_eq!(stats.channel_id, "test_ch");
        assert_eq!(stats.state, DataChannelState::Open);
        assert_eq!(stats.messages_sent, 1);
        assert_eq!(stats.bytes_sent, 5);
        assert!(stats.uptime_secs.is_some());
    }

    #[tokio::test]
    async fn test_manager_creation() {
        let manager = DataChannelManager::new("test_mgr");
        assert_eq!(manager.channel_count().await, 0);
    }

    #[tokio::test]
    async fn test_manager_stats() {
        let manager = DataChannelManager::new("test_mgr");
        let stats = manager.stats().await;
        
        assert_eq!(stats.manager_id, "test_mgr");
        assert_eq!(stats.channel_count, 0);
        assert_eq!(stats.total_bytes_sent, 0);
    }

    #[test]
    fn test_priority_ordering() {
        let priorities = vec![
            DataChannelPriority::VeryLow,
            DataChannelPriority::Low,
            DataChannelPriority::Normal,
            DataChannelPriority::High,
            DataChannelPriority::VeryHigh,
        ];

        for i in 0..priorities.len() - 1 {
            assert!(priorities[i] < priorities[i + 1]);
        }
    }

    #[tokio::test]
    async fn test_receive_timeout() {
        let config = DataChannelConfig::default();
        let channel = DataChannel::new("test_ch", 0, config);
        channel.open().await.unwrap();

        // Should timeout with no messages
        let result = channel.receive_timeout(Duration::from_millis(50)).await;
        assert!(result.is_none());
    }
}
