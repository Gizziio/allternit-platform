//! SRTP (Secure Real-time Transport Protocol) Implementation
//!
//! WIH: GAP-42, Owner: T2-A4
//! Dependencies: GAP-42 (DTLS Key Extraction)
//! Coordinates with: T2-A1 (AudioChannel for encrypted audio)
//!
//! This module implements SRTP and SRTCP encryption/decryption
//! as defined in RFC 3711 (SRTP) with RFC 5764 (DTLS-SRTP keying).
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for encryption/decryption pending crypto module
//! - All crypto operations marked with SECURITY annotations

use crate::types::{StreamingError, StreamingResult};
use crate::transport::dtls::{DtlsRole, SrtpKeyMaterial, SrtpProtectionProfile};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, trace, warn};

/// SRTP version
pub const SRTP_VERSION: &str = "0.1.0";

/// Default SRTP replay window size
pub const DEFAULT_REPLAY_WINDOW_SIZE: usize = 64;

/// Maximum SRTP packet size
pub const MAX_SRTP_PACKET_SIZE: usize = 1500;

/// SRTP master key length (128-bit)
pub const SRTP_MASTER_KEY_LEN: usize = 16;

/// SRTP master salt length (112-bit)
pub const SRTP_MASTER_SALT_LEN: usize = 14;

/// SRTP authentication tag length (80-bit profile)
pub const SRTP_AUTH_TAG_LEN_80: usize = 10;

/// SRTP authentication tag length (32-bit profile)
pub const SRTP_AUTH_TAG_LEN_32: usize = 4;

/// SRTP configuration
#[derive(Debug, Clone)]
pub struct SrtpConfig {
    /// SRTP protection profile
    pub profile: Option<SrtpProtectionProfile>,
    /// Replay window size for anti-replay protection
    pub replay_window_size: usize,
    /// Enable authentication
    pub enable_auth: bool,
    /// Enable encryption
    pub enable_encryption: bool,
    /// Maximum number of ROC (rollover counter) entries
    pub max_roc_entries: usize,
}

impl Default for SrtpConfig {
    fn default() -> Self {
        Self {
            profile: Some(SrtpProtectionProfile::Aes128CmHmacSha1_80),
            replay_window_size: DEFAULT_REPLAY_WINDOW_SIZE,
            enable_auth: true,
            enable_encryption: true,
            max_roc_entries: 1024,
        }
    }
}

/// SRTP cryptographic context for a single SSRC
#[derive(Debug)]
pub struct SrtpCryptoContext {
    /// SSRC this context is for
    pub ssrc: u32,
    /// Rolling sequence number counter
    pub roc: u32,
    /// Highest sequence number received
    pub last_sequence: u16,
    /// Master key
    pub master_key: Vec<u8>,
    /// Master salt
    pub master_salt: Vec<u8>,
    /// Session encryption key (derived from master)
    pub session_enc_key: Vec<u8>,
    /// Session authentication key (derived from master)
    pub session_auth_key: Vec<u8>,
    /// Session salt (derived from master)
    pub session_salt: Vec<u8>,
    /// Replay window (bitmask of received sequence numbers)
    pub replay_window: u64,
    /// Packet count (for stats)
    pub packet_count: u64,
}

impl SrtpCryptoContext {
    /// Create a new crypto context
    ///
    /// SECURITY: Uses STUB_APPROVED for key derivation pending crypto module
    pub fn new(
        ssrc: u32,
        master_key: Vec<u8>,
        master_salt: Vec<u8>,
        profile: SrtpProtectionProfile,
    ) -> StreamingResult<Self> {
        // STUB_APPROVED: Full key derivation using PRF pending crypto module
        // Derive session keys from master key and salt
        let session_enc_key = master_key.clone(); // STUB
        let session_auth_key = vec![0u8; 20]; // STUB: 160-bit auth key
        let session_salt = master_salt.clone(); // STUB

        debug!("SRTP Context {}: Created with profile {:?}", ssrc, profile);

        Ok(Self {
            ssrc,
            roc: 0,
            last_sequence: 0,
            master_key,
            master_salt,
            session_enc_key,
            session_auth_key,
            session_salt,
            replay_window: 0,
            packet_count: 0,
        })
    }

