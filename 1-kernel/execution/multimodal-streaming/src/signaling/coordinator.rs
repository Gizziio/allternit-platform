//! Peer Connection Coordinator
//!
//! GAP-44: Peer Connection Coordination
//! WIH: GAP-44, Owner: T2-A5, Dependencies: T2-A4, Deadline
//!
//! Coordinates peer connection establishment between multiple peers.
//! Integrates with T2-A4 transport layer for ICE/DTLS setup.
//! Provides interface for T2-A3 to manage peer connections.
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for transport layer integration (T2-A4 pending)

use crate::signaling::protocol::{
    ClientCapabilities, Direction, IceCandidateInfo, MediaKind, SignalingMessage,
    SignalingSession, SignalingState, TransceiverConfig,
};
use crate::signaling::room::{PeerInfo, RoomManager, SessionManager};
use crate::signaling::sdp::{SessionDescription, SdpType};
use crate::signaling::websocket::{WebSocketTransport, WebSocketClientBuilder};
use crate::types::{StreamingError, StreamingResult};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tracing::{debug, info, warn};

/// Peer connection coordinator
/// 
/// Manages the lifecycle of WebRTC peer connections including:
/// - Room management
/// - Signaling coordination
/// - SDP offer/answer exchange
/// - ICE candidate exchange
/// - Connection state tracking
pub struct PeerCoordinator {
    /// Coordinator ID
    coordinator_id: String,
    /// Room manager
    room_manager: RoomManager,
    /// Session manager
    session_manager: SessionManager,
    /// Signaling transport
    transport: Arc<Mutex<Option<WebSocketTransport>>>,
    /// Local peer ID
    local_peer_id: Arc<RwLock<Option<String>>>,
    /// Current room ID
    current_room_id: Arc<RwLock<Option<String>>>,
    /// Active signaling sessions by peer
    signaling_sessions: Arc<DashMap<String, SignalingSession>>,
    /// Connection state callbacks
    state_callbacks: Arc<RwLock<Vec<Box<dyn ConnectionStateCallback + Send + Sync>>>>,
    /// Message handlers
    message_tx: mpsc::UnboundedSender<CoordinatorEvent>,
    message_rx: Arc<Mutex<mpsc::UnboundedReceiver<CoordinatorEvent>>>,
    /// Coordinator state
    state: Arc<RwLock<CoordinatorState>>,
}

impl std::fmt::Debug for PeerCoordinator {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PeerCoordinator")
            .field("coordinator_id", &self.coordinator_id)
            .field("room_manager", &self.room_manager)
            .field("session_manager", &self.session_manager)
            .field("local_peer_id", &self.local_peer_id)
            .field("current_room_id", &self.current_room_id)
            .field("signaling_sessions", &self.signaling_sessions)
            .field("state", &self.state)
            .finish_non_exhaustive()
    }
}

/// Coordinator state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoordinatorState {
    /// Initial state
    Idle,
    /// Connecting to signaling server
    Connecting,
    /// Connected, not in room
    Connected,
    /// In a room, ready for peer connections
    InRoom,
    /// Active peer connections
    Active,
    /// Error state
    Error,
    /// Disconnected
    Disconnected,
}

/// Events emitted by the coordinator
#[derive(Debug, Clone)]
pub enum CoordinatorEvent {
    /// Connected to signaling server
    Connected,
    /// Disconnected from signaling server
    Disconnected,
    /// Joined a room
    RoomJoined {
        room_id: String,
        peer_id: String,
        peers: Vec<PeerInfo>,
    },
    /// Left a room
    RoomLeft {
        room_id: String,
    },
    /// Peer joined the room
    PeerJoined {
        peer_id: String,
        peer_info: PeerInfo,
    },
    /// Peer left the room
    PeerLeft {
        peer_id: String,
    },
    /// Received SDP offer from peer
    OfferReceived {
        from_peer_id: String,
        sdp: String,
    },
    /// Received SDP answer from peer
    AnswerReceived {
        from_peer_id: String,
        sdp: String,
    },
    /// Received ICE candidate from peer
    IceCandidateReceived {
        from_peer_id: String,
        candidate: IceCandidateInfo,
    },
    /// ICE gathering complete notification
    IceComplete {
        from_peer_id: String,
    },
    /// Connection state changed
    ConnectionStateChanged {
        peer_id: String,
        state: crate::signaling::protocol::ConnectionState,
    },
    /// Error occurred
    Error {
        message: String,
    },
}

