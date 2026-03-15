//! Room and Session Management
//!
//! GAP-44: Room/Session Management
//! WIH: GAP-44, Owner: T2-A5, Dependencies: T2-A4, Deadline
//!
//! Implements room-based peer management for WebRTC signaling.
//! Handles room creation, peer joining/leaving, and session lifecycle.
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for persistent room storage not yet implemented

use crate::signaling::protocol::{
    ClientCapabilities, ConnectionState,
};
use crate::types::{StreamingError, StreamingResult};
use dashmap::DashMap;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info};
use uuid::Uuid;

/// Room manager for handling multiple signaling rooms
#[derive(Debug, Clone)]
pub struct RoomManager {
    /// Active rooms
    rooms: Arc<DashMap<String, Room>>,
    /// Peer to room mapping
    peer_rooms: Arc<DashMap<String, String>>,
    /// Maximum peers per room
    max_peers_per_room: usize,
}

/// A signaling room containing multiple peers
#[derive(Debug, Clone)]
pub struct Room {
    /// Room identifier
    pub room_id: String,
    /// Room name (optional display name)
    pub name: Option<String>,
    /// Room creator/admin
    pub creator_id: String,
    /// Peers in this room
    pub peers: Arc<DashMap<String, PeerInfo>>,
    /// Room creation timestamp
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Room configuration
    pub config: RoomConfig,
    /// Room state
    pub state: Arc<RwLock<RoomState>>,
}

/// Room configuration
#[derive(Debug, Clone)]
pub struct RoomConfig {
    /// Maximum number of peers (0 = unlimited)
    pub max_peers: usize,
    /// Require password to join
    pub require_password: bool,
    /// Password hash (if required)
    pub password_hash: Option<String>,
    /// Allow peer reconnection
    pub allow_reconnect: bool,
    /// Reconnection timeout in seconds
    pub reconnect_timeout_secs: u64,
    /// Enable recording
    pub enable_recording: bool,
    /// Enable chat
    pub enable_chat: bool,
}

impl Default for RoomConfig {
    fn default() -> Self {
        Self {
            max_peers: 0, // Unlimited
            require_password: false,
            password_hash: None,
            allow_reconnect: true,
            reconnect_timeout_secs: 60,
            enable_recording: false,
            enable_chat: true,
        }
    }
}

/// Room state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoomState {
    /// Room is active and accepting peers
    Active,
    /// Room is locked (not accepting new peers)
    Locked,
    /// Room is closing
    Closing,
    /// Room is closed
    Closed,
}

/// Information about a peer in a room
#[derive(Debug, Clone)]
pub struct PeerInfo {
    /// Peer identifier
    pub peer_id: String,
    /// Display name
    pub display_name: Option<String>,
    /// Peer capabilities
    pub capabilities: ClientCapabilities,
    /// Connection state
    pub state: PeerState,
    /// Join timestamp
    pub joined_at: chrono::DateTime<chrono::Utc>,
    /// Last activity timestamp
    pub last_activity: Arc<RwLock<chrono::DateTime<chrono::Utc>>>,
    /// Peer metadata
    pub metadata: HashMap<String, String>,
}

/// Peer state in the room
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PeerState {
    /// Peer is joining
    Joining,
    /// Peer is connected and active
    Connected,
    /// Peer is temporarily disconnected (may reconnect)
    Disconnected,
    /// Peer is reconnecting
    Reconnecting,
    /// Peer has left
    Left,
}

/// Room statistics
#[derive(Debug, Clone)]
pub struct RoomStats {
    /// Room ID
    pub room_id: String,
    /// Total peers (including disconnected)
    pub total_peers: usize,
    /// Active (connected) peers
    pub active_peers: usize,
    /// Room creation time
    pub created_at: chrono::DateTime<chrono::Utc>,
    /// Room uptime in seconds
    pub uptime_secs: i64,
}

/// Room join result
#[derive(Debug, Clone)]
pub struct JoinResult {
    /// Room ID joined
    pub room_id: String,
    /// Assigned peer ID
    pub peer_id: String,
    /// Existing peers in the room
    pub existing_peers: Vec<PeerInfo>,
    /// Room configuration
    pub config: RoomConfig,
}

impl RoomManager {
    /// Create a new room manager
    pub fn new() -> Self {
        Self::with_max_peers(100)
    }
    
