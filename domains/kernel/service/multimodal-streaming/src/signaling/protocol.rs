//! Signaling Protocol
//!
//! GAP-43: Signaling Protocol Implementation
//! WIH: GAP-43, Owner: T2-A5, Dependencies: T2-A4, Deadline
//!
//! Defines the signaling message protocol for WebRTC peer connection establishment.
//! Implements SDP offer/answer exchange and ICE candidate signaling.
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for production signaling server integration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Signaling message types for WebRTC handshake
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case", tag = "type", content = "data")]
pub enum SignalingMessage {
    /// Client registration with signaling server
    Register {
        /// Client-generated peer ID
        peer_id: String,
        /// Room to join (optional - creates new if not provided)
        room_id: Option<String>,
        /// Client capabilities
        capabilities: ClientCapabilities,
    },
    
    /// Registration confirmation from server
    Registered {
        /// Assigned peer ID
        peer_id: String,
        /// Assigned room ID
        room_id: String,
    },
    
    /// SDP offer from initiating peer
    Offer {
        /// Target peer ID
        target_peer_id: String,
        /// Session Description Protocol offer
        sdp: String,
        /// Optional transceiver configuration
        transceivers: Vec<TransceiverConfig>,
    },
    
    /// SDP answer from responding peer
    Answer {
        /// Target peer ID (the offerer)
        target_peer_id: String,
        /// Session Description Protocol answer
        sdp: String,
    },
    
    /// ICE candidate from either peer
    IceCandidate {
        /// Target peer ID
        target_peer_id: String,
        /// ICE candidate information
        candidate: IceCandidateInfo,
    },
    
    /// ICE candidate gathering complete
    IceComplete {
        /// Target peer ID
        target_peer_id: String,
    },
    
    /// Peer joined the room
    PeerJoined {
        /// New peer's ID
        peer_id: String,
        /// Peer capabilities
        capabilities: ClientCapabilities,
    },
    
    /// Peer left the room
    PeerLeft {
        /// Peer ID that left
        peer_id: String,
    },
    
    /// Connection state update
    ConnectionState {
        /// Peer ID
        peer_id: String,
        /// New connection state
        state: ConnectionState,
    },
    
    /// Error message
    Error {
        /// Error code
        code: ErrorCode,
        /// Error message
        message: String,
    },
    
    /// Ping/Pong for keepalive
    Ping,
    
    /// Pong response
    Pong,
}

/// Client capabilities for negotiation
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct ClientCapabilities {
    /// Supported audio codecs
    pub audio_codecs: Vec<String>,
    /// Supported video codecs
    pub video_codecs: Vec<String>,
    /// Maximum video resolution
    pub max_resolution: Option<String>,
    /// Simulcast support
    pub simulcast: bool,
    /// Data channel support
    pub data_channel: bool,
    /// Trickle ICE support
    pub trickle_ice: bool,
    /// Additional capability flags
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

impl ClientCapabilities {
    /// Create default WebRTC capabilities
    pub fn default_webrtc() -> Self {
        Self {
            audio_codecs: vec![
                "opus".to_string(),
                "pcm".to_string(),
            ],
            video_codecs: vec![
                "vp8".to_string(),
                "vp9".to_string(),
                "h264".to_string(),
            ],
            max_resolution: Some("1080p".to_string()),
            simulcast: true,
            data_channel: true,
            trickle_ice: true,
            extra: HashMap::new(),
        }
    }
}

/// Transceiver configuration for SDP negotiation
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TransceiverConfig {
    /// Transceiver ID
    pub id: String,
    /// Media type
    pub kind: MediaKind,
    /// Direction (sendrecv, sendonly, recvonly, inactive)
    pub direction: Direction,
    /// Stream IDs associated with this transceiver
    pub stream_ids: Vec<String>,
    /// Preferred codecs (ordered by preference)
    pub preferred_codecs: Vec<String>,
}

/// Media kind enumeration
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Audio,
    Video,
    Data,
}

/// Media direction
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    SendRecv,
    SendOnly,
    RecvOnly,
    Inactive,
}

/// ICE candidate information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IceCandidateInfo {
    /// Candidate SDP string
    pub candidate: String,
    /// SDP media ID ("0" for audio, "1" for video, etc.)
    pub sdp_mid: Option<String>,
    /// SDP media line index
    pub sdp_m_line_index: Option<u32>,
    /// Candidate foundation (for grouping)
    pub foundation: Option<String>,
    /// Transport protocol (udp/tcp)
    pub protocol: Option<String>,
    /// Priority value
    pub priority: Option<u32>,
    /// IP address
    pub address: Option<String>,
    /// Port number
    pub port: Option<u16>,
    /// Candidate type (host, srflx, prflx, relay)
    #[serde(rename = "type")]
    pub candidate_type: Option<String>,
}

/// Connection state for signaling
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionState {
    /// Initial state
    New,
    /// Connecting in progress
    Connecting,
    /// Connected successfully
    Connected,
    /// Disconnected (may reconnect)
    Disconnected,
    /// Connection failed
    Failed,
    /// Connection closed
    Closed,
}