/// Connection state callback trait
pub trait ConnectionStateCallback: Send + Sync {
    /// Called when a peer connection state changes
    fn on_connection_state_change(&self, peer_id: &str, state: crate::signaling::protocol::ConnectionState);
    /// Called when a peer joins
    fn on_peer_joined(&self, peer_id: &str, peer_info: &PeerInfo);
    /// Called when a peer leaves
    fn on_peer_left(&self, peer_id: &str);
}

/// Coordinator configuration
#[derive(Debug, Clone)]
pub struct CoordinatorConfig {
    /// Signaling server URL
    pub signaling_url: String,
    /// Client capabilities
    pub capabilities: ClientCapabilities,
    /// Display name
    pub display_name: Option<String>,
    /// Auto-reconnect enabled
    pub auto_reconnect: bool,
    /// ICE servers configuration (STUN/TURN)
    pub ice_servers: Vec<IceServer>,
}

impl Default for CoordinatorConfig {
    fn default() -> Self {
        Self {
            signaling_url: "ws://localhost:8080/signaling".to_string(),
            capabilities: ClientCapabilities::default_webrtc(),
            display_name: None,
            auto_reconnect: true,
            ice_servers: vec![
                // Default Google STUN servers
                IceServer {
                    urls: vec!["stun:stun.l.google.com:19302".to_string()],
                    username: None,
                    credential: None,
                },
            ],
        }
    }
}

/// ICE server configuration
#[derive(Debug, Clone)]
pub struct IceServer {
    /// Server URLs
    pub urls: Vec<String>,
    /// Username (for TURN)
    pub username: Option<String>,
    /// Credential (for TURN)
    pub credential: Option<String>,
}

/// Peer connection options
#[derive(Debug, Clone)]
pub struct PeerConnectionOptions {
    /// Media transceivers to create
    pub transceivers: Vec<TransceiverConfig>,
    /// Enable data channel
    pub data_channel: bool,
    /// ICE transport policy
    pub ice_transport_policy: IceTransportPolicy,
}

impl Default for PeerConnectionOptions {
    fn default() -> Self {
        Self {
            transceivers: vec![
                TransceiverConfig {
                    id: "audio_0".to_string(),
                    kind: MediaKind::Audio,
                    direction: Direction::SendRecv,
                    stream_ids: vec!["default".to_string()],
                    preferred_codecs: vec!["opus".to_string()],
                },
            ],
            data_channel: true,
            ice_transport_policy: IceTransportPolicy::All,
        }
    }
}

/// ICE transport policy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IceTransportPolicy {
    /// Use all available candidates
    All,
    /// Only use relay candidates (TURN)
    Relay,
    /// Only use local candidates
    Local,
}

/// Connection handle for managing a peer connection
#[derive(Debug, Clone)]
pub struct PeerConnectionHandle {
    /// Target peer ID
    pub peer_id: String,
    /// Connection state
    pub state: Arc<RwLock<crate::signaling::protocol::ConnectionState>>,
    /// Local SDP description
    pub local_description: Arc<RwLock<Option<String>>>,
    /// Remote SDP description
    pub remote_description: Arc<RwLock<Option<String>>>,
}

// Type alias for DashMap to avoid import issues
type DashMap<K, V> = dashmap::DashMap<K, V>;