    /// Create with custom max peers per room
    pub fn with_max_peers(max_peers: usize) -> Self {
        Self {
            rooms: Arc::new(DashMap::new()),
            peer_rooms: Arc::new(DashMap::new()),
            max_peers_per_room: max_peers,
        }
    }
    
    /// Create a new room
    pub fn create_room(
        &self,
        creator_id: impl Into<String>,
        name: Option<String>,
        config: Option<RoomConfig>,
    ) -> StreamingResult<String> {
        let creator_id = creator_id.into();
        let room_id = format!("room_{}", Uuid::new_v4().simple());
        
        let config = config.unwrap_or_default();
        
        let room = Room {
            room_id: room_id.clone(),
            name,
            creator_id,
            peers: Arc::new(DashMap::new()),
            created_at: chrono::Utc::now(),
            config: config.clone(),
            state: Arc::new(RwLock::new(RoomState::Active)),
        };
        
        self.rooms.insert(room_id.clone(), room);
        
        info!("Created room {} with config {:?}", room_id, config);
        
        Ok(room_id)
    }
    
    /// Join an existing room
    pub async fn join_room(
        &self,
        room_id: impl Into<String>,
        peer_id: Option<String>,
        capabilities: ClientCapabilities,
        display_name: Option<String>,
        _password: Option<String>,
    ) -> StreamingResult<JoinResult> {
        let room_id = room_id.into();
        let peer_id = peer_id.unwrap_or_else(|| format!("peer_{}", Uuid::new_v4().simple()));
        
        // Find the room
        let room = self.rooms.get(&room_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Room {} not found", room_id))
        })?;
        
        // Check room state
        {
            let state = *room.state.read().await;
            if !matches!(state, RoomState::Active) {
                return Err(StreamingError::WebRtc(
                    format!("Room {} is not active (state: {:?})", room_id, state)
                ));
            }
        }
        
        // Check max peers
        if room.config.max_peers > 0 && room.peers.len() >= room.config.max_peers {
            return Err(StreamingError::WebRtc(
                format!("Room {} is full (max: {})", room_id, room.config.max_peers)
            ));
        }
        
        // Check if peer already in room (reconnect scenario)
        if let Some(existing_peer) = room.peers.get(&peer_id) {
            if room.config.allow_reconnect {
                info!("Peer {} reconnecting to room {}", peer_id, room_id);
                // Update peer state
                drop(existing_peer);
            } else {
                return Err(StreamingError::WebRtc(
                    format!("Peer {} already in room {}", peer_id, room_id)
                ));
            }
        }
        
        // Collect existing peers before adding new one
        let existing_peers: Vec<PeerInfo> = room
            .peers
            .iter()
            .filter(|p| matches!(p.state, PeerState::Connected | PeerState::Joining))
            .map(|p| p.clone())
            .collect();
        
        // Add peer to room
        let peer_info = PeerInfo {
            peer_id: peer_id.clone(),
            display_name,
            capabilities,
            state: PeerState::Joining,
            joined_at: chrono::Utc::now(),
            last_activity: Arc::new(RwLock::new(chrono::Utc::now())),
            metadata: HashMap::new(),
        };
        
        room.peers.insert(peer_id.clone(), peer_info);
        drop(room);
        
        // Map peer to room
        self.peer_rooms.insert(peer_id.clone(), room_id.clone());
        
        info!(
            "Peer {} joined room {} ({} existing peers)",
            peer_id,
            room_id,
            existing_peers.len()
        );
        
        // Get room config
        let room_ref = self.rooms.get(&room_id).unwrap();
        let config = room_ref.config.clone();
        drop(room_ref);
        
