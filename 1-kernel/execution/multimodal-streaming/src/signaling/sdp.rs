//! SDP (Session Description Protocol) Handling
//!
//! GAP-43: SDP Offer/Answer Handling
//! WIH: GAP-43, Owner: T2-A5, Dependencies: T2-A4, Deadline
//!
//! Implements SDP parsing and generation for WebRTC peer connection negotiation.
//! Handles SDP offer/answer exchange with codec preference and transceiver configuration.
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for full SDP parser (using string-based generation)

use crate::signaling::protocol::{ClientCapabilities, Direction, MediaKind, TransceiverConfig};
use crate::types::{StreamingError, StreamingResult};
use std::collections::HashMap;

/// SDP session description
#[derive(Debug, Clone)]
pub struct SessionDescription {
    /// SDP type (offer or answer)
    pub sdp_type: SdpType,
    /// SDP version
    pub version: String,
    /// Origin information
    pub origin: Origin,
    /// Session name
    pub session_name: String,
    /// Connection information
    pub connection: Option<ConnectionInfo>,
    /// Timing information
    pub timing: String,
    /// Media sections
    pub media_sections: Vec<MediaSection>,
    /// Bundle group (BUNDLE line)
    pub bundle_groups: Vec<String>,
    /// ICE parameters
    pub ice_params: Option<IceParameters>,
    /// DTLS fingerprint
    pub dtls_fingerprint: Option<DtlsFingerprint>,
    /// Additional attributes
    pub attributes: HashMap<String, String>,
}

/// SDP type
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SdpType {
    Offer,
    Answer,
}

impl std::fmt::Display for SdpType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SdpType::Offer => write!(f, "offer"),
            SdpType::Answer => write!(f, "answer"),
        }
    }
}

/// Origin information
#[derive(Debug, Clone)]
pub struct Origin {
    pub username: String,
    pub sess_id: String,
    pub sess_version: String,
    pub nettype: String,
    pub addrtype: String,
    pub unicast_address: String,
}

/// Connection information
#[derive(Debug, Clone)]
pub struct ConnectionInfo {
    pub nettype: String,
    pub addrtype: String,
    pub address: String,
}

/// Media section
#[derive(Debug, Clone)]
pub struct MediaSection {
    /// Media type (audio, video, application)
    pub kind: MediaKind,
    /// Port number
    pub port: u16,
    /// Transport protocol
    pub protocol: String,
    /// Format/media descriptions (payload types or "webrtc-datachannel")
    pub formats: Vec<String>,
    /// Connection info (overrides session-level)
    pub connection: Option<ConnectionInfo>,
    /// ICE parameters for this media section
    pub ice_params: Option<IceParameters>,
    /// DTLS fingerprint
    pub dtls_fingerprint: Option<DtlsFingerprint>,
    /// Direction attribute
    pub direction: Direction,
    /// RTPmap entries (payload type -> encoding)
    pub rtpmaps: Vec<RtpMap>,
    /// FMTP entries (format parameters)
    pub fmtps: Vec<Fmtp>,
    /// SSRCs for this media
    pub ssrcs: Vec<SsrcInfo>,
    /// Stream IDs (msid)
    pub stream_ids: Vec<String>,
    /// RTCP mux enabled
    pub rtcp_mux: bool,
    /// Additional attributes
    pub attributes: HashMap<String, String>,
}

/// RTP map entry
#[derive(Debug, Clone)]
pub struct RtpMap {
    pub payload_type: u8,
    pub encoding_name: String,
    pub clock_rate: u32,
    pub encoding_params: Option<String>,
}

/// FMTP (format parameters)
#[derive(Debug, Clone)]
pub struct Fmtp {
    pub payload_type: u8,
    pub params: String,
}

/// SSRC information
#[derive(Debug, Clone)]
pub struct SsrcInfo {
    pub ssrc: u32,
    pub attribute: String,
    pub value: String,
}

/// ICE parameters
#[derive(Debug, Clone)]
pub struct IceParameters {
    pub ufrag: String,
    pub pwd: String,
    pub lite: bool,
    pub options: Option<String>,
}

/// DTLS fingerprint
#[derive(Debug, Clone)]
pub struct DtlsFingerprint {
    pub algorithm: String,
    pub hash: String,
}