impl PeerCoordinator {
    /// Create a new peer coordinator
    pub fn new(coordinator_id: impl Into<String>) -> Self {
        let (message_tx, message_rx) = mpsc::unbounded_channel();
        
        Self {
            coordinator_id: coordinator_id.into(),
            room_manager: RoomManager::new(),
            session_manager: SessionManager::new(),
            transport: Arc::new(Mutex::new(None)),
            local_peer_id: Arc::new(RwLock::new(None)),
            current_room_id: Arc::new(RwLock::new(None)),
            signaling_sessions: Arc::new(DashMap::new()),
            state_callbacks: Arc::new(RwLock::new(Vec::new())),
            message_tx,
            message_rx: Arc::new(Mutex::new(message_rx)),
            state: Arc::new(RwLock::new(CoordinatorState::Idle)),
        }
    }
    
    /// Initialize and connect to signaling server
    pub async fn connect(&self, config: CoordinatorConfig) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        if !matches!(*state, CoordinatorState::Idle | CoordinatorState::Disconnected) {
            return Err(StreamingError::WebRtc(
                "Coordinator already connected".to_string()
            ));
        }
        *state = CoordinatorState::Connecting;
        drop(state);
        
        info!("Connecting to signaling server: {}", config.signaling_url);
        
        // Create WebSocket transport
        let transport = WebSocketClientBuilder::new()
            .server_url(&config.signaling_url)
            .build();
        
        // Store transport reference
        {
            let mut t = self.transport.lock().await;
            *t = Some(transport);
        }
        
        // Update state
        let mut state = self.state.write().await;
        *state = CoordinatorState::Connected;
        drop(state);
        
        // Emit event
        let _ = self.message_tx.send(CoordinatorEvent::Connected);
        
        info!("Connected to signaling server");
        
