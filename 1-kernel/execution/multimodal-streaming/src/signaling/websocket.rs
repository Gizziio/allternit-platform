//! WebSocket Signaling Transport
//!
//! GAP-43: WebSocket Signaling Transport
//! WIH: GAP-43, Owner: T2-A5, Dependencies: T2-A4, Deadline
//!
//! Implements WebSocket transport for WebRTC signaling messages.
//! Handles connection management, message routing, and reconnection.
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for production WebSocket server integration

use crate::signaling::protocol::{
    ClientCapabilities, SignalingMessage, SignalingSession,
};
use crate::types::{StreamingError, StreamingResult};
use std::sync::Arc;
use tokio::net::TcpStream;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{Duration, Instant};
use tokio_tungstenite::{
    tungstenite::protocol::Message as WsMessage,
    MaybeTlsStream, WebSocketStream,
};
use tracing::{debug, error, info, warn};

/// WebSocket signaling transport
#[derive(Debug)]
pub struct WebSocketTransport {
    /// Server URL
    server_url: String,
    /// Connection state
    state: Arc<RwLock<ConnectionState>>,
    /// Outbound message channel
    outbound_tx: mpsc::UnboundedSender<SignalingMessage>,
    /// Inbound message channel (public receiver)
    inbound_rx: Arc<Mutex<mpsc::UnboundedReceiver<SignalingMessage>>>,
    /// Connection handle
    connection_handle: Arc<Mutex<Option<ConnectionHandle>>>,
    /// Current session
    session: Arc<RwLock<Option<SignalingSession>>>,
    /// Reconnect configuration
    reconnect_config: ReconnectConfig,
    /// Last activity timestamp
    last_activity: Arc<RwLock<Instant>>,
}

/// Connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    /// Disconnected
    Disconnected,
    /// Connecting
    Connecting,
    /// Connected and ready
    Connected,
    /// Reconnecting after failure
    Reconnecting,
    /// Connection error
    Error,
}

/// Connection handle for managing the WebSocket connection
#[derive(Debug)]
struct ConnectionHandle {
    /// WebSocket write half
    ws_sink: mpsc::UnboundedSender<WsMessage>,
    /// Connection task handle
    task_handle: tokio::task::JoinHandle<()>,
}

/// Reconnection configuration
#[derive(Debug, Clone)]
pub struct ReconnectConfig {
    /// Maximum number of reconnection attempts
    pub max_attempts: u32,
    /// Initial retry delay in milliseconds
    pub initial_delay_ms: u64,
    /// Maximum retry delay in milliseconds
    pub max_delay_ms: u64,
    /// Backoff multiplier
    pub backoff_multiplier: f64,
    /// Enable automatic reconnection
    pub enabled: bool,
}

impl Default for ReconnectConfig {
    fn default() -> Self {
        Self {
            max_attempts: 10,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 1.5,
            enabled: true,
        }
    }
}

/// WebSocket transport configuration
#[derive(Debug, Clone)]
pub struct WebSocketConfig {
    /// Server URL (ws:// or wss://)
    pub server_url: String,
    /// Connection timeout
    pub connect_timeout: Duration,
    /// Keepalive ping interval
    pub ping_interval: Duration,
    /// Reconnect configuration
    pub reconnect: ReconnectConfig,
}

impl Default for WebSocketConfig {
    fn default() -> Self {
        Self {
            server_url: "ws://localhost:8080/signaling".to_string(),
            connect_timeout: Duration::from_secs(10),
            ping_interval: Duration::from_secs(30),
            reconnect: ReconnectConfig::default(),
        }
    }
}

