//! ICE (Interactive Connectivity Establishment) Implementation
//!
//! WIH: GAP-41, Owner: T2-A4
//! Dependencies: GAP-36 (WebRTC Foundation)
//! Coordinates with: T2-A5 (Signaling Integration)
//!
//! This module implements ICE candidate gathering, pairing, and connectivity
//! checking as defined in RFC 5245 (ICE) and RFC 8445 (ICE-Nomad).
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for STUN/TURN server communication pending full impl

use crate::types::{StreamingError, StreamingResult};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time::{Duration, Instant};
use tracing::{debug, error, info, trace, warn};

/// ICE agent version
pub const ICE_VERSION: &str = "0.1.0";

/// Default STUN server
pub const DEFAULT_STUN_SERVER: &str = "stun:stun.l.google.com:19302";

/// ICE candidate gathering timeout
pub const ICE_GATHERING_TIMEOUT: Duration = Duration::from_secs(30);

/// ICE connectivity check interval
pub const ICE_CHECK_INTERVAL: Duration = Duration::from_millis(50);

/// ICE configuration
#[derive(Debug, Clone)]
pub struct IceConfig {
    /// STUN servers for NAT traversal
    pub stun_servers: Vec<String>,
    /// TURN servers for relay
    pub turn_servers: Vec<TurnServerConfig>,
    /// ICE gathering policy
    pub gathering_policy: IceGatheringPolicy,
    /// ICE transport policy
    pub transport_policy: IceTransportPolicy,
    /// Ice lite mode (server only)
    pub ice_lite: bool,
    /// Preference for IPv6
    pub prefer_ipv6: bool,
}

impl Default for IceConfig {
    fn default() -> Self {
        Self {
            stun_servers: vec![DEFAULT_STUN_SERVER.to_string()],
            turn_servers: vec![],
            gathering_policy: IceGatheringPolicy::All,
            transport_policy: IceTransportPolicy::All,
            ice_lite: false,
            prefer_ipv6: false,
        }
    }
}

/// TURN server configuration
#[derive(Debug, Clone)]
pub struct TurnServerConfig {
    /// TURN server URL
    pub url: String,
    /// Username for authentication
    pub username: String,
    /// Credential (password)
    pub credential: String,
}

/// ICE gathering policy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IceGatheringPolicy {
    /// Gather all candidate types
    All,
    /// No relay candidates
    NoRelay,
    /// Relay only
    RelayOnly,
}

/// ICE transport policy
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IceTransportPolicy {
    /// All transports
    All,
    /// Relay only
    Relay,
    /// No relay
    NoRelay,
}

/// ICE candidate types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IceCandidateType {
    /// Host candidate (local address)
    Host,
    /// Server reflexive (STUN-discovered)
    Srflx,
    /// Peer reflexive (learned during checks)
    Prflx,
    /// Relay (TURN)
    Relay,
}

impl std::fmt::Display for IceCandidateType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IceCandidateType::Host => write!(f, "host"),
            IceCandidateType::Srflx => write!(f, "srflx"),
            IceCandidateType::Prflx => write!(f, "prflx"),
            IceCandidateType::Relay => write!(f, "relay"),
        }
    }
}

/// ICE candidate protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IceProtocol {
    /// UDP protocol
    Udp,
    /// TCP protocol
    Tcp,
}

impl std::fmt::Display for IceProtocol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IceProtocol::Udp => write!(f, "udp"),
            IceProtocol::Tcp => write!(f, "tcp"),
        }
    }
}

/// ICE candidate representing a potential connection endpoint
///
/// WIH: GAP-41, Owner: T2-A4
#[derive(Debug, Clone)]
pub struct IceCandidate {
    /// Foundation (grouping identifier)
    pub foundation: String,
    /// Component ID (1 for RTP, 2 for RTCP)
    pub component: u16,
    /// Transport protocol
    pub protocol: IceProtocol,
    /// Priority value
    pub priority: u32,
    /// IP address
    pub address: String,
    /// Port number
    pub port: u16,
    /// Candidate type
    pub candidate_type: IceCandidateType,
    /// Related address (for srflx/relay)
    pub related_address: Option<String>,
    /// Related port
    pub related_port: Option<u16>,
    /// SDP string representation
    pub sdp: String,
    /// Candidate ID
    pub id: String,
}