    /// Update ROC if sequence number wrapped
    fn update_roc(&mut self, sequence: u16) {
        // RFC 3711: ROC is incremented when sequence number wraps
        if sequence < self.last_sequence && self.last_sequence.wrapping_sub(sequence) > 0x8000 {
            self.roc = self.roc.wrapping_add(1);
            info!("SRTP Context {}: ROC incremented to {}", self.ssrc, self.roc);
        }
        self.last_sequence = sequence;
    }

    /// Check if packet is a replay
    fn is_replay(&self, sequence: u16) -> bool {
        let index = self.get_packet_index(sequence);
        let diff = self.get_packet_index(self.last_sequence).wrapping_sub(index);
        
        if diff > DEFAULT_REPLAY_WINDOW_SIZE as u64 {
            // Too old, definitely a replay or very delayed
            return true;
        }

        // Check replay window bit
        let bit_pos = (index & 0x3F) as u32; // Mod 64
        (self.replay_window >> bit_pos) & 1 == 1
    }

    /// Update replay window
    fn update_replay_window(&mut self, sequence: u16) {
        let index = self.get_packet_index(sequence);
        let bit_pos = (index & 0x3F) as u32; // Mod 64
        self.replay_window |= 1u64 << bit_pos;
    }

    /// Get packet index (48-bit ROC + sequence)
    fn get_packet_index(&self, sequence: u16) -> u64 {
        ((self.roc as u64) << 16) | (sequence as u64)
    }
}

/// SRTP context for media encryption/decryption
///
/// WIH: GAP-42, Owner: T2-A4
pub struct SrtpContext {
    /// Context ID
    context_id: String,
    /// Configuration
    config: SrtpConfig,
    /// Local role (determines key usage)
    role: DtlsRole,
    /// Transmit contexts by SSRC
    tx_contexts: Arc<RwLock<HashMap<u32, SrtpCryptoContext>>>,
    /// Receive contexts by SSRC
    rx_contexts: Arc<RwLock<HashMap<u32, SrtpCryptoContext>>>,
    /// Key material from DTLS
    key_material: SrtpKeyMaterial,
    /// Local SSRCs we use for sending
    local_ssrcs: Arc<RwLock<Vec<u32>>>,
    /// Remote SSRCs we receive from
    remote_ssrcs: Arc<RwLock<Vec<u32>>>,
}

impl std::fmt::Debug for SrtpContext {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SrtpContext")
            .field("context_id", &self.context_id)
            .field("role", &self.role)
            .field("profile", &self.key_material.profile)
            .finish()
    }
}

impl SrtpContext {
    /// Create a new SRTP context from DTLS key material
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub fn new(
        context_id: impl Into<String>,
        config: SrtpConfig,
        key_material: SrtpKeyMaterial,
    ) -> StreamingResult<Self> {
        let context_id = context_id.into();
        
        info!("SRTP Context {}: Created with profile {:?}",
            context_id, key_material.profile);

        Ok(Self {
            context_id,
            config,
            role: DtlsRole::Client, // Will be set during initialization
            tx_contexts: Arc::new(RwLock::new(HashMap::new())),
            rx_contexts: Arc::new(RwLock::new(HashMap::new())),
            key_material,
            local_ssrcs: Arc::new(RwLock::new(vec![])),
            remote_ssrcs: Arc::new(RwLock::new(vec![])),
        })
    }

    /// Initialize SRTP contexts with local role
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn initialize(&mut self, role: DtlsRole) -> StreamingResult<()> {
        self.role = role;
        
        // Get keys based on role
        let (local_key, local_salt) = self.key_material.local_keys(role);
        let (remote_key, remote_salt) = self.key_material.remote_keys(role);

        info!("SRTP Context {}: Initialized for role {:?}", 
            self.context_id, role);

        // Create default contexts
        let default_ssrc = 0;
        let tx_ctx = SrtpCryptoContext::new(
            default_ssrc,
            local_key,
            local_salt,
            self.key_material.profile,
        )?;

        let rx_ctx = SrtpCryptoContext::new(
            default_ssrc,
            remote_key,
            remote_salt,
            self.key_material.profile,
        )?;

        let mut tx_contexts = self.tx_contexts.write().await;
        tx_contexts.insert(default_ssrc, tx_ctx);
        drop(tx_contexts);

        let mut rx_contexts = self.rx_contexts.write().await;
        rx_contexts.insert(default_ssrc, rx_ctx);
        drop(rx_contexts);

        Ok(())
    }