        Ok(JoinResult {
            room_id,
            peer_id,
            existing_peers,
            config,
        })
    }
    
    /// Leave a room
    pub async fn leave_room(&self, peer_id: impl Into<String>) -> StreamingResult<()> {
        let peer_id = peer_id.into();
        
        // Find which room the peer is in
        let room_id = self.peer_rooms.get(&peer_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Peer {} not in any room", peer_id))
        })?;
        
        let room_id = room_id.clone();
        
        // Remove peer from room
        if let Some(room) = self.rooms.get(&room_id) {
            if let Some(mut peer) = room.peers.get_mut(&peer_id) {
                peer.state = PeerState::Left;
                info!("Peer {} left room {}", peer_id, room_id);
            }
            
            // Clean up if room is empty
            if room.peers.is_empty() {
                drop(room);
                self.rooms.remove(&room_id);
                info!("Removed empty room {}", room_id);
            }
        }
        
        // Remove peer mapping
        self.peer_rooms.remove(&peer_id);
        
        Ok(())
    }
    
    /// Update peer state
    pub async fn update_peer_state(
        &self,
        peer_id: impl Into<String>,
        state: PeerState,
    ) -> StreamingResult<()> {
        let peer_id = peer_id.into();
        
        let room_id = self.peer_rooms.get(&peer_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Peer {} not in any room", peer_id))
        })?;
        
        if let Some(room) = self.rooms.get(&*room_id) {
            if let Some(mut peer) = room.peers.get_mut(&peer_id) {
                peer.state = state;
                *peer.last_activity.write().await = chrono::Utc::now();
                debug!("Peer {} state updated to {:?}", peer_id, state);
            }
        }
        
        Ok(())
    }
    
    /// Get peer info
    pub fn get_peer_info(&self, peer_id: impl AsRef<str>) -> Option<PeerInfo> {
        let peer_id = peer_id.as_ref();
        
        let room_id = self.peer_rooms.get(peer_id)?;
        let room = self.rooms.get(&*room_id)?;
        
        room.peers.get(peer_id).map(|p| p.clone())
    }
    
    /// Get room info
    pub fn get_room(&self, room_id: impl AsRef<str>) -> Option<Room> {
        self.rooms.get(room_id.as_ref()).map(|r| r.clone())
    }
    
    /// Get all peers in a room
    pub fn get_room_peers(&self, room_id: impl AsRef<str>) -> Vec<PeerInfo> {
        let room_id = room_id.as_ref();
        
        self.rooms
            .get(room_id)
            .map(|room| {
                room.peers
                    .iter()
                    .map(|p| p.clone())
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Get connected peers in a room (for signaling)
    pub fn get_connected_peers(&self, room_id: impl AsRef<str>) -> Vec<PeerInfo> {
        let room_id = room_id.as_ref();
        
        self.rooms
            .get(room_id)
            .map(|room| {
                room.peers
                    .iter()
                    .filter(|p| matches!(p.state, PeerState::Connected))
                    .map(|p| p.clone())
                    .collect()
            })
            .unwrap_or_default()
    }
    
    /// Get room statistics
    pub fn get_room_stats(&self, room_id: impl AsRef<str>) -> Option<RoomStats> {
        let room_id = room_id.as_ref();
        
        self.rooms.get(room_id).map(|room| {
            let active_peers = room
                .peers
                .iter()
                .filter(|p| matches!(p.state, PeerState::Connected))
                .count();
            
            let now = chrono::Utc::now();
            let uptime_secs = now.timestamp() - room.created_at.timestamp();
            
            RoomStats {
                room_id: room_id.to_string(),
                total_peers: room.peers.len(),
                active_peers,
                created_at: room.created_at,
                uptime_secs,
            }
        })
    }
    
    /// List all active rooms
    pub fn list_rooms(&self) -> Vec<String> {
        self.rooms
            .iter()
            .filter(|r| matches!(*r.state.blocking_read(), RoomState::Active))
            .map(|r| r.room_id.clone())
            .collect()
    }
    
    /// Close a room (admin action)
    pub async fn close_room(&self, room_id: impl AsRef<str>) -> StreamingResult<()> {
        let room_id = room_id.as_ref();
        
        let room = self.rooms.get(room_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Room {} not found", room_id))
        })?;
        
        let mut state = room.state.write().await;
        *state = RoomState::Closing;
        drop(state);
        
        // Notify all peers to leave
        for peer_ref in room.peers.iter() {
            self.peer_rooms.remove(&peer_ref.peer_id);
        }
        
        // Remove all peers
        room.peers.clear();
        drop(room);
        
        // Remove the room
        self.rooms.remove(room_id);
        
        info!("Closed room {}", room_id);
        
        Ok(())
    }
    
    /// Clean up disconnected peers
    pub async fn cleanup_disconnected_peers(&self, max_age_secs: i64) -> usize {
        let now = chrono::Utc::now();
        let mut removed_count = 0;
        
        for room_ref in self.rooms.iter() {
            let peers_to_remove: Vec<String> = room_ref
                .peers
                .iter()
                .filter(|p| {
                    matches!(p.state, PeerState::Disconnected | PeerState::Left)
                        && (now.timestamp() - p.joined_at.timestamp()) > max_age_secs
                })
                .map(|p| p.peer_id.clone())
                .collect();
            
            for peer_id in peers_to_remove {
                room_ref.peers.remove(&peer_id);
                self.peer_rooms.remove(&peer_id);
                removed_count += 1;
                debug!("Cleaned up disconnected peer {}", peer_id);
            }
        }
        
        removed_count
    }
    
    /// Get the room ID for a peer
    pub fn get_peer_room(&self, peer_id: impl AsRef<str>) -> Option<String> {
        self.peer_rooms.get(peer_id.as_ref()).map(|r| r.clone())
    }
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Session manager for tracking active peer connections
#[derive(Debug, Clone)]
pub struct SessionManager {
    /// Active peer sessions
    sessions: Arc<DashMap<String, PeerSession>>,
}

/// Peer session information
#[derive(Debug, Clone)]
pub struct PeerSession {
    /// Peer ID
    pub peer_id: String,
    /// Room ID
    pub room_id: String,
    /// Session start time
    pub started_at: chrono::DateTime<chrono::Utc>,
    /// Connection state
    pub connection_state: ConnectionState,
    /// Active peer connections (target_peer_id -> connection_info)
    pub connections: Arc<DashMap<String, PeerConnectionInfo>>,
}

/// Connection information between two peers
#[derive(Debug, Clone)]
pub struct PeerConnectionInfo {
    /// Target peer ID
    pub target_peer_id: String,
    /// Connection start time
    pub started_at: chrono::DateTime<chrono::Utc>,
    /// ICE connection state
    pub ice_state: ConnectionState,
    /// DTLS state
    pub dtls_state: ConnectionState,
    /// Data channel established
    pub data_channel_open: bool,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(DashMap::new()),
        }
    }
    
    /// Create a new session
    pub fn create_session(&self, peer_id: String, room_id: String) -> PeerSession {
        let session = PeerSession {
            peer_id: peer_id.clone(),
            room_id,
            started_at: chrono::Utc::now(),
            connection_state: ConnectionState::New,
            connections: Arc::new(DashMap::new()),
        };
        
        self.sessions.insert(peer_id.clone(), session.clone());
        info!("Created session for peer {} in room {}", peer_id, session.room_id);
        
        session
    }
    
    /// Get session for a peer
    pub fn get_session(&self, peer_id: impl AsRef<str>) -> Option<PeerSession> {
        self.sessions.get(peer_id.as_ref()).map(|s| s.clone())
    }
    
    /// Update connection state
    pub fn update_connection_state(
        &self,
        peer_id: impl AsRef<str>,
        state: ConnectionState,
    ) -> StreamingResult<()> {
        let peer_id = peer_id.as_ref();
        
        let mut session = self.sessions.get_mut(peer_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Session not found for peer {}", peer_id))
        })?;
        
        session.connection_state = state;
        debug!("Peer {} connection state updated to {:?}", peer_id, state);
        
        Ok(())
    }
    
    /// Add peer-to-peer connection
    pub fn add_connection(
        &self,
        peer_id: impl AsRef<str>,
        target_peer_id: impl Into<String>,
    ) -> StreamingResult<()> {
        let peer_id = peer_id.as_ref();
        
        let session = self.sessions.get(peer_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Session not found for peer {}", peer_id))
        })?;
        
        let conn_info = PeerConnectionInfo {
            target_peer_id: target_peer_id.into(),
            started_at: chrono::Utc::now(),
            ice_state: ConnectionState::New,
            dtls_state: ConnectionState::New,
            data_channel_open: false,
        };
        
        session.connections.insert(conn_info.target_peer_id.clone(), conn_info);
        drop(session);
        
        Ok(())
    }
    
    /// Remove peer-to-peer connection
    pub fn remove_connection(
        &self,
        peer_id: impl AsRef<str>,
        target_peer_id: impl AsRef<str>,
    ) -> StreamingResult<()> {
        let peer_id = peer_id.as_ref();
        let target_peer_id = target_peer_id.as_ref();
        
        let session = self.sessions.get(peer_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Session not found for peer {}", peer_id))
        })?;
        
        session.connections.remove(target_peer_id);
        drop(session);
        
        Ok(())
    }
    
    /// End a session
    pub fn end_session(&self, peer_id: impl AsRef<str>) -> StreamingResult<()> {
        let peer_id = peer_id.as_ref();
        
        self.sessions.remove(peer_id).ok_or_else(|| {
            StreamingError::WebRtc(format!("Session not found for peer {}", peer_id))
        })?;
        
        info!("Ended session for peer {}", peer_id);
        
        Ok(())
    }
    
    /// Get active session count
    pub fn session_count(&self) -> usize {
        self.sessions.len()
    }
    
    /// Get all active sessions
    pub fn get_all_sessions(&self) -> Vec<PeerSession> {
        self.sessions
            .iter()
            .map(|s| s.clone())
            .collect()
    }
}