impl IceCandidate {
    /// Create a new host candidate
    pub fn new_host(address: SocketAddr, component: u16) -> Self {
        let id = format!("candidate_{}", uuid::Uuid::new_v4().to_string()[..8].to_string());
        let foundation = format!("{}", address.ip());
        let priority = calculate_priority(IceCandidateType::Host, component, IceProtocol::Udp);
        
        let sdp = format!(
            "candidate:{} {} {} {} {} {} typ host",
            foundation, component, "udp", priority, address.ip(), address.port()
        );

        Self {
            foundation,
            component,
            protocol: IceProtocol::Udp,
            priority,
            address: address.ip().to_string(),
            port: address.port(),
            candidate_type: IceCandidateType::Host,
            related_address: None,
            related_port: None,
            sdp,
            id,
        }
    }

    /// Create a candidate from SDP string
    pub fn from_sdp(sdp: &str) -> StreamingResult<Self> {
        // Parse candidate SDP line
        // Format: candidate:<foundation> <component> <protocol> <priority> <ip> <port> typ <type> ...
        let parts: Vec<&str> = sdp.split_whitespace().collect();
        if parts.len() < 8 {
            return Err(StreamingError::WebRtc(
                format!("Invalid candidate SDP: {}", sdp)
            ));
        }

        let foundation = parts[0].trim_start_matches("candidate:").to_string();
        let component = parts[1].parse::<u16>()
            .map_err(|_| StreamingError::WebRtc("Invalid component".to_string()))?;
        let protocol = match parts[2].to_lowercase().as_str() {
            "udp" => IceProtocol::Udp,
            "tcp" => IceProtocol::Tcp,
            _ => return Err(StreamingError::WebRtc("Invalid protocol".to_string())),
        };
        let priority = parts[3].parse::<u32>()
            .map_err(|_| StreamingError::WebRtc("Invalid priority".to_string()))?;
        let address = parts[4].to_string();
        let port = parts[5].parse::<u16>()
            .map_err(|_| StreamingError::WebRtc("Invalid port".to_string()))?;

        let candidate_type = if parts.len() >= 8 && parts[6] == "typ" {
            match parts[7] {
                "host" => IceCandidateType::Host,
                "srflx" => IceCandidateType::Srflx,
                "prflx" => IceCandidateType::Prflx,
                "relay" => IceCandidateType::Relay,
                _ => return Err(StreamingError::WebRtc("Invalid candidate type".to_string())),
            }
        } else {
            IceCandidateType::Host
        };

        let id = format!("candidate_{}", uuid::Uuid::new_v4().to_string()[..8].to_string());

        Ok(Self {
            foundation,
            component,
            protocol,
            priority,
            address,
            port,
            candidate_type,
            related_address: None,
            related_port: None,
            sdp: sdp.to_string(),
            id,
        })
    }

    /// Get the socket address for this candidate
    pub fn socket_addr(&self) -> StreamingResult<SocketAddr> {
        let ip: std::net::IpAddr = self.address.parse()
            .map_err(|_| StreamingError::WebRtc(
                format!("Invalid IP address: {}", self.address)
            ))?;
        Ok(SocketAddr::new(ip, self.port))
    }
}

/// ICE candidate pair for connectivity checking
#[derive(Debug, Clone)]
pub struct CandidatePair {
    /// Pair ID
    pub id: String,
    /// Local candidate
    pub local: IceCandidate,
    /// Remote candidate
    pub remote: IceCandidate,
    /// Priority of this pair
    pub priority: u64,
    /// Current state
    pub state: PairState,
    /// Number of checks sent
    pub checks_sent: u32,
    /// Number of successful checks
    pub checks_received: u32,
    /// RTT in milliseconds
    pub rtt_ms: Option<u32>,
    /// Last check time
    pub last_check: Option<Instant>,
}

/// Candidate pair state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PairState {
    /// Waiting to be checked
    Waiting,
    /// In progress
    InProgress,
    /// Succeeded
    Succeeded,
    /// Failed
    Failed,
    /// Frozen
    Frozen,
}