    /// Add a local SSRC for transmission
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn add_local_ssrc(&self, ssrc: u32) -> StreamingResult<()> {
        info!("SRTP Context {}: Adding local SSRC {}", self.context_id, ssrc);

        let (local_key, local_salt) = self.key_material.local_keys(self.role);

        let ctx = SrtpCryptoContext::new(
            ssrc,
            local_key,
            local_salt,
            self.key_material.profile,
        )?;

        let mut tx_contexts = self.tx_contexts.write().await;
        tx_contexts.insert(ssrc, ctx);
        drop(tx_contexts);

        let mut local_ssrcs = self.local_ssrcs.write().await;
        if !local_ssrcs.contains(&ssrc) {
            local_ssrcs.push(ssrc);
        }

        Ok(())
    }

    /// Add a remote SSRC for reception
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn add_remote_ssrc(&self, ssrc: u32) -> StreamingResult<()> {
        info!("SRTP Context {}: Adding remote SSRC {}", self.context_id, ssrc);

        let (remote_key, remote_salt) = self.key_material.remote_keys(self.role);

        let ctx = SrtpCryptoContext::new(
            ssrc,
            remote_key,
            remote_salt,
            self.key_material.profile,
        )?;

        let mut rx_contexts = self.rx_contexts.write().await;
        rx_contexts.insert(ssrc, ctx);
        drop(rx_contexts);

        let mut remote_ssrcs = self.remote_ssrcs.write().await;
        if !remote_ssrcs.contains(&ssrc) {
            remote_ssrcs.push(ssrc);
        }

        Ok(())
    }

    /// Encrypt an RTP packet
    ///
    /// Used by T2-A1 (AudioChannel) for encrypted audio transmission.
    ///
    /// SECURITY: Uses STUB_APPROVED for encryption pending crypto module.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn encrypt_rtp(&self, packet: &[u8]) -> StreamingResult<Vec<u8>> {
        if packet.len() < 12 {
            return Err(StreamingError::WebRtc(
                "RTP packet too short".to_string()
            ));
        }

        // Parse RTP header
        let ssrc = u32::from_be_bytes([packet[8], packet[9], packet[10], packet[11]]);
        let sequence = u16::from_be_bytes([packet[2], packet[3]]);

        trace!("SRTP Context {}: Encrypting RTP packet SSRC={} seq={}",
            self.context_id, ssrc, sequence);

        // Get or create crypto context
        let mut tx_contexts = self.tx_contexts.write().await;
        let ctx = if let Some(ctx) = tx_contexts.get_mut(&ssrc) {
            Some(ctx)
        } else {
            tx_contexts.get_mut(&0)
        }.ok_or_else(|| StreamingError::WebRtc(
            "No crypto context for SSRC".to_string()
        ))?;

        ctx.update_roc(sequence);
        ctx.packet_count += 1;

        // STUB_APPROVED: Actual SRTP encryption pending crypto module
        // Encrypt payload portion of RTP packet
        let auth_tag_len = match self.key_material.profile {
            SrtpProtectionProfile::Aes128CmHmacSha1_32 => SRTP_AUTH_TAG_LEN_32,
            _ => SRTP_AUTH_TAG_LEN_80,
        };

        // Create SRTP packet: RTP header + encrypted payload + auth tag
        let mut srtp_packet = packet.to_vec();

        if self.config.enable_encryption {
            // STUB_APPROVED: Encrypt payload pending crypto module
            // @ticket GAP-42 - AES-CM or AES-GCM encryption
            // @fallback Simple XOR for demonstration
            for i in 12..srtp_packet.len() {
                srtp_packet[i] ^= 0xAA; // STUB: Simple XOR for demonstration
            }
        }

        if self.config.enable_auth {
            // STUB_APPROVED: Add authentication tag pending crypto module
            // @ticket GAP-42 - HMAC-SHA1 authentication
            srtp_packet.extend_from_slice(&vec![0u8; auth_tag_len]);
        }