impl SessionDescription {
    /// Create a new SDP offer
    pub fn create_offer(
        session_id: impl Into<String>,
        transceivers: &[TransceiverConfig],
        capabilities: &ClientCapabilities,
    ) -> Self {
        let _session_id = session_id.into();
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let mut media_sections = Vec::new();
        let mut bundle_groups = Vec::new();
        
        for (idx, transceiver) in transceivers.iter().enumerate() {
            let mid = format!("{}", idx);
            bundle_groups.push(mid.clone());
            
            let media_section = create_media_section(
                transceiver,
                capabilities,
                &mid,
            );
            media_sections.push(media_section);
        }
        
        // Generate random ICE credentials
        let ice_ufrag = generate_ice_credential(4);
        let ice_pwd = generate_ice_credential(22);
        
        Self {
            sdp_type: SdpType::Offer,
            version: "0".to_string(),
            origin: Origin {
                username: "-".to_string(),
                sess_id: now.to_string(),
                sess_version: now.to_string(),
                nettype: "IN".to_string(),
                addrtype: "IP4".to_string(),
                unicast_address: "127.0.0.1".to_string(),
            },
            session_name: "-".to_string(),
            connection: Some(ConnectionInfo {
                nettype: "IN".to_string(),
                addrtype: "IP4".to_string(),
                address: "0.0.0.0".to_string(),
            }),
            timing: "0 0".to_string(),
            media_sections,
            bundle_groups,
            ice_params: Some(IceParameters {
                ufrag: ice_ufrag,
                pwd: ice_pwd,
                lite: false,
                options: Some("trickle".to_string()),
            }),
            dtls_fingerprint: Some(DtlsFingerprint {
                algorithm: "sha-256".to_string(),
                hash: generate_dummy_fingerprint(),
            }),
            attributes: HashMap::new(),
        }
    }
    
    /// Create an SDP answer from a remote offer
    pub fn create_answer(
        remote_offer: &SessionDescription,
        transceivers: &[TransceiverConfig],
        capabilities: &ClientCapabilities,
    ) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let mut media_sections = Vec::new();
        
        // Match remote offer media sections
        for (idx, remote_media) in remote_offer.media_sections.iter().enumerate() {
            let transceiver = transceivers.get(idx);
            let media_section = create_answer_media_section(
                remote_media,
                transceiver,
                capabilities,
                &format!("{}", idx),
            );
            media_sections.push(media_section);
        }
        
        // Generate ICE credentials
        let ice_ufrag = generate_ice_credential(4);
        let ice_pwd = generate_ice_credential(22);
        