impl CandidatePair {
    /// Create a new candidate pair
    pub fn new(local: IceCandidate, remote: IceCandidate) -> Self {
        let priority = calculate_pair_priority(local.priority, remote.priority);
        let id = format!("pair_{}", uuid::Uuid::new_v4().to_string()[..8].to_string());

        Self {
            id,
            local,
            remote,
            priority,
            state: PairState::Waiting,
            checks_sent: 0,
            checks_received: 0,
            rtt_ms: None,
            last_check: None,
        }
    }
}

/// ICE agent for candidate gathering and connectivity checking
///
/// WIH: GAP-41, Owner: T2-A4
pub struct IceAgent {
    /// Agent ID
    agent_id: String,
    /// Configuration
    config: IceConfig,
    /// Local candidates
    local_candidates: Arc<RwLock<Vec<IceCandidate>>>,
    /// Remote candidates
    remote_candidates: Arc<RwLock<Vec<IceCandidate>>>,
    /// Candidate pairs
    candidate_pairs: Arc<RwLock<Vec<CandidatePair>>>,
    /// Selected pair (after successful check)
    selected_pair: Arc<RwLock<Option<CandidatePair>>>,
    /// Agent state
    state: Arc<RwLock<IceAgentState>>,
    /// Gathering complete signal
    gathering_complete: Arc<RwLock<bool>>,
    /// Candidate sender for async gathering
    candidate_sender: Arc<Mutex<Option<mpsc::UnboundedSender<IceCandidate>>>>,
}

/// ICE agent state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IceAgentState {
    /// New
    New,
    /// Gathering
    Gathering,
    /// Gathering complete
    GatheringComplete,
    /// Checking
    Checking,
    /// Connected
    Connected,
    /// Completed
    Completed,
    /// Failed
    Failed,
    /// Disconnected
    Disconnected,
}

impl IceAgent {
    /// Create a new ICE agent
    ///
    /// WIH: GAP-41, Owner: T2-A4
    pub fn new(agent_id: impl Into<String>, config: IceConfig) -> Self {
        Self {
            agent_id: agent_id.into(),
            config,
            local_candidates: Arc::new(RwLock::new(vec![])),
            remote_candidates: Arc::new(RwLock::new(vec![])),
            candidate_pairs: Arc::new(RwLock::new(vec![])),
            selected_pair: Arc::new(RwLock::new(None)),
            state: Arc::new(RwLock::new(IceAgentState::New)),
            gathering_complete: Arc::new(RwLock::new(false)),
            candidate_sender: Arc::new(Mutex::new(None)),
        }
    }

    /// Start ICE candidate gathering
    ///
    /// Discovers local network interfaces and queries STUN servers
    /// to determine reflexive and relay candidates.
    ///
    /// WIH: GAP-41, Owner: T2-A4
    pub async fn start_gathering(&self) -> StreamingResult<()> {
        info!("ICE Agent {}: Starting candidate gathering", self.agent_id);
        
        let mut state = self.state.write().await;
        *state = IceAgentState::Gathering;
        drop(state);

        // Gather host candidates
        self.gather_host_candidates().await?;

        // Gather server reflexive candidates via STUN
        if !self.config.stun_servers.is_empty() {
            self.gather_srflx_candidates().await?;
        }

        // Gather relay candidates via TURN (if configured)
        if !self.config.turn_servers.is_empty() {
            self.gather_relay_candidates().await?;
        }

        let mut state = self.state.write().await;
        *state = IceAgentState::GatheringComplete;
        drop(state);

        let mut gathering_complete = self.gathering_complete.write().await;
        *gathering_complete = true;

        info!("ICE Agent {}: Gathering complete", self.agent_id);
        Ok(())
    }

    /// Gather host candidates from local interfaces
    ///
    /// SYSTEM_LAW: Uses STUB_APPROVED for interface enumeration
    async fn gather_host_candidates(&self) -> StreamingResult<()> {
        debug!("ICE Agent {}: Gathering host candidates", self.agent_id);

        // STUB_APPROVED: Full interface enumeration pending network module
        let local_addrs = vec![
            SocketAddr::from(([127, 0, 0, 1], 0)),
            SocketAddr::from(([192, 168, 1, 100], 0)),
        ];

        let mut candidates = self.local_candidates.write().await;
        for addr in local_addrs {
            let candidate = IceCandidate::new_host(addr, 1);
            info!("ICE Agent {}: Found host candidate: {}", 
                self.agent_id, candidate.sdp);
            candidates.push(candidate);
        }

        Ok(())
    }