        Ok(srtp_packet)
    }

    /// Decrypt an SRTP packet
    ///
    /// Used by T2-A1 (AudioChannel) for receiving encrypted audio.
    ///
    /// SECURITY: Uses STUB_APPROVED for decryption pending crypto module.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn decrypt_srtp(&self, packet: &[u8]) -> StreamingResult<Vec<u8>> {
        let auth_tag_len = match self.key_material.profile {
            SrtpProtectionProfile::Aes128CmHmacSha1_32 => SRTP_AUTH_TAG_LEN_32,
            _ => SRTP_AUTH_TAG_LEN_80,
        };

        if packet.len() < 12 + auth_tag_len {
            return Err(StreamingError::WebRtc(
                "SRTP packet too short".to_string()
            ));
        }

        // Parse RTP header
        let ssrc = u32::from_be_bytes([packet[8], packet[9], packet[10], packet[11]]);
        let sequence = u16::from_be_bytes([packet[2], packet[3]]);

        trace!("SRTP Context {}: Decrypting SRTP packet SSRC={} seq={}",
            self.context_id, ssrc, sequence);

        // Get or create crypto context
        let mut rx_contexts = self.rx_contexts.write().await;
        let ctx = if let Some(ctx) = rx_contexts.get_mut(&ssrc) {
            Some(ctx)
        } else {
            rx_contexts.get_mut(&0)
        }.ok_or_else(|| StreamingError::WebRtc(
            "No crypto context for SSRC".to_string()
        ))?;

        // Check for replay
        if ctx.is_replay(sequence) {
            warn!("SRTP Context {}: Replay detected for SSRC={} seq={}",
                self.context_id, ssrc, sequence);
            return Err(StreamingError::WebRtc(
                "Replay detected".to_string()
            ));
        }

        ctx.update_roc(sequence);
        ctx.update_replay_window(sequence);
        ctx.packet_count += 1;

        // STUB_APPROVED: Actual SRTP decryption pending crypto module
        let payload_end = packet.len() - if self.config.enable_auth { auth_tag_len } else { 0 };
        let mut rtp_packet = packet[..payload_end].to_vec();
        
        if self.config.enable_encryption {
            // STUB: Decrypt payload (skip 12-byte RTP header)
            for i in 12..rtp_packet.len() {
                rtp_packet[i] ^= 0xAA; // STUB: Reverse XOR
            }
        }

        // STUB_APPROVED: Verify authentication tag pending crypto module
        // @ticket GAP-42 - HMAC-SHA1 verification
        if self.config.enable_auth {
            let _auth_tag = &packet[payload_end..];
        }

        Ok(rtp_packet)
    }

    /// Encrypt an RTCP packet (SRTCP)
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn encrypt_rtcp(&self, packet: &[u8]) -> StreamingResult<Vec<u8>> {
        if packet.len() < 8 {
            return Err(StreamingError::WebRtc(
                "RTCP packet too short".to_string()
            ));
        }

        // Parse RTCP header
        let ssrc = u32::from_be_bytes([packet[4], packet[5], packet[6], packet[7]]);

        trace!("SRTP Context {}: Encrypting RTCP packet SSRC={}",
            self.context_id, ssrc);

        // Get crypto context
        let tx_contexts = self.tx_contexts.read().await;
        let _ctx = tx_contexts.get(&ssrc)
            .or_else(|| tx_contexts.get(&0))
            .ok_or_else(|| StreamingError::WebRtc(
                "No crypto context for SSRC".to_string()
            ))?;

        // STUB_APPROVED: Actual SRTCP encryption pending crypto module
        // SRTCP includes MKI and authentication tag in the clear
        let mut srtcp_packet = packet.to_vec();
        
        // Add E-bit and authentication tag
        let auth_tag_len = match self.key_material.profile {
            SrtpProtectionProfile::Aes128CmHmacSha1_32 => SRTP_AUTH_TAG_LEN_32,
            _ => SRTP_AUTH_TAG_LEN_80,
        };

        // Set encryption bit in RTCP header
        if let Some(first_byte) = srtcp_packet.first_mut() {
            *first_byte |= 0x80; // Set E-bit
        }

        // Add index and auth tag
        srtcp_packet.extend_from_slice(&0u32.to_be_bytes()); // Index
        srtcp_packet.extend_from_slice(&vec![0u8; auth_tag_len]);

        Ok(srtcp_packet)
    }

    /// Decrypt an SRTCP packet
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn decrypt_srtcp(&self, packet: &[u8]) -> StreamingResult<Vec<u8>> {
        if packet.len() < 12 {
            return Err(StreamingError::WebRtc(
                "SRTCP packet too short".to_string()
            ));
        }

        // Check E-bit
        let encrypted = (packet[0] & 0x80) != 0;

        // Parse RTCP header
        let ssrc = u32::from_be_bytes([packet[4], packet[5], packet[6], packet[7]]);

        trace!("SRTP Context {}: Decrypting SRTCP packet SSRC={} encrypted={}",
            self.context_id, ssrc, encrypted);

        // Get crypto context
        let rx_contexts = self.rx_contexts.read().await;
        let _ctx = rx_contexts.get(&ssrc)
            .or_else(|| rx_contexts.get(&0))
            .ok_or_else(|| StreamingError::WebRtc(
                "No crypto context for SSRC".to_string()
            ))?;

        // STUB_APPROVED: Actual SRTCP decryption pending crypto module
        let auth_tag_len = match self.key_material.profile {
            SrtpProtectionProfile::Aes128CmHmacSha1_32 => SRTP_AUTH_TAG_LEN_32,
            _ => SRTP_AUTH_TAG_LEN_80,
        };

        // Remove index and auth tag
        let rtcp_end = packet.len() - 4 - auth_tag_len;
        let mut rtcp_packet = packet[..rtcp_end].to_vec();

        // Clear E-bit
        if let Some(first_byte) = rtcp_packet.first_mut() {
            *first_byte &= 0x7F;
        }

        Ok(rtcp_packet)
    }

    /// Get statistics
    pub async fn stats(&self) -> SrtpStats {
        let tx_contexts = self.tx_contexts.read().await;
        let rx_contexts = self.rx_contexts.read().await;

        SrtpStats {
            context_id: self.context_id.clone(),
            tx_contexts: tx_contexts.len(),
            rx_contexts: rx_contexts.len(),
            tx_packets: tx_contexts.values().map(|c| c.packet_count).sum(),
            rx_packets: rx_contexts.values().map(|c| c.packet_count).sum(),
            profile: self.key_material.profile,
        }
    }
}