        Ok(())
    }
    
    /// Disconnect from signaling server
    pub async fn disconnect(&self) -> StreamingResult<()> {
        let mut state = self.state.write().await;
        *state = CoordinatorState::Disconnected;
        drop(state);
        
        // Leave room if in one
        if self.current_room_id.read().await.is_some() {
            let _ = self.leave_room().await;
        }
        
        // Disconnect transport
        if let Some(transport) = self.transport.lock().await.as_ref() {
            let _ = transport.disconnect().await;
        }
        
        let _ = self.message_tx.send(CoordinatorEvent::Disconnected);
        
        info!("Disconnected from signaling server");
        
        Ok(())
    }
    
    /// Join a room
    pub async fn join_room(&self, room_id: Option<String>) -> StreamingResult<String> {
        let state = self.state.read().await;
        if !matches!(*state, CoordinatorState::Connected) {
            return Err(StreamingError::WebRtc(
                "Must be connected to join a room".to_string()
            ));
        }
        drop(state);
        
        let transport = self.transport.lock().await;
        let transport = transport.as_ref().ok_or_else(|| {
            StreamingError::WebRtc("Transport not initialized".to_string())
        })?;
        
        // Register with the server
        let capabilities = ClientCapabilities::default_webrtc();
        let peer_id = transport.register(
            "",
            room_id.clone(),
            capabilities.clone(),
        ).await?;
        
        // Store peer ID
        {
            let mut local_id = self.local_peer_id.write().await;
            *local_id = Some(peer_id.clone());
        }
        
        // Store room ID (will be assigned by server if not provided)
        let actual_room_id = room_id.unwrap_or_else(|| "auto_assigned".to_string());
        {
            let mut current_room = self.current_room_id.write().await;
            *current_room = Some(actual_room_id.clone());
        }
        
        // Create session
        self.session_manager.create_session(peer_id.clone(), actual_room_id.clone());
        
        // Update state
        let mut state = self.state.write().await;
        *state = CoordinatorState::InRoom;
        drop(state);
        
        // Emit event (with empty peer list for now)
        let _ = self.message_tx.send(CoordinatorEvent::RoomJoined {
            room_id: actual_room_id.clone(),
            peer_id: peer_id.clone(),
            peers: Vec::new(),
        });
        
        info!("Joined room {} as peer {}", actual_room_id, peer_id);
        
        Ok(peer_id)
    }
    
    /// Leave current room
    pub async fn leave_room(&self) -> StreamingResult<()> {
        let room_id = self.current_room_id.read().await.clone();
        
        if let Some(room_id) = room_id {
            if let Some(peer_id) = self.local_peer_id.read().await.clone() {
                // Leave room in room manager
                let _ = self.room_manager.leave_room(&peer_id).await;
                
                // End session
                let _ = self.session_manager.end_session(&peer_id);
                
                info!("Left room {} as peer {}", room_id, peer_id);
            }
            
            // Clear room
            {
                let mut current_room = self.current_room_id.write().await;
                *current_room = None;
            }
            
            // Update state
            let mut state = self.state.write().await;
            *state = CoordinatorState::Connected;
            drop(state);
            
            // Emit event
            let _ = self.message_tx.send(CoordinatorEvent::RoomLeft { room_id });
        }
        
        Ok(())
    }
    
    /// Create an offer to connect to a peer
    pub async fn create_offer(
        &self,
        target_peer_id: impl Into<String>,
        options: PeerConnectionOptions,
    ) -> StreamingResult<String> {
        let target_peer_id = target_peer_id.into();
        let local_peer_id = self.local_peer_id.read().await.clone().ok_or_else(|| {
            StreamingError::WebRtc("Not connected".to_string())
        })?;
        
        // Create signaling session
        let mut session = SignalingSession::new(&local_peer_id);
        session.remote_peer_id = Some(target_peer_id.clone());
        session.transition_to(SignalingState::Offering);
        
        self.signaling_sessions.insert(target_peer_id.clone(), session.clone());
        
        // Create SDP offer
        let capabilities = ClientCapabilities::default_webrtc();
        let offer = SessionDescription::create_offer(
            &local_peer_id,
            &options.transceivers,
            &capabilities,
        );
        
        let sdp_string = offer.to_sdp_string();
        
        // Store session
        session.transition_to(SignalingState::Offering);
        self.signaling_sessions.insert(target_peer_id.clone(), session);
        
        // Send offer via transport
        if let Some(transport) = self.transport.lock().await.as_ref() {
            transport.send_message(SignalingMessage::Offer {
                target_peer_id: target_peer_id.clone(),
                sdp: sdp_string.clone(),
                transceivers: options.transceivers,
            })?;
        }
        
        // Add connection to session manager
        self.session_manager.add_connection(&local_peer_id, &target_peer_id)?;
        
        // Update state
        let mut state = self.state.write().await;
        *state = CoordinatorState::Active;
        drop(state);
        
        info!("Created offer for peer {}", target_peer_id);
        
        Ok(sdp_string)
    }
    
    /// Create an answer to respond to an offer
    pub async fn create_answer(
        &self,
        target_peer_id: impl Into<String>,
        offer_sdp: &str,
        options: PeerConnectionOptions,
    ) -> StreamingResult<String> {
        let target_peer_id = target_peer_id.into();
        let local_peer_id = self.local_peer_id.read().await.clone().ok_or_else(|| {
            StreamingError::WebRtc("Not connected".to_string())
        })?;
        
        // Parse remote offer
        let remote_offer = SessionDescription::parse_sdp(offer_sdp, SdpType::Offer)?;
        
        // Create or update signaling session
        let mut session = SignalingSession::new(&local_peer_id);
        session.remote_peer_id = Some(target_peer_id.clone());
        session.transition_to(SignalingState::Answering);
        
        // Create SDP answer
        let capabilities = ClientCapabilities::default_webrtc();
        let answer = SessionDescription::create_answer(
            &remote_offer,
            &options.transceivers,
            &capabilities,
        );
        
        let sdp_string = answer.to_sdp_string();
        
        // Store session
        self.signaling_sessions.insert(target_peer_id.clone(), session);
        
        // Send answer via transport
        if let Some(transport) = self.transport.lock().await.as_ref() {
            transport.send_message(SignalingMessage::Answer {
                target_peer_id: target_peer_id.clone(),
                sdp: sdp_string.clone(),
            })?;
        }
        
        // Add connection to session manager
        self.session_manager.add_connection(&local_peer_id, &target_peer_id)?;
        
        info!("Created answer for peer {}", target_peer_id);
        
        Ok(sdp_string)
    }
    
    /// Send ICE candidate to a peer
    pub async fn send_ice_candidate(
        &self,
        target_peer_id: impl Into<String>,
        candidate: IceCandidateInfo,
    ) -> StreamingResult<()> {
        let target_peer_id = target_peer_id.into();
        
        if let Some(transport) = self.transport.lock().await.as_ref() {
            transport.send_message(SignalingMessage::IceCandidate {
                target_peer_id,
                candidate,
            })?;
        }
        
        Ok(())
    }
    
    /// Notify ICE gathering complete
    pub async fn ice_gathering_complete(
        &self,
        target_peer_id: impl Into<String>,
    ) -> StreamingResult<()> {
        let target_peer_id = target_peer_id.into();
        
        if let Some(transport) = self.transport.lock().await.as_ref() {
            transport.send_message(SignalingMessage::IceComplete {
                target_peer_id,
            })?;
        }
        
        Ok(())
    }
    
    /// Get coordinator state
    pub async fn state(&self) -> CoordinatorState {
        *self.state.read().await
    }
    
    /// Get local peer ID
    pub async fn local_peer_id(&self) -> Option<String> {
        self.local_peer_id.read().await.clone()
    }
    
    /// Get current room ID
    pub async fn current_room_id(&self) -> Option<String> {
        self.current_room_id.read().await.clone()
    }
    
    /// Receive next event (non-blocking)
    pub async fn next_event(&self) -> Option<CoordinatorEvent> {
        let mut rx = self.message_rx.lock().await;
        rx.try_recv().ok()
    }
    
    /// Register a state callback
    pub async fn register_callback(&self, callback: Box<dyn ConnectionStateCallback>) {
        let mut callbacks = self.state_callbacks.write().await;
        callbacks.push(callback);
    }
    
    /// Get room manager reference
    pub fn room_manager(&self) -> &RoomManager {
        &self.room_manager
    }
    
    /// Get session manager reference
    pub fn session_manager(&self) -> &SessionManager {
        &self.session_manager
    }
    
    /// Handle incoming signaling message (called by transport)
    pub async fn handle_signaling_message(&self, message: SignalingMessage) -> StreamingResult<()> {
        match message {
            SignalingMessage::PeerJoined { peer_id, capabilities } => {
                let peer_info = PeerInfo {
                    peer_id: peer_id.clone(),
                    display_name: None,
                    capabilities,
                    state: crate::signaling::room::PeerState::Connected,
                    joined_at: chrono::Utc::now(),
                    last_activity: Arc::new(RwLock::new(chrono::Utc::now())),
                    metadata: HashMap::new(),
                };
                
                // Notify callbacks
                let callbacks = self.state_callbacks.read().await;
                for callback in callbacks.iter() {
                    callback.on_peer_joined(&peer_id, &peer_info);
                }
                drop(callbacks);
                
                // Emit event
                let _ = self.message_tx.send(CoordinatorEvent::PeerJoined {
                    peer_id,
                    peer_info,
                });
            }
            
            SignalingMessage::PeerLeft { peer_id } => {
                // Notify callbacks
                let callbacks = self.state_callbacks.read().await;
                for callback in callbacks.iter() {
                    callback.on_peer_left(&peer_id);
                }
                drop(callbacks);
                
                // Emit event
                let _ = self.message_tx.send(CoordinatorEvent::PeerLeft { peer_id });
            }
            
            SignalingMessage::Offer { target_peer_id, sdp, transceivers: _ } => {
                // Received an offer from another peer
                let _ = self.message_tx.send(CoordinatorEvent::OfferReceived {
                    from_peer_id: target_peer_id,
                    sdp,
                });
            }
            
            SignalingMessage::Answer { target_peer_id, sdp } => {
                // Received an answer to our offer
                let _ = self.message_tx.send(CoordinatorEvent::AnswerReceived {
                    from_peer_id: target_peer_id,
                    sdp,
                });
            }
            
            SignalingMessage::IceCandidate { target_peer_id, candidate } => {
                let _ = self.message_tx.send(CoordinatorEvent::IceCandidateReceived {
                    from_peer_id: target_peer_id,
                    candidate,
                });
            }
            
            SignalingMessage::IceComplete { target_peer_id } => {
                let _ = self.message_tx.send(CoordinatorEvent::IceComplete {
                    from_peer_id: target_peer_id,
                });
            }
            
            SignalingMessage::ConnectionState { peer_id, state } => {
                // Update session manager
                let _ = self.session_manager.update_connection_state(&peer_id, state);
                
                // Notify callbacks
                let callbacks = self.state_callbacks.read().await;
                for callback in callbacks.iter() {
                    callback.on_connection_state_change(&peer_id, state);
                }
                drop(callbacks);
                
                // Emit event
                let _ = self.message_tx.send(CoordinatorEvent::ConnectionStateChanged {
                    peer_id,
                    state,
                });
            }
            
            SignalingMessage::Error { code, message } => {
                warn!("Signaling error: {:?} - {}", code, message);
                let _ = self.message_tx.send(CoordinatorEvent::Error { message });
            }
            
            _ => {
                debug!("Received signaling message: {:?}", message);
            }
        }
        
        Ok(())
    }
    
    /// STUB_APPROVED: Integrate with transport layer (T2-A4)
    /// 
    /// This method will be called when T2-A4 transport layer is ready
    /// to establish actual ICE/DTLS connections.
    pub async fn connect_transport_layer(&self, _peer_id: &str) -> StreamingResult<()> {
        // STUB_APPROVED: Transport layer integration pending T2-A4
        tracing::warn!("Transport layer integration is STUB_APPROVED - awaiting T2-A4");
        
        // This is where we would:
        // 1. Get ICE candidates from T2-A4
        // 2. Send ICE candidates via signaling
        // 3. Coordinate DTLS handshake
        // 4. Establish data channels
        
        Ok(())
    }
}