    /// Gather server reflexive candidates via STUN
    ///
    /// SYSTEM_LAW: Uses STUB_APPROVED for STUN communication
    async fn gather_srflx_candidates(&self) -> StreamingResult<()> {
        debug!("ICE Agent {}: Gathering srflx candidates", self.agent_id);

        // STUB_APPROVED: Full STUN client pending network module
        for server in &self.config.stun_servers {
            debug!("ICE Agent {}: Querying STUN server: {}", self.agent_id, server);
            
            // STUB: Simulated STUN response
            let public_addr = SocketAddr::from(([203, 0, 113, 1], 54321));
            
            let foundation = format!("srflx_{}", server.replace(':', "_"));
            let priority = calculate_priority(IceCandidateType::Srflx, 1, IceProtocol::Udp);
            
            let sdp = format!(
                "candidate:{} 1 udp {} {} {} typ srflx raddr {} rport {}",
                foundation, priority, public_addr.ip(), public_addr.port(),
                "192.168.1.100", 54321
            );

            let candidate = IceCandidate {
                foundation,
                component: 1,
                protocol: IceProtocol::Udp,
                priority,
                address: public_addr.ip().to_string(),
                port: public_addr.port(),
                candidate_type: IceCandidateType::Srflx,
                related_address: Some("192.168.1.100".to_string()),
                related_port: Some(54321),
                sdp,
                id: format!("candidate_{}", uuid::Uuid::new_v4().to_string()[..8].to_string()),
            };

            let mut candidates = self.local_candidates.write().await;
            info!("ICE Agent {}: Found srflx candidate: {}", 
                self.agent_id, candidate.sdp);
            candidates.push(candidate);
        }

        Ok(())
    }

    /// Gather relay candidates via TURN
    ///
    /// SYSTEM_LAW: Uses STUB_APPROVED for TURN communication
    async fn gather_relay_candidates(&self) -> StreamingResult<()> {
        debug!("ICE Agent {}: Gathering relay candidates", self.agent_id);

        // STUB_APPROVED: Full TURN client pending network module
        for server in &self.config.turn_servers {
            debug!("ICE Agent {}: Allocating TURN relay on: {}", 
                self.agent_id, server.url);

            // STUB: Simulated TURN allocation
            let relay_addr = SocketAddr::from(([198, 51, 100, 10], 40000));
            
            let foundation = "relay_1".to_string();
            let priority = calculate_priority(IceCandidateType::Relay, 1, IceProtocol::Udp);

            let sdp = format!(
                "candidate:{} 1 udp {} {} {} typ relay raddr {} rport {}",
                foundation, priority, relay_addr.ip(), relay_addr.port(),
                "203.0.113.1", 54321
            );

            let candidate = IceCandidate {
                foundation,
                component: 1,
                protocol: IceProtocol::Udp,
                priority,
                address: relay_addr.ip().to_string(),
                port: relay_addr.port(),
                candidate_type: IceCandidateType::Relay,
                related_address: Some("203.0.113.1".to_string()),
                related_port: Some(54321),
                sdp,
                id: format!("candidate_{}", uuid::Uuid::new_v4().to_string()[..8].to_string()),
            };

            let mut candidates = self.local_candidates.write().await;
            info!("ICE Agent {}: Found relay candidate: {}", 
                self.agent_id, candidate.sdp);
            candidates.push(candidate);
        }

        Ok(())
    }

    /// Get local candidates
    ///
    /// WIH: GAP-41, Owner: T2-A4
    pub async fn get_local_candidates(&self) -> StreamingResult<Vec<IceCandidate>> {
        let candidates = self.local_candidates.read().await;
        Ok(candidates.clone())
    }

    /// Add a remote candidate
    ///
    /// WIH: GAP-41, Owner: T2-A4
    pub async fn add_remote_candidate(&self, candidate: IceCandidate) -> StreamingResult<()> {
        debug!("ICE Agent {}: Adding remote candidate: {}", 
            self.agent_id, candidate.sdp);

        let mut candidates = self.remote_candidates.write().await;
        candidates.push(candidate);
        Ok(())
    }