/// SRTP statistics
#[derive(Debug, Clone)]
pub struct SrtpStats {
    pub context_id: String,
    pub tx_contexts: usize,
    pub rx_contexts: usize,
    pub tx_packets: u64,
    pub rx_packets: u64,
    pub profile: SrtpProtectionProfile,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_key_material() -> SrtpKeyMaterial {
        SrtpKeyMaterial::from_raw(
            vec![0xAAu8; 16],
            vec![0xBBu8; 14],
            vec![0xCCu8; 16],
            vec![0xDDu8; 14],
            SrtpProtectionProfile::Aes128CmHmacSha1_80,
        )
    }

    fn create_test_rtp_packet(ssrc: u32, sequence: u16) -> Vec<u8> {
        let mut packet = vec![0u8; 20];
        packet[0] = 0x80; // V=2, P=0, X=0, CC=0
        packet[1] = 0x00; // M=0, PT=0
        packet[2..4].copy_from_slice(&sequence.to_be_bytes());
        packet[4..8].copy_from_slice(&0u32.to_be_bytes()); // Timestamp
        packet[8..12].copy_from_slice(&ssrc.to_be_bytes());
        // Payload
        packet[12..20].copy_from_slice(&[1, 2, 3, 4, 5, 6, 7, 8]);
        packet
    }

    #[test]
    fn test_srtp_config_default() {
        let config = SrtpConfig::default();
        assert!(config.enable_encryption);
        assert!(config.enable_auth);
        assert_eq!(config.replay_window_size, DEFAULT_REPLAY_WINDOW_SIZE);
    }

    #[test]
    fn test_crypto_context_creation() {
        let key_material = create_test_key_material();
        let (client_key, client_salt) = key_material.local_keys(DtlsRole::Client);
        
        let ctx = SrtpCryptoContext::new(
            12345, client_key, client_salt, 
            SrtpProtectionProfile::Aes128CmHmacSha1_80
        ).unwrap();

        assert_eq!(ctx.ssrc, 12345);
        assert_eq!(ctx.master_key.len(), 16);
        assert_eq!(ctx.master_salt.len(), 14);
    }