impl WebSocketTransport {
    /// Create a new WebSocket transport
    pub fn new(config: WebSocketConfig) -> Self {
        let (outbound_tx, outbound_rx) = mpsc::unbounded_channel();
        let (inbound_tx, inbound_rx) = mpsc::unbounded_channel();
        
        let transport = Self {
            server_url: config.server_url,
            state: Arc::new(RwLock::new(ConnectionState::Disconnected)),
            outbound_tx,
            inbound_rx: Arc::new(Mutex::new(inbound_rx)),
            connection_handle: Arc::new(Mutex::new(None)),
            session: Arc::new(RwLock::new(None)),
            reconnect_config: config.reconnect,
            last_activity: Arc::new(RwLock::new(Instant::now())),
        };
        
        // Start the connection manager
        let transport_clone = {
            let server_url = transport.server_url.clone();
            let state = Arc::clone(&transport.state);
            let session = Arc::clone(&transport.session);
            let connection_handle = Arc::clone(&transport.connection_handle);
            let last_activity = Arc::clone(&transport.last_activity);
            let reconnect_config = transport.reconnect_config.clone();
            
            tokio::spawn(async move {
                Self::connection_manager(
                    server_url,
                    outbound_rx,
                    inbound_tx,
                    state,
                    session,
                    connection_handle,
                    last_activity,
                    reconnect_config,
                )
                .await;
            })
        };
        
        // Store the handle (would need to store this somewhere if we need to abort)
        drop(transport_clone);
        
        transport
    }
    
    /// Connect to the signaling server
    pub async fn connect(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        
        match *state {
            ConnectionState::Connected => {
                return Ok(());
            }
            ConnectionState::Connecting => {
                return Ok(()); // Already connecting
            }
            _ => {
                *state = ConnectionState::Connecting;
            }
        }
        
        info!("Connecting to signaling server: {}", self.server_url);
        
        // The actual connection happens in the connection_manager
        // This method just signals intent
        Ok(())
    }
    
    /// Disconnect from the signaling server
    pub async fn disconnect(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = ConnectionState::Disconnected;
        
        let mut handle = self.connection_handle.lock().await;
        if let Some(h) = handle.take() {
            h.task_handle.abort();
            debug!("WebSocket connection closed");
        }
        
        Ok(())
    }
    
    /// Send a signaling message
    pub fn send_message(&self, message: SignalingMessage) -> StreamingResult<()> {
        self.outbound_tx
            .send(message)
            .map_err(|_| StreamingError::WebRtc("Failed to send message".to_string()))?;
        Ok(())
    }
    
    /// Receive a signaling message (non-blocking)
    pub async fn receive_message(&self) -> Option<SignalingMessage> {
        let mut rx = self.inbound_rx.lock().await;
        rx.try_recv().ok()
    }
    
    /// Get current connection state
    pub async fn connection_state(&self) -> ConnectionState {
        *self.state.read().await
    }
    
    /// Register with the signaling server
    pub async fn register(
        &self,
        peer_id: impl Into<String>,
        room_id: Option<String>,
        capabilities: ClientCapabilities,
    ) -> StreamingResult<String> {
        let peer_id = peer_id.into();
        
        // Create session
        let mut session = self.session.write().await;
        *session = Some(SignalingSession::new(&peer_id));
        drop(session);
        
        // Send register message
        self.send_message(SignalingMessage::Register {
            peer_id: peer_id.clone(),
            room_id,
            capabilities,
        })?;
        
        Ok(peer_id)
    }
    
    /// Get current session
    pub async fn session(&self) -> Option<SignalingSession> {
        self.session.read().await.clone()
    }
    