    /// Start connectivity checks
    ///
    /// Pairs local and remote candidates, then performs connectivity checks
    /// to find a working path.
    ///
    /// WIH: GAP-41, Owner: T2-A4
    pub async fn start_connectivity_checks(&self) -> StreamingResult<()> {
        info!("ICE Agent {}: Starting connectivity checks", self.agent_id);

        let mut state = self.state.write().await;
        *state = IceAgentState::Checking;
        drop(state);

        // Form candidate pairs
        self.form_candidate_pairs().await?;

        // Perform connectivity checks
        self.perform_connectivity_checks().await?;

        Ok(())
    }

    /// Form candidate pairs from local and remote candidates
    ///
    /// WIH: GAP-41, Owner: T2-A4
    async fn form_candidate_pairs(&self) -> StreamingResult<()> {
        let locals = self.local_candidates.read().await;
        let remotes = self.remote_candidates.read().await;

        let mut pairs = self.candidate_pairs.write().await;
        pairs.clear();

        for local in locals.iter() {
            for remote in remotes.iter() {
                // Only pair candidates with same component and compatible protocols
                if local.component == remote.component {
                    let pair = CandidatePair::new(local.clone(), remote.clone());
                    debug!("ICE Agent {}: Formed pair: {} -> {} (priority: {})",
                        self.agent_id, local.address, remote.address, pair.priority);
                    pairs.push(pair);
                }
            }
        }

        // Sort by priority (highest first)
        pairs.sort_by(|a, b| b.priority.cmp(&a.priority));

        info!("ICE Agent {}: Formed {} candidate pairs", self.agent_id, pairs.len());
        Ok(())
    }

    /// Perform connectivity checks on candidate pairs
    ///
    /// SYSTEM_LAW: Uses STUB_APPROVED for STUN binding requests
    async fn perform_connectivity_checks(&self) -> StreamingResult<()> {
        info!("ICE Agent {}: Performing connectivity checks", self.agent_id);

        // STUB_APPROVED: Full STUN binding request/response pending impl
        let mut pairs = self.candidate_pairs.write().await;
        
        for pair in pairs.iter_mut() {
            debug!("ICE Agent {}: Checking pair {} -> {}",
                self.agent_id, pair.local.address, pair.remote.address);

            // STUB: Simulate connectivity check
            pair.state = PairState::InProgress;
            pair.checks_sent += 1;
            
            // Simulate successful check for first pair
            if pair.local.candidate_type == IceCandidateType::Host {
                pair.state = PairState::Succeeded;
                pair.checks_received += 1;
                pair.rtt_ms = Some(15);
                pair.last_check = Some(Instant::now());
                
                info!("ICE Agent {}: Pair succeeded: {} -> {} (RTT: {}ms)",
                    self.agent_id, pair.local.address, pair.remote.address, 
                    pair.rtt_ms.unwrap_or(0));
                
                // Select this pair
                let mut selected = self.selected_pair.write().await;
                *selected = Some(pair.clone());
                
                let mut state = self.state.write().await;
                *state = IceAgentState::Connected;
                
                break;
            } else {
                pair.state = PairState::Failed;
            }
        }

        Ok(())
    }

    /// Get the selected candidate pair
    ///
    /// WIH: GAP-41, Owner: T2-A4
    pub async fn get_selected_pair(&self) -> StreamingResult<Option<CandidatePair>> {
        let pair = self.selected_pair.read().await;
        Ok(pair.clone())
    }

    /// Close the ICE agent
    pub async fn close(&self) -> StreamingResult<()> {
        info!("ICE Agent {}: Closing", self.agent_id);
        
        let mut state = self.state.write().await;
        *state = IceAgentState::Disconnected;
        
        Ok(())
    }

    /// Get ICE agent statistics
    pub async fn stats(&self) -> IceStats {
        let locals = self.local_candidates.read().await;
        let pairs = self.candidate_pairs.read().await;
        let selected = self.selected_pair.read().await;

        IceStats {
            local_candidates: locals.len(),
            remote_candidates: self.remote_candidates.read().await.len(),
            candidate_pairs: pairs.len(),
            selected_pair: selected.as_ref().map(|p| p.id.clone()),
            state: *self.state.read().await,
        }
    }
}

/// ICE statistics
#[derive(Debug, Clone)]
pub struct IceStats {
    pub local_candidates: usize,
    pub remote_candidates: usize,
    pub candidate_pairs: usize,
    pub selected_pair: Option<String>,
    pub state: IceAgentState,
}