impl Default for SessionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_room_manager_creation() {
        let manager = RoomManager::new();
        assert!(manager.list_rooms().is_empty());
    }
    
    #[tokio::test]
    async fn test_create_and_join_room() {
        let manager = RoomManager::new();
        
        // Create room
        let room_id = manager.create_room("creator_1", Some("Test Room".to_string()), None).unwrap();
        assert!(manager.get_room(&room_id).is_some());
        
        // Join room
        let capabilities = ClientCapabilities::default_webrtc();
        let result = manager.join_room(&room_id, None, capabilities, Some("Alice".to_string()), None).await;
        
        assert!(result.is_ok());
        let join_result = result.unwrap();
        assert_eq!(join_result.room_id, room_id);
        assert!(join_result.existing_peers.is_empty()); // First peer
    }
    
    #[tokio::test]
    async fn test_room_full() {
        let manager = RoomManager::with_max_peers(2);
        
        let config = RoomConfig {
            max_peers: 1,
            ..Default::default()
        };
        
        let room_id = manager.create_room("creator_1", None, Some(config)).unwrap();
        
        let capabilities = ClientCapabilities::default_webrtc();
        
        // First peer joins
        let result1 = manager.join_room(&room_id, None, capabilities.clone(), None, None).await;
        assert!(result1.is_ok());
        
        // Second peer should fail
        let result2 = manager.join_room(&room_id, None, capabilities, None, None).await;
        assert!(result2.is_err());
    }
    
    #[tokio::test]
    async fn test_leave_room() {
        let manager = RoomManager::new();
        let room_id = manager.create_room("creator_1", None, None).unwrap();
        
        let capabilities = ClientCapabilities::default_webrtc();
        let result = manager.join_room(&room_id, None, capabilities, None, None).await.unwrap();
        let peer_id = result.peer_id;
        
        // Leave room
        let leave_result = manager.leave_room(&peer_id).await;
        assert!(leave_result.is_ok());
        
        // Peer should no longer be in room
        assert!(manager.get_peer_info(&peer_id).is_none());
    }
    
    #[test]
    fn test_session_manager() {
        let manager = SessionManager::new();
        
        // Create session
        let session = manager.create_session("peer_1".to_string(), "room_1".to_string());
        assert_eq!(session.peer_id, "peer_1");
        assert_eq!(session.room_id, "room_1");
        
        // Get session
        let retrieved = manager.get_session("peer_1");
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().peer_id, "peer_1");
        
        // Update state
        manager.update_connection_state("peer_1", ConnectionState::Connected).unwrap();
        
        // Add connection
        manager.add_connection("peer_1", "peer_2").unwrap();
        
        // End session
        manager.end_session("peer_1").unwrap();
        assert!(manager.get_session("peer_1").is_none());
    }
    
    #[tokio::test]
    async fn test_cleanup_disconnected_peers() {
        let manager = RoomManager::new();
        let room_id = manager.create_room("creator_1", None, None).unwrap();
        
        let capabilities = ClientCapabilities::default_webrtc();
        let result = manager.join_room(&room_id, None, capabilities, None, None).await.unwrap();
        let peer_id = result.peer_id;
        
        // Mark as disconnected
        manager.update_peer_state(&peer_id, PeerState::Disconnected).await.unwrap();
        
        // Cleanup with 0 max age should remove the peer
        let removed = manager.cleanup_disconnected_peers(0).await;
        assert_eq!(removed, 1);
    }
}