    #[tokio::test]
    async fn test_srtp_context_creation() {
        let key_material = create_test_key_material();
        let config = SrtpConfig::default();
        
        let mut ctx = SrtpContext::new("test_srtp", config, key_material).unwrap();
        ctx.initialize(DtlsRole::Client).await.unwrap();

        let stats = ctx.stats().await;
        assert_eq!(stats.context_id, "test_srtp");
        assert_eq!(stats.tx_contexts, 1);
        assert_eq!(stats.rx_contexts, 1);
    }

    #[tokio::test]
    async fn test_ssrc_management() {
        let key_material = create_test_key_material();
        let config = SrtpConfig::default();
        
        let mut ctx = SrtpContext::new("test_srtp", config, key_material).unwrap();
        ctx.initialize(DtlsRole::Client).await.unwrap();

        ctx.add_local_ssrc(11111).await.unwrap();
        ctx.add_remote_ssrc(22222).await.unwrap();

        let stats = ctx.stats().await;
        assert_eq!(stats.tx_contexts, 2); // default + added
        assert_eq!(stats.rx_contexts, 2);
    }

    #[tokio::test]
    async fn test_rtp_encryption_decryption() {
        let key_material = create_test_key_material();
        let config = SrtpConfig::default();
        
        let mut ctx = SrtpContext::new("test_srtp", config, key_material).unwrap();
        ctx.initialize(DtlsRole::Client).await.unwrap();

        ctx.add_local_ssrc(12345).await.unwrap();
        ctx.add_remote_ssrc(12345).await.unwrap();

        let rtp_packet = create_test_rtp_packet(12345, 1000);
        let original_payload = rtp_packet[12..].to_vec();

        // Encrypt
        let srtp_packet = ctx.encrypt_rtp(&rtp_packet).await.unwrap();
        
        // SRTP packet should be larger due to auth tag
        assert!(srtp_packet.len() > rtp_packet.len());

        // Decrypt
        let decrypted = ctx.decrypt_srtp(&srtp_packet).await.unwrap();
        
        // RTP header should be preserved
        assert_eq!(&decrypted[0..12], &rtp_packet[0..12]);
        // Payload should be restored (in stub: XORed twice = original)
        assert_eq!(&decrypted[12..], &original_payload);
    }

    #[tokio::test]
    async fn test_replay_detection() {
        let key_material = create_test_key_material();
        let config = SrtpConfig::default();
        
        let mut ctx = SrtpContext::new("test_srtp", config, key_material).unwrap();
        ctx.initialize(DtlsRole::Client).await.unwrap();
        ctx.add_remote_ssrc(12345).await.unwrap();

        let rtp_packet = create_test_rtp_packet(12345, 1000);
        let srtp_packet = ctx.encrypt_rtp(&rtp_packet).await.unwrap();

        // First decryption should succeed
        ctx.decrypt_srtp(&srtp_packet).await.unwrap();

        // Second decryption of same packet should fail (replay)
        let result = ctx.decrypt_srtp(&srtp_packet).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Replay"));
    }

    #[tokio::test]
    async fn test_roc_update() {
        let key_material = create_test_key_material();
        
        let (client_key, client_salt) = key_material.local_keys(DtlsRole::Client);
        let mut ctx = SrtpCryptoContext::new(
            12345, client_key, client_salt,
            SrtpProtectionProfile::Aes128CmHmacSha1_80
        ).unwrap();

        ctx.last_sequence = 65530;

        // New sequence much lower indicates wrap
        ctx.update_roc(100);
        
        assert_eq!(ctx.roc, 1);
        assert_eq!(ctx.last_sequence, 100);
    }

    #[tokio::test]
    async fn test_rtcp_encryption() {
        let key_material = create_test_key_material();
        let config = SrtpConfig::default();
        
        let mut ctx = SrtpContext::new("test_srtp", config, key_material).unwrap();
        ctx.initialize(DtlsRole::Client).await.unwrap();

        // Create test RTCP packet
        let mut rtcp_packet = vec![0u8; 12];
        rtcp_packet[0] = 0x80; // V=2
        rtcp_packet[1] = 200; // SR packet type
        rtcp_packet[4..8].copy_from_slice(&12345u32.to_be_bytes()); // SSRC

        let srtcp_packet = ctx.encrypt_rtcp(&rtcp_packet).await.unwrap();
        
        // Should have added index and auth tag
        assert!(srtcp_packet.len() > rtcp_packet.len());
        
        // E-bit should be set
        assert_ne!(srtcp_packet[0] & 0x80, 0);
    }
}