/// Calculate candidate priority per RFC 8445
fn calculate_priority(candidate_type: IceCandidateType, component: u16, protocol: IceProtocol) -> u32 {
    let type_preference = match candidate_type {
        IceCandidateType::Host => 126,
        IceCandidateType::Prflx => 110,
        IceCandidateType::Srflx => 100,
        IceCandidateType::Relay => 0,
    };

    let local_preference = match protocol {
        IceProtocol::Udp => 65535,
        IceProtocol::Tcp => 65534,
    };

    // priority = (2^24) * type_preference + (2^8) * local_preference + (256 - component)
    ((type_preference as u32) << 24) | ((local_preference as u32) << 8) | (256 - component as u32)
}

/// Calculate pair priority per RFC 8445
fn calculate_pair_priority(local_priority: u32, remote_priority: u32) -> u64 {
    // pair priority = 2^32 * MIN(G, D) + 2 * MAX(G, D) + (G > D ? 1 : 0)
    let g = local_priority as u64;
    let d = remote_priority as u64;
    
    let min_gd = std::cmp::min(g, d);
    let max_gd = std::cmp::max(g, d);
    
    (1u64 << 32) * min_gd + 2 * max_gd + if g > d { 1 } else { 0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ice_candidate_new_host() {
        let addr = SocketAddr::from(([127, 0, 0, 1], 5000));
        let candidate = IceCandidate::new_host(addr, 1);

        assert_eq!(candidate.address, "127.0.0.1");
        assert_eq!(candidate.port, 5000);
        assert_eq!(candidate.component, 1);
        assert_eq!(candidate.candidate_type, IceCandidateType::Host);
        assert_eq!(candidate.protocol, IceProtocol::Udp);
    }

    #[test]
    fn test_ice_candidate_from_sdp() {
        let sdp = "candidate:1234567890 1 udp 2130706431 192.168.1.100 5000 typ host";
        let candidate = IceCandidate::from_sdp(sdp).unwrap();

        assert_eq!(candidate.foundation, "1234567890");
        assert_eq!(candidate.component, 1);
        assert_eq!(candidate.address, "192.168.1.100");
        assert_eq!(candidate.port, 5000);
        assert_eq!(candidate.candidate_type, IceCandidateType::Host);
    }

    #[tokio::test]
    async fn test_ice_agent_creation() {
        let config = IceConfig::default();
        let agent = IceAgent::new("test_agent", config);

        let stats = agent.stats().await;
        assert_eq!(stats.local_candidates, 0);
        assert_eq!(stats.state, IceAgentState::New);
    }

    #[tokio::test]
    async fn test_candidate_gathering() {
        let config = IceConfig::default();
        let agent = IceAgent::new("test_agent", config);

        agent.start_gathering().await.unwrap();

        let candidates = agent.get_local_candidates().await.unwrap();
        assert!(!candidates.is_empty());

        let stats = agent.stats().await;
        assert_eq!(stats.state, IceAgentState::GatheringComplete);
    }

    #[test]
    fn test_priority_calculation() {
        let host_priority = calculate_priority(IceCandidateType::Host, 1, IceProtocol::Udp);
        let relay_priority = calculate_priority(IceCandidateType::Relay, 1, IceProtocol::Udp);

        assert!(host_priority > relay_priority);
    }

    #[test]
    fn test_pair_priority_calculation() {
        let local_p = calculate_priority(IceCandidateType::Host, 1, IceProtocol::Udp);
        let remote_p = calculate_priority(IceCandidateType::Host, 1, IceProtocol::Udp);

        let pair_priority = calculate_pair_priority(local_p, remote_p);
        assert!(pair_priority > 0);
    }

    #[tokio::test]
    async fn test_candidate_pairing() {
        let config = IceConfig::default();
        let agent = IceAgent::new("test_agent", config);

        // Add some local candidates (simulated)
        agent.start_gathering().await.unwrap();

        // Add remote candidates
        let remote_candidate = IceCandidate::new_host(
            SocketAddr::from(([10, 0, 0, 1], 6000)), 1);
        agent.add_remote_candidate(remote_candidate).await.unwrap();

        // Start connectivity checks
        agent.start_connectivity_checks().await.unwrap();

        let stats = agent.stats().await;
        assert!(stats.candidate_pairs > 0);
    }
}