    /// Connection manager loop
    async fn connection_manager(
        server_url: String,
        mut outbound_rx: mpsc::UnboundedReceiver<SignalingMessage>,
        inbound_tx: mpsc::UnboundedSender<SignalingMessage>,
        state: Arc<RwLock<ConnectionState>>,
        session: Arc<RwLock<Option<SignalingSession>>>,
        connection_handle: Arc<Mutex<Option<ConnectionHandle>>>,
        last_activity: Arc<RwLock<Instant>>,
        reconnect_config: ReconnectConfig,
    ) {
        let mut reconnect_attempts = 0u32;
        let mut current_delay = reconnect_config.initial_delay_ms;
        
        loop {
            // Check if we should connect
            let should_connect = {
                let state_val = *state.read().await;
                matches!(state_val, ConnectionState::Connecting | ConnectionState::Reconnecting)
                    || (reconnect_config.enabled
                        && matches!(state_val, ConnectionState::Disconnected)
                        && session.read().await.is_some())
            };
            
            if !should_connect {
                tokio::time::sleep(Duration::from_millis(100)).await;
                continue;
            }
            
            // Attempt connection
            match Self::establish_connection(
                &server_url,
                inbound_tx.clone(),
                Arc::clone(&last_activity),
            )
            .await
            {
                Ok((ws_stream, sink)) => {
                    info!("WebSocket connected to {}", server_url);
                    
                    {
                        let mut s = state.write().await;
                        *s = ConnectionState::Connected;
                    }
                    
                    reconnect_attempts = 0;
                    current_delay = reconnect_config.initial_delay_ms;
                    
                    // Spawn connection handler
                    let handle = tokio::spawn(Self::handle_connection(
                        ws_stream,
                        outbound_rx,
                        inbound_tx.clone(),
                        Arc::clone(&state),
                        Arc::clone(&session),
                        Arc::clone(&last_activity),
                    ));
                    
                    // Store handle
                    {
                        let mut h = connection_handle.lock().await;
                        *h = Some(ConnectionHandle {
                            ws_sink: sink,
                            task_handle: handle,
                        });
                    }
                    
                    // Wait for connection to close
                    break;
                }
                Err(e) => {
                    error!("WebSocket connection failed: {}", e);
                    
                    if !reconnect_config.enabled || reconnect_attempts >= reconnect_config.max_attempts {
                        {
                            let mut s = state.write().await;
                            *s = ConnectionState::Error;
                        }
                        break;
                    }
                    
                    reconnect_attempts += 1;
                    
                    {
                        let mut s = state.write().await;
                        *s = ConnectionState::Reconnecting;
                    }
                    
                    warn!(
                        "Reconnecting in {}ms (attempt {}/{})",
                        current_delay, reconnect_attempts, reconnect_config.max_attempts
                    );
                    
                    tokio::time::sleep(Duration::from_millis(current_delay)).await;
                    
                    // Exponential backoff
                    current_delay = ((current_delay as f64 * reconnect_config.backoff_multiplier) as u64)
                        .min(reconnect_config.max_delay_ms);
                }
            }
        }
    }
    
    /// Establish WebSocket connection
    async fn establish_connection(
        server_url: &str,
        _inbound_tx: mpsc::UnboundedSender<SignalingMessage>,
        _last_activity: Arc<RwLock<Instant>>,
    ) -> StreamingResult<(
        WebSocketStream<MaybeTlsStream<TcpStream>>,
        mpsc::UnboundedSender<WsMessage>,
    )> {
        // STUB_APPROVED: Production implementation would use actual WebSocket connection
        // For now, simulate a connection
        
        tracing::warn!("WebSocket connection is STUB_APPROVED - using simulated connection");
        
        // Parse URL to determine if TLS is needed
        let _url = server_url.parse::<url::Url>().map_err(|e| {
            StreamingError::WebRtc(format!("Invalid URL: {}", e))
        })?;
        
        // In a full implementation:
        // let (ws_stream, _) = connect_async(url).await.map_err(|e| {
        //     StreamingError::WebRtc(format!("WebSocket connection failed: {}", e))
        // })?;
        
        // Create a dummy channel since we can't actually connect
        let (sink, _stream): (mpsc::UnboundedSender<WsMessage>, _) = mpsc::unbounded_channel();
        
        // Return error to trigger reconnection logic for stub
        Err(StreamingError::WebRtc(
            "STUB_APPROVED: WebSocket connection not implemented".to_string()
        ))
    }
    