        Self {
            sdp_type: SdpType::Answer,
            version: "0".to_string(),
            origin: Origin {
                username: "-".to_string(),
                sess_id: now.to_string(),
                sess_version: now.to_string(),
                nettype: "IN".to_string(),
                addrtype: "IP4".to_string(),
                unicast_address: "127.0.0.1".to_string(),
            },
            session_name: "-".to_string(),
            connection: Some(ConnectionInfo {
                nettype: "IN".to_string(),
                addrtype: "IP4".to_string(),
                address: "0.0.0.0".to_string(),
            }),
            timing: "0 0".to_string(),
            media_sections,
            bundle_groups: remote_offer.bundle_groups.clone(),
            ice_params: Some(IceParameters {
                ufrag: ice_ufrag,
                pwd: ice_pwd,
                lite: false,
                options: Some("trickle".to_string()),
            }),
            dtls_fingerprint: Some(DtlsFingerprint {
                algorithm: "sha-256".to_string(),
                hash: generate_dummy_fingerprint(),
            }),
            attributes: HashMap::new(),
        }
    }
    
    /// Serialize to SDP string format
    pub fn to_sdp_string(&self) -> String {
        let mut lines = Vec::new();
        
        // Session description
        lines.push(format!("v={}", self.version));
        lines.push(format!(
            "o={} {} {} {} {} {}",
            self.origin.username,
            self.origin.sess_id,
            self.origin.sess_version,
            self.origin.nettype,
            self.origin.addrtype,
            self.origin.unicast_address
        ));
        lines.push(format!("s={}", self.session_name));
        
        // Connection info
        if let Some(conn) = &self.connection {
            lines.push(format!(
                "c={} {} {}",
                conn.nettype, conn.addrtype, conn.address
            ));
        }
        
        lines.push(format!("t={}", self.timing));
        
        // Bundle group
        if !self.bundle_groups.is_empty() {
            lines.push(format!(
                "a=group:BUNDLE {}",
                self.bundle_groups.join(" ")
            ));
        }
        
        // Session-level ICE params
        if let Some(ice) = &self.ice_params {
            lines.push(format!("a=ice-ufrag:{}", ice.ufrag));
            lines.push(format!("a=ice-pwd:{}", ice.pwd));
            if ice.lite {
                lines.push("a=ice-lite".to_string());
            }
            if let Some(opts) = &ice.options {
                lines.push(format!("a=ice-options:{}", opts));
            }
        }
        
        // DTLS fingerprint
        if let Some(fp) = &self.dtls_fingerprint {
            lines.push(format!(
                "a=fingerprint:{} {}",
                fp.algorithm, fp.hash
            ));
            lines.push("a=setup:actpass".to_string());
        }
        
        // Media sections
        for media in &self.media_sections {
            lines.push(media.to_sdp_string());
        }
        
        lines.join("\r\n")
    }
    
    /// Parse an SDP string (STUB_APPROVED - basic implementation)
    pub fn parse_sdp(sdp: &str, sdp_type: SdpType) -> StreamingResult<Self> {
        // STUB_APPROVED: Full SDP parser not yet implemented
        // For now, return a placeholder that indicates parsing is needed
        tracing::warn!("SDP parsing is STUB_APPROVED - full implementation pending");
        
        // Basic validation
        if !sdp.starts_with("v=") {
            return Err(StreamingError::WebRtc(
                "Invalid SDP: must start with v=".to_string()
            ));
        }
        
        // Return a minimal parsed structure
        Ok(Self {
            sdp_type,
            version: "0".to_string(),
            origin: Origin {
                username: "-".to_string(),
                sess_id: "0".to_string(),
                sess_version: "0".to_string(),
                nettype: "IN".to_string(),
                addrtype: "IP4".to_string(),
                unicast_address: "127.0.0.1".to_string(),
            },
            session_name: "-".to_string(),
            connection: None,
            timing: "0 0".to_string(),
            media_sections: Vec::new(),
            bundle_groups: Vec::new(),
            ice_params: None,
            dtls_fingerprint: None,
            attributes: HashMap::new(),
        })
    }
}

impl MediaSection {
    /// Convert media section to SDP string
    pub fn to_sdp_string(&self) -> String {
        let mut lines = Vec::new();
        
        // Media line: m=<kind> <port> <protocol> <formats>
        let formats = if self.formats.is_empty() {
            "0".to_string()
        } else {
            self.formats.join(" ")
        };
        
        let kind_str = match self.kind {
            MediaKind::Audio => "audio",
            MediaKind::Video => "video",
            MediaKind::Data => "application",
        };
        
        lines.push(format!(
            "m={} {} {} {}",
            kind_str, self.port, self.protocol, formats
        ));
        
        // Connection info if present
        if let Some(conn) = &self.connection {
            lines.push(format!(
                "c={} {} {}",
                conn.nettype, conn.addrtype, conn.address
            ));
        }
        
        // Direction
        let dir_str = match self.direction {
            Direction::SendRecv => "sendrecv",
            Direction::SendOnly => "sendonly",
            Direction::RecvOnly => "recvonly",
            Direction::Inactive => "inactive",
        };
        lines.push(format!("a={}", dir_str));
        
        // RTCP mux
        if self.rtcp_mux {
            lines.push("a=rtcp-mux".to_string());
        }
        
        // RTP maps
        for rtpmap in &self.rtpmaps {
            let mut line = format!(
                "a=rtpmap:{} {}/{}",
                rtpmap.payload_type, rtpmap.encoding_name, rtpmap.clock_rate
            );
            if let Some(params) = &rtpmap.encoding_params {
                line.push('/');
                line.push_str(params);
            }
            lines.push(line);
        }
        
        // FMTP
        for fmtp in &self.fmtps {
            lines.push(format!(
                "a=fmtp:{} {}",
                fmtp.payload_type, fmtp.params
            ));
        }
        
        // SSRCs
        for ssrc in &self.ssrcs {
            lines.push(format!(
                "a=ssrc:{} {}:{}",
                ssrc.ssrc, ssrc.attribute, ssrc.value
            ));
        }
        
        // Stream IDs (MSID)
        for stream_id in &self.stream_ids {
            lines.push(format!("a=msid:{} {}", stream_id, stream_id));
        }
        
        // Media-level ICE params
        if let Some(ice) = &self.ice_params {
            lines.push(format!("a=ice-ufrag:{}", ice.ufrag));
            lines.push(format!("a=ice-pwd:{}", ice.pwd));
        }
        
        // Media-level DTLS fingerprint
        if let Some(fp) = &self.dtls_fingerprint {
            lines.push(format!(
                "a=fingerprint:{} {}",
                fp.algorithm, fp.hash
            ));
        }
        
        lines.join("\r\n")
    }
}