/// Builder for peer coordinator
#[derive(Debug)]
pub struct PeerCoordinatorBuilder {
    coordinator_id: String,
    config: Option<CoordinatorConfig>,
}

impl PeerCoordinatorBuilder {
    /// Create a new builder
    pub fn new(coordinator_id: impl Into<String>) -> Self {
        Self {
            coordinator_id: coordinator_id.into(),
            config: None,
        }
    }
    
    /// Set configuration
    pub fn config(mut self, config: CoordinatorConfig) -> Self {
        self.config = Some(config);
        self
    }
    
    /// Build the coordinator
    pub fn build(self) -> PeerCoordinator {
        PeerCoordinator::new(self.coordinator_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_coordinator_creation() {
        let coordinator = PeerCoordinator::new("test_coord_1");
        
        assert_eq!(coordinator.coordinator_id, "test_coord_1");
    }
    
    #[tokio::test]
    async fn test_coordinator_state_transitions() {
        let coordinator = PeerCoordinator::new("test_coord_1");
        
        assert!(matches!(coordinator.state().await, CoordinatorState::Idle));
        
        // Note: Full state transitions require actual WebSocket connection
        // which is STUB_APPROVED
    }
    
    #[test]
    fn test_default_config() {
        let config = CoordinatorConfig::default();
        
        assert_eq!(config.signaling_url, "ws://localhost:8080/signaling");
        assert!(config.auto_reconnect);
        assert!(!config.ice_servers.is_empty());
    }
    
    #[test]
    fn test_peer_connection_options_default() {
        let options = PeerConnectionOptions::default();
        
        assert!(options.data_channel);
        assert!(!options.transceivers.is_empty());
        assert_eq!(options.ice_transport_policy, IceTransportPolicy::All);
    }
    
    #[test]
    fn test_builder_pattern() {
        let coordinator = PeerCoordinatorBuilder::new("coord_1")
            .config(CoordinatorConfig::default())
            .build();
        
        assert_eq!(coordinator.coordinator_id, "coord_1");
    }
    
    #[tokio::test]
    async fn test_create_offer_stubs() {
        let coordinator = PeerCoordinator::new("test_coord");
        
        // Should fail when not connected
        let options = PeerConnectionOptions::default();
        let result = coordinator.create_offer("peer_2", options).await;
        
        assert!(result.is_err());
    }
}