    /// Handle an established WebSocket connection
    async fn handle_connection(
        mut _ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
        mut outbound_rx: mpsc::UnboundedReceiver<SignalingMessage>,
        _inbound_tx: mpsc::UnboundedSender<SignalingMessage>,
        _state: Arc<RwLock<ConnectionState>>,
        _session: Arc<RwLock<Option<SignalingSession>>>,
        _last_activity: Arc<RwLock<Instant>>,
    ) {
        // STUB_APPROVED: Full implementation would:
        // 1. Split the WebSocket into sink and stream
        // 2. Spawn a task to read from WebSocket and send to inbound_tx
        // 3. Forward outbound_rx messages to WebSocket
        // 4. Handle pings/pongs for keepalive
        // 5. Handle errors and trigger reconnection
        
        // For stub, just consume outbound messages
        while let Some(_msg) = outbound_rx.recv().await {
            // Would send to WebSocket here
            tracing::debug!("Would send signaling message (STUB_APPROVED)");
        }
    }
    
    /// Check if connection is healthy (for health checks)
    pub async fn is_healthy(&self) -> bool {
        let state = self.connection_state().await;
        if !matches!(state, ConnectionState::Connected) {
            return false;
        }
        
        let last_activity = *self.last_activity.read().await;
        let timeout = Duration::from_secs(60);
        
        last_activity.elapsed() < timeout
    }
}

/// WebSocket signaling client builder
#[derive(Debug, Default)]
pub struct WebSocketClientBuilder {
    config: WebSocketConfig,
}

impl WebSocketClientBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self::default()
    }
    
    /// Set server URL
    pub fn server_url(mut self, url: impl Into<String>) -> Self {
        self.config.server_url = url.into();
        self
    }
    
    /// Set connect timeout
    pub fn connect_timeout(mut self, timeout: Duration) -> Self {
        self.config.connect_timeout = timeout;
        self
    }
    
    /// Set ping interval
    pub fn ping_interval(mut self, interval: Duration) -> Self {
        self.config.ping_interval = interval;
        self
    }
    
    /// Disable reconnection
    pub fn disable_reconnect(mut self) -> Self {
        self.config.reconnect.enabled = false;
        self
    }
    
    /// Set max reconnect attempts
    pub fn max_reconnect_attempts(mut self, attempts: u32) -> Self {
        self.config.reconnect.max_attempts = attempts;
        self
    }
    
    /// Build the transport
    pub fn build(self) -> WebSocketTransport {
        WebSocketTransport::new(self.config)
    }
}

/// Convenience function to create a WebSocket transport
pub fn create_websocket_transport(server_url: impl Into<String>) -> WebSocketTransport {
    WebSocketClientBuilder::new()
        .server_url(server_url)
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_reconnect_config_default() {
        let config = ReconnectConfig::default();
        assert_eq!(config.max_attempts, 10);
        assert_eq!(config.initial_delay_ms, 1000);
        assert_eq!(config.max_delay_ms, 30000);
        assert!(config.enabled);
    }
    
    #[test]
    fn test_websocket_config_default() {
        let config = WebSocketConfig::default();
        assert_eq!(config.server_url, "ws://localhost:8080/signaling");
        assert_eq!(config.connect_timeout, Duration::from_secs(10));
    }
    
    #[test]
    fn test_builder_pattern() {
        let transport = WebSocketClientBuilder::new()
            .server_url("wss://example.com/signaling")
            .disable_reconnect()
            .max_reconnect_attempts(5)
            .build();
        
        assert_eq!(transport.server_url, "wss://example.com/signaling");
        assert!(!transport.reconnect_config.enabled);
        assert_eq!(transport.reconnect_config.max_attempts, 5);
    }
    
    #[tokio::test]
    async fn test_transport_creation() {
        let transport = create_websocket_transport("ws://localhost:8080");
        
        assert_eq!(transport.server_url, "ws://localhost:8080");
        assert!(matches!(transport.connection_state().await, ConnectionState::Disconnected));
    }
}