/// Create a media section from transceiver config
fn create_media_section(
    transceiver: &TransceiverConfig,
    capabilities: &ClientCapabilities,
    mid: &str,
) -> MediaSection {
    let (formats, rtpmaps) = match transceiver.kind {
        MediaKind::Audio => create_audio_formats(capabilities),
        MediaKind::Video => create_video_formats(capabilities),
        MediaKind::Data => {
            (vec!["webrtc-datachannel".to_string()], Vec::new())
        }
    };
    
    MediaSection {
        kind: transceiver.kind,
        port: 9, // Discard port per RFC
        protocol: if transceiver.kind == MediaKind::Data {
            "UDP/DTLS/SCTP".to_string()
        } else {
            "UDP/TLS/RTP/SAVPF".to_string()
        },
        formats,
        connection: None,
        ice_params: None,
        dtls_fingerprint: None,
        direction: transceiver.direction,
        rtpmaps,
        fmtps: Vec::new(),
        ssrcs: Vec::new(),
        stream_ids: transceiver.stream_ids.clone(),
        rtcp_mux: true,
        attributes: {
            let mut attrs = HashMap::new();
            attrs.insert("mid".to_string(), mid.to_string());
            attrs
        },
    }
}

/// Create answer media section based on remote offer
fn create_answer_media_section(
    remote_media: &MediaSection,
    transceiver: Option<&TransceiverConfig>,
    _capabilities: &ClientCapabilities,
    mid: &str,
) -> MediaSection {
    let mut direction = Direction::Inactive;
    
    if let Some(tx) = transceiver {
        // Negotiate direction
        direction = negotiate_direction(remote_media.direction, tx.direction);
    }
    
    MediaSection {
        kind: remote_media.kind,
        port: 9,
        protocol: remote_media.protocol.clone(),
        formats: remote_media.formats.clone(),
        connection: None,
        ice_params: None,
        dtls_fingerprint: None,
        direction,
        rtpmaps: remote_media.rtpmaps.clone(),
        fmtps: remote_media.fmtps.clone(),
        ssrcs: Vec::new(),
        stream_ids: transceiver.map(|t| t.stream_ids.clone()).unwrap_or_default(),
        rtcp_mux: remote_media.rtcp_mux,
        attributes: {
            let mut attrs = HashMap::new();
            attrs.insert("mid".to_string(), mid.to_string());
            attrs
        },
    }
}

/// Negotiate media direction
fn negotiate_direction(remote: Direction, local: Direction) -> Direction {
    // Direction matrix:
    // Remote wants to send (sendrecv/sendonly), local wants to recv (sendrecv/recvonly) = sendrecv
    // Remote wants to send, local doesn't want to recv = recvonly (for remote)
    // Remote wants to recv, local wants to send = sendrecv
    // etc.
    use Direction::*;
    
    match (remote, local) {
        (SendRecv, SendRecv) => SendRecv,
        (SendRecv, SendOnly) => SendOnly,
        (SendRecv, RecvOnly) => RecvOnly,
        (SendRecv, Inactive) => Inactive,
        (SendOnly, SendRecv) => RecvOnly,
        (SendOnly, RecvOnly) => RecvOnly,
        (SendOnly, SendOnly) => Inactive,
        (SendOnly, Inactive) => Inactive,
        (RecvOnly, SendRecv) => SendOnly,
        (RecvOnly, SendOnly) => SendOnly,
        (RecvOnly, RecvOnly) => Inactive,
        (RecvOnly, Inactive) => Inactive,
        (Inactive, _) => Inactive,
    }
}