/// Error codes for signaling
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    /// Unknown error
    Unknown,
    /// Room not found
    RoomNotFound,
    /// Peer not found
    PeerNotFound,
    /// Invalid message format
    InvalidMessage,
    /// Room is full
    RoomFull,
    /// Authentication failed
    AuthFailed,
    /// Signaling server error
    ServerError,
    /// Transport error
    TransportError,
}

/// Signaling session state machine
#[derive(Debug, Clone)]
pub struct SignalingSession {
    /// Session ID
    pub session_id: String,
    /// Local peer ID
    pub local_peer_id: String,
    /// Remote peer ID (if connected)
    pub remote_peer_id: Option<String>,
    /// Current state
    pub state: SignalingState,
    /// Room ID
    pub room_id: Option<String>,
    /// Session creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Signaling state machine states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignalingState {
    /// Initial state
    Idle,
    /// Registered with signaling server
    Registered,
    /// Offer sent, waiting for answer
    Offering,
    /// Answer sent, waiting for ICE
    Answering,
    /// ICE exchange in progress
    IceExchanging,
    /// Signaling complete, ready for data
    Complete,
    /// Error state
    Error,
}

impl SignalingSession {
    /// Create a new signaling session
    pub fn new(local_peer_id: impl Into<String>) -> Self {
        Self {
            session_id: Uuid::new_v4().to_string(),
            local_peer_id: local_peer_id.into(),
            remote_peer_id: None,
            state: SignalingState::Idle,
            room_id: None,
            created_at: chrono::Utc::now(),
        }
    }
    
    /// Check if session can send offer
    pub fn can_send_offer(&self) -> bool {
        matches!(self.state, SignalingState::Registered | SignalingState::Complete)
    }
    
    /// Check if session can send answer
    pub fn can_send_answer(&self) -> bool {
        matches!(self.state, SignalingState::Offering)
    }
    
    /// Check if session can send ICE candidates
    pub fn can_send_ice(&self) -> bool {
        matches!(self.state, 
            SignalingState::Offering | 
            SignalingState::Answering | 
            SignalingState::IceExchanging |
            SignalingState::Complete
        )
    }
    
    /// Update state
    pub fn transition_to(&mut self, new_state: SignalingState) {
        tracing::debug!(
            "Signaling session {} transitioning from {:?} to {:?}",
            self.session_id,
            self.state,
            new_state
        );
        self.state = new_state;
    }
}

/// Generate a unique room ID
pub fn generate_room_id() -> String {
    format!("room_{}", Uuid::new_v4().simple())
}

/// Generate a unique peer ID
pub fn generate_peer_id() -> String {
    format!("peer_{}", Uuid::new_v4().simple())
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_signaling_message_serialization() {
        let msg = SignalingMessage::Offer {
            target_peer_id: "peer_123".to_string(),
            sdp: "v=0\r\n...".to_string(),
            transceivers: vec![TransceiverConfig {
                id: "audio_0".to_string(),
                kind: MediaKind::Audio,
                direction: Direction::SendRecv,
                stream_ids: vec!["stream_1".to_string()],
                preferred_codecs: vec!["opus".to_string()],
            }],
        };
        
        let json = serde_json::to_string(&msg).unwrap();
        let deserialized: SignalingMessage = serde_json::from_str(&json).unwrap();
        
        assert!(matches!(deserialized, SignalingMessage::Offer { .. }));
    }
    
    #[test]
    fn test_client_capabilities_default() {
        let caps = ClientCapabilities::default_webrtc();
        assert!(caps.audio_codecs.contains(&"opus".to_string()));
        assert!(caps.video_codecs.contains(&"vp8".to_string()));
        assert!(caps.trickle_ice);
    }
    
    #[test]
    fn test_signaling_session_state_machine() {
        let mut session = SignalingSession::new("peer_test");
        assert_eq!(session.state, SignalingState::Idle);
        assert!(session.can_send_offer()); // Can offer in Idle (as initiator)
        
        session.transition_to(SignalingState::Registered);
        assert!(session.can_send_offer());
        
        session.transition_to(SignalingState::Offering);
        assert!(!session.can_send_offer());
        assert!(session.can_send_answer());
        assert!(session.can_send_ice());
    }
    
    #[test]
    fn test_ice_candidate_info_parsing() {
        let candidate = IceCandidateInfo {
            candidate: "candidate:1 1 UDP 2130706431 192.168.1.1 5000 typ host".to_string(),
            sdp_mid: Some("0".to_string()),
            sdp_m_line_index: Some(0),
            foundation: Some("1".to_string()),
            protocol: Some("UDP".to_string()),
            priority: Some(2130706431),
            address: Some("192.168.1.1".to_string()),
            port: Some(5000),
            candidate_type: Some("host".to_string()),
        };
        
        let json = serde_json::to_string(&candidate).unwrap();
        let parsed: IceCandidateInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.candidate_type, Some("host".to_string()));
    }
}