/// Create audio format descriptions
fn create_audio_formats(_capabilities: &ClientCapabilities) -> (Vec<String>, Vec<RtpMap>) {
    let formats = vec!["111".to_string(), "0".to_string()];
    let rtpmaps = vec![
        RtpMap {
            payload_type: 111,
            encoding_name: "opus".to_string(),
            clock_rate: 48000,
            encoding_params: Some("2".to_string()),
        },
        RtpMap {
            payload_type: 0,
            encoding_name: "PCMU".to_string(),
            clock_rate: 8000,
            encoding_params: None,
        },
    ];
    (formats, rtpmaps)
}

/// Create video format descriptions
fn create_video_formats(_capabilities: &ClientCapabilities) -> (Vec<String>, Vec<RtpMap>) {
    let formats = vec!["96".to_string(), "97".to_string()];
    let rtpmaps = vec![
        RtpMap {
            payload_type: 96,
            encoding_name: "VP8".to_string(),
            clock_rate: 90000,
            encoding_params: None,
        },
        RtpMap {
            payload_type: 97,
            encoding_name: "VP9".to_string(),
            clock_rate: 90000,
            encoding_params: None,
        },
    ];
    (formats, rtpmaps)
}

/// Generate ICE credential (random string)
fn generate_ice_credential(len: usize) -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    
    (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Generate a dummy DTLS fingerprint (STB_APPROVED - proper cert generation needed)
fn generate_dummy_fingerprint() -> String {
    // STUB_APPROVED: Real fingerprint should come from actual DTLS certificate
    "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_create_offer() {
        let capabilities = ClientCapabilities::default_webrtc();
        let transceivers = vec![
            TransceiverConfig {
                id: "audio_0".to_string(),
                kind: MediaKind::Audio,
                direction: Direction::SendRecv,
                stream_ids: vec!["stream_1".to_string()],
                preferred_codecs: vec!["opus".to_string()],
            },
        ];
        
        let offer = SessionDescription::create_offer("test_session", &transceivers, &capabilities);
        
        assert_eq!(offer.sdp_type, SdpType::Offer);
        assert_eq!(offer.media_sections.len(), 1);
        assert!(!offer.bundle_groups.is_empty());
        assert!(offer.ice_params.is_some());
        assert!(offer.dtls_fingerprint.is_some());
    }
    
    #[test]
    fn test_sdp_serialization() {
        let capabilities = ClientCapabilities::default_webrtc();
        let transceivers = vec![
            TransceiverConfig {
                id: "audio_0".to_string(),
                kind: MediaKind::Audio,
                direction: Direction::SendRecv,
                stream_ids: vec!["stream_1".to_string()],
                preferred_codecs: vec!["opus".to_string()],
            },
        ];
        
        let offer = SessionDescription::create_offer("test_session", &transceivers, &capabilities);
        let sdp_string = offer.to_sdp_string();
        
        assert!(sdp_string.starts_with("v=0"));
        assert!(sdp_string.contains("m=audio"));
        assert!(sdp_string.contains("a=sendrecv"));
        assert!(sdp_string.contains("a=rtpmap:111 opus/48000/2"));
        assert!(sdp_string.contains("a=group:BUNDLE"));
    }
    
    #[test]
    fn test_negotiate_direction() {
        use Direction::*;
        
        assert_eq!(negotiate_direction(SendRecv, SendRecv), SendRecv);
        assert_eq!(negotiate_direction(SendRecv, RecvOnly), RecvOnly);
        assert_eq!(negotiate_direction(SendOnly, RecvOnly), RecvOnly);
        assert_eq!(negotiate_direction(SendOnly, SendOnly), Inactive);
        assert_eq!(negotiate_direction(Inactive, SendRecv), Inactive);
    }
    
    #[test]
    fn test_parse_sdp_basic() {
        let sdp = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0";
        let result = SessionDescription::parse_sdp(sdp, SdpType::Answer);
        
        assert!(result.is_ok());
        let parsed = result.unwrap();
        assert_eq!(parsed.sdp_type, SdpType::Answer);
    }
    
    #[test]
    fn test_parse_sdp_invalid() {
        let sdp = "invalid sdp";
        let result = SessionDescription::parse_sdp(sdp, SdpType::Offer);
        
        assert!(result.is_err());
    }
}
