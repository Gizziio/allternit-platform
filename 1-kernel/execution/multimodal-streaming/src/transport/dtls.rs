//! DTLS (Datagram Transport Layer Security) Implementation
//!
//! WIH: GAP-42, Owner: T2-A4
//! Dependencies: GAP-41 (ICE Connectivity)
//! Coordinates with: T2-A5 (Signaling Integration)
//!
//! This module implements DTLS 1.2 handshake and key extraction for SRTP
//! as defined in RFC 6347 (DTLS 1.2) and RFC 5764 (DTLS-SRTP).
//!
//! SYSTEM_LAW COMPLIANCE:
//! - Uses STUB_APPROVED for certificate operations pending crypto module
//! - Uses STUB_APPROVED for handshake completion pending full DTLS stack

use crate::types::{StreamingError, StreamingResult};
use crate::transport::ice::CandidatePair;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{Duration, Instant};
use tracing::{debug, error, info, warn};

/// DTLS version
pub const DTLS_VERSION: &str = "0.1.0";

/// DTLS 1.2 version constant
pub const DTLS_1_2: u16 = 0xFEFF;

/// DTLS handshake timeout
pub const DTLS_HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(10);

/// SRTP keying material length (master key + salt)
pub const SRTP_KEY_LENGTH: usize = 16 + 14; // 128-bit key + 112-bit salt

/// SRTP master key length
pub const SRTP_MASTER_KEY_LENGTH: usize = 16;

/// SRTP master salt length
pub const SRTP_MASTER_SALT_LENGTH: usize = 14;

/// DTLS configuration
#[derive(Debug, Clone)]
pub struct DtlsConfig {
    /// Certificate in PEM format (optional)
    pub certificate_pem: Option<String>,
    /// Private key in PEM format (optional)
    pub private_key_pem: Option<String>,
    /// Cipher suites to use
    pub cipher_suites: Vec<CipherSuite>,
    /// SRTP protection profiles
    pub srtp_profiles: Vec<SrtpProtectionProfile>,
    /// MTU for DTLS records
    pub mtu: u16,
    /// Handshake timeout
    pub handshake_timeout: Duration,
    /// Whether to verify certificates
    pub verify_cert: bool,
}

impl Default for DtlsConfig {
    fn default() -> Self {
        Self {
            certificate_pem: None,
            private_key_pem: None,
            cipher_suites: vec![
                CipherSuite::TlsEcdheEcdsaWithAes128GcmSha256,
                CipherSuite::TlsEcdheRsaWithAes128GcmSha256,
            ],
            srtp_profiles: vec![
                SrtpProtectionProfile::Aes128CmHmacSha1_80,
                SrtpProtectionProfile::Aes128CmHmacSha1_32,
            ],
            mtu: 1200,
            handshake_timeout: DTLS_HANDSHAKE_TIMEOUT,
            verify_cert: false, // STUB: Certificate verification pending crypto module
        }
    }
}

/// DTLS cipher suites
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CipherSuite {
    /// TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
    TlsEcdheEcdsaWithAes128GcmSha256 = 0xC02B,
    /// TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
    TlsEcdheRsaWithAes128GcmSha256 = 0xC02F,
    /// TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
    TlsEcdheEcdsaWithAes256GcmSha384 = 0xC02C,
    /// TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
    TlsEcdheRsaWithAes256GcmSha384 = 0xC030,
}

/// SRTP protection profiles
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SrtpProtectionProfile {
    /// SRTP_AES128_CM_HMAC_SHA1_80
    Aes128CmHmacSha1_80 = 0x0001,
    /// SRTP_AES128_CM_HMAC_SHA1_32
    Aes128CmHmacSha1_32 = 0x0002,
    /// SRTP_AEAD_AES_128_GCM
    AeadAes128Gcm = 0x0007,
    /// SRTP_AEAD_AES_256_GCM
    AeadAes256Gcm = 0x0008,
}

impl SrtpProtectionProfile {
    /// Get the key length for this profile
    pub fn key_length(&self) -> usize {
        match self {
            SrtpProtectionProfile::Aes128CmHmacSha1_80 => 30, // 16 key + 14 salt
            SrtpProtectionProfile::Aes128CmHmacSha1_32 => 30,
            SrtpProtectionProfile::AeadAes128Gcm => 30,
            SrtpProtectionProfile::AeadAes256Gcm => 46, // 32 key + 14 salt
        }
    }

    /// Get the salt length for this profile
    pub fn salt_length(&self) -> usize {
        14
    }

    /// Get the master key length
    pub fn master_key_length(&self) -> usize {
        match self {
            SrtpProtectionProfile::AeadAes256Gcm => 32,
            _ => 16,
        }
    }
}

/// DTLS role (client or server)
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DtlsRole {
    /// Act as DTLS client (initiator)
    Client,
    /// Act as DTLS server (responder)
    Server,
}

impl DtlsRole {
    /// Get the opposite role
    pub fn opposite(&self) -> Self {
        match self {
            DtlsRole::Client => DtlsRole::Server,
            DtlsRole::Server => DtlsRole::Client,
        }
    }
}

/// DTLS connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DtlsState {
    /// New
    New,
    /// Connecting (handshake in progress)
    Connecting,
    /// Connected (handshake complete)
    Connected,
    /// Failed
    Failed,
    /// Closed
    Closed,
}

/// DTLS certificate information
#[derive(Debug, Clone)]
pub struct DtlsCertificate {
    /// Certificate fingerprint (SHA-256)
    pub fingerprint: String,
    /// Certificate fingerprint algorithm
    pub fingerprint_algorithm: String,
    /// Certificate data (DER encoded)
    pub der_data: Vec<u8>,
    /// Subject name
    pub subject: String,
    /// Issuer name
    pub issuer: String,
    /// Not before timestamp
    pub not_before: u64,
    /// Not after timestamp
    pub not_after: u64,
}

impl DtlsCertificate {
    /// Generate a self-signed certificate
    ///
    /// SYSTEM_LAW: Uses STUB_APPROVED for certificate generation
    pub fn generate_self_signed() -> StreamingResult<(Self, Vec<u8>)> {
        // STUB_APPROVED: Full certificate generation pending crypto module
        let fingerprint = "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00".to_string();
        
        let cert = Self {
            fingerprint: fingerprint.clone(),
            fingerprint_algorithm: "sha-256".to_string(),
            der_data: vec![0u8; 1024], // STUB
            subject: "CN=webrtc".to_string(),
            issuer: "CN=webrtc".to_string(),
            not_before: 0,
            not_after: u64::MAX,
        };

        let private_key = vec![0u8; 256]; // STUB

        info!("DTLS: Generated self-signed certificate with fingerprint: {}", 
            fingerprint);
        
        Ok((cert, private_key))
    }

    /// Get fingerprint in SDP format
    pub fn fingerprint_sdp(&self) -> String {
        format!("{} {}", self.fingerprint_algorithm, self.fingerprint)
    }
}

/// SRTP keying material extracted from DTLS
#[derive(Debug, Clone)]
pub struct SrtpKeyMaterial {
    /// Client write master key
    pub client_write_key: Vec<u8>,
    /// Client write master salt
    pub client_write_salt: Vec<u8>,
    /// Server write master key
    pub server_write_key: Vec<u8>,
    /// Server write master salt
    pub server_write_salt: Vec<u8>,
    /// Selected SRTP protection profile
    pub profile: SrtpProtectionProfile,
}

impl SrtpKeyMaterial {
    /// Create SRTP key material from raw bytes
    pub fn from_raw(
        client_key: Vec<u8>,
        client_salt: Vec<u8>,
        server_key: Vec<u8>,
        server_salt: Vec<u8>,
        profile: SrtpProtectionProfile,
    ) -> Self {
        Self {
            client_write_key: client_key,
            client_write_salt: client_salt,
            server_write_key: server_key,
            server_write_salt: server_salt,
            profile,
        }
    }

    /// Get local keys (for sending)
    pub fn local_keys(&self, role: DtlsRole) -> (Vec<u8>, Vec<u8>) {
        match role {
            DtlsRole::Client => (self.client_write_key.clone(), self.client_write_salt.clone()),
            DtlsRole::Server => (self.server_write_key.clone(), self.server_write_salt.clone()),
        }
    }

    /// Get remote keys (for receiving)
    pub fn remote_keys(&self, role: DtlsRole) -> (Vec<u8>, Vec<u8>) {
        match role {
            DtlsRole::Client => (self.server_write_key.clone(), self.server_write_salt.clone()),
            DtlsRole::Server => (self.client_write_key.clone(), self.client_write_salt.clone()),
        }
    }
}

/// DTLS transport for secure communication
///
/// WIH: GAP-42, Owner: T2-A4
#[derive(Clone)]
pub struct DtlsTransport {
    /// Transport ID
    transport_id: String,
    /// Configuration
    config: DtlsConfig,
    /// Underlying ICE candidate pair
    ice_pair: CandidatePair,
    /// DTLS role
    role: DtlsRole,
    /// Current state
    state: Arc<RwLock<DtlsState>>,
    /// Local certificate
    local_cert: Arc<RwLock<Option<DtlsCertificate>>>,
    /// Remote certificate fingerprint (for verification)
    remote_fingerprint: Arc<RwLock<Option<String>>>,
    /// SRTP profile negotiated
    srtp_profile: Arc<RwLock<Option<SrtpProtectionProfile>>>,
    /// Handshake completion time
    handshake_complete: Arc<RwLock<Option<Instant>>>,
}

impl std::fmt::Debug for DtlsTransport {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DtlsTransport")
            .field("transport_id", &self.transport_id)
            .field("role", &self.role)
            .field("ice_pair", &self.ice_pair.id)
            .finish()
    }
}

impl DtlsTransport {
    /// Create a new DTLS transport
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub fn new(
        transport_id: impl Into<String>,
        config: DtlsConfig,
        ice_pair: CandidatePair,
        role: DtlsRole,
    ) -> StreamingResult<Self> {
        let transport_id = transport_id.into();
        
        info!("DTLS Transport {}: Creating as {:?}", transport_id, role);

        Ok(Self {
            transport_id,
            config,
            ice_pair,
            role,
            state: Arc::new(RwLock::new(DtlsState::New)),
            local_cert: Arc::new(RwLock::new(None)),
            remote_fingerprint: Arc::new(RwLock::new(None)),
            srtp_profile: Arc::new(RwLock::new(None)),
            handshake_complete: Arc::new(RwLock::new(None)),
        })
    }

    /// Get transport ID
    pub fn transport_id(&self) -> &str {
        &self.transport_id
    }

    /// Get current DTLS state
    pub async fn state(&self) -> DtlsState {
        *self.state.read().await
    }

    /// Get DTLS role
    pub fn role(&self) -> DtlsRole {
        self.role
    }

    /// Generate local certificate
    ///
    /// SYSTEM_LAW: Uses STUB_APPROVED for certificate generation
    pub async fn generate_certificate(&self) -> StreamingResult<DtlsCertificate> {
        debug!("DTLS Transport {}: Generating certificate", self.transport_id);

        let (cert, _private_key) = DtlsCertificate::generate_self_signed()?;
        
        let mut local_cert = self.local_cert.write().await;
        *local_cert = Some(cert.clone());
        
        Ok(cert)
    }

    /// Get local certificate fingerprint for SDP
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn get_local_fingerprint(&self) -> StreamingResult<String> {
        let local_cert = self.local_cert.read().await;
        
        if let Some(cert) = local_cert.as_ref() {
            Ok(cert.fingerprint_sdp())
        } else {
            // Generate if not exists
            drop(local_cert);
            let cert = self.generate_certificate().await?;
            Ok(cert.fingerprint_sdp())
        }
    }

    /// Set remote fingerprint for verification
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn set_remote_fingerprint(&self, fingerprint: impl Into<String>) {
        let mut fp = self.remote_fingerprint.write().await;
        *fp = Some(fingerprint.into());
    }

    /// Perform DTLS handshake
    ///
    /// Initiates or accepts a DTLS handshake over the ICE connection.
    /// Uses the configured role (client or server).
    ///
    /// SECURITY: Uses STUB_APPROVED for handshake pending full DTLS stack.
    /// Certificate verification disabled pending crypto module.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn perform_handshake(&self) -> StreamingResult<()> {
        info!("DTLS Transport {}: Starting handshake as {:?}", 
            self.transport_id, self.role);

        let mut state = self.state.write().await;
        *state = DtlsState::Connecting;
        drop(state);

        // Ensure we have a local certificate
        let local_cert = self.generate_certificate().await?;
        info!("DTLS Transport {}: Using fingerprint: {}",
            self.transport_id, local_cert.fingerprint);

        // STUB_APPROVED: Full DTLS handshake pending crypto module
        // Simulate handshake process
        debug!("DTLS Transport {}: Sending ClientHello", self.transport_id);
        
        // Simulate hello exchange
        tokio::time::sleep(Duration::from_millis(50)).await;
        
        debug!("DTLS Transport {}: Receiving ServerHello", self.transport_id);
        
        // Simulate key exchange
        tokio::time::sleep(Duration::from_millis(50)).await;
        
        debug!("DTLS Transport {}: Negotiating SRTP profile", self.transport_id);
        
        // Select SRTP profile
        let profile = self.config.srtp_profiles.first()
            .copied()
            .unwrap_or(SrtpProtectionProfile::Aes128CmHmacSha1_80);
        
        let mut srtp_profile = self.srtp_profile.write().await;
        *srtp_profile = Some(profile);
        drop(srtp_profile);

        // Simulate finished exchange
        tokio::time::sleep(Duration::from_millis(50)).await;

        // Verify remote fingerprint (STUB_APPROVED)
        let remote_fp = self.remote_fingerprint.read().await;
        if remote_fp.is_none() && self.config.verify_cert {
            warn!("DTLS Transport {}: No remote fingerprint set", self.transport_id);
        }

        // Mark handshake complete
        let mut state = self.state.write().await;
        *state = DtlsState::Connected;
        drop(state);

        let mut handshake_time = self.handshake_complete.write().await;
        *handshake_time = Some(Instant::now());

        info!("DTLS Transport {}: Handshake complete (profile: {:?})", 
            self.transport_id, profile);

        Ok(())
    }

    /// Extract SRTP key material from DTLS
    ///
    /// This extracts the SRTP keys derived during the DTLS handshake.
    /// Must be called after handshake completes.
    ///
    /// SECURITY: Uses STUB_APPROVED for key extraction pending crypto module.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn extract_srtp_keys(&self) -> StreamingResult<SrtpKeyMaterial> {
        let state = self.state.read().await;
        if *state != DtlsState::Connected {
            return Err(StreamingError::WebRtc(
                "DTLS handshake not complete".to_string()
            ));
        }
        drop(state);

        let profile = self.srtp_profile.read().await
            .ok_or_else(|| StreamingError::WebRtc(
                "No SRTP profile negotiated".to_string()
            ))?;

        debug!("DTLS Transport {}: Extracting SRTP keys (profile: {:?})",
            self.transport_id, profile);

        // STUB_APPROVED: Actual key extraction from TLS PRF pending crypto module
        let key_len = profile.master_key_length();
        let salt_len = profile.salt_length();

        // Generate stub keys (in production, these come from TLS key export)
        let client_key = vec![0xAAu8; key_len];
        let client_salt = vec![0xBBu8; salt_len];
        let server_key = vec![0xCCu8; key_len];
        let server_salt = vec![0xDDu8; salt_len];

        info!("DTLS Transport {}: SRTP keys extracted", self.transport_id);

        Ok(SrtpKeyMaterial::from_raw(
            client_key,
            client_salt,
            server_key,
            server_salt,
            profile,
        ))
    }

    /// Write encrypted data
    ///
    /// Encrypts data using the DTLS connection.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn write(&self, data: &[u8]) -> StreamingResult<usize> {
        let state = self.state.read().await;
        if *state != DtlsState::Connected {
            return Err(StreamingError::WebRtc(
                "DTLS not connected".to_string()
            ));
        }

        // STUB_APPROVED: Actual encryption pending DTLS stack
        debug!("DTLS Transport {}: Writing {} bytes", self.transport_id, data.len());
        
        Ok(data.len())
    }

    /// Read decrypted data
    ///
    /// Reads and decrypts data from the DTLS connection.
    ///
    /// WIH: GAP-42, Owner: T2-A4
    pub async fn read(&self, buf: &mut [u8]) -> StreamingResult<usize> {
        let state = self.state.read().await;
        if *state != DtlsState::Connected {
            return Err(StreamingError::WebRtc(
                "DTLS not connected".to_string()
            ));
        }

        // STUB_APPROVED: Actual decryption pending DTLS stack
        debug!("DTLS Transport {}: Reading up to {} bytes", 
            self.transport_id, buf.len());

        // Simulate no data available
        Ok(0)
    }

    /// Close the DTLS transport
    pub async fn close(&self) -> StreamingResult<()> {
        info!("DTLS Transport {}: Closing", self.transport_id);

        let mut state = self.state.write().await;
        *state = DtlsState::Closed;

        Ok(())
    }

    /// Get transport statistics
    pub async fn stats(&self) -> DtlsStats {
        DtlsStats {
            transport_id: self.transport_id.clone(),
            state: self.state().await,
            role: self.role,
            srtp_profile: *self.srtp_profile.read().await,
        }
    }
}

/// DTLS statistics
#[derive(Debug, Clone)]
pub struct DtlsStats {
    pub transport_id: String,
    pub state: DtlsState,
    pub role: DtlsRole,
    pub srtp_profile: Option<SrtpProtectionProfile>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transport::ice::{IceCandidate, IceCandidateType, IceProtocol};
    use std::net::SocketAddr;

    fn create_test_candidate_pair() -> CandidatePair {
        let local = IceCandidate::new_host(SocketAddr::from(([127, 0, 0, 1], 5000)), 1);
        let remote = IceCandidate::new_host(SocketAddr::from(([127, 0, 0, 1], 6000)), 1);
        CandidatePair::new(local, remote)
    }

    #[test]
    fn test_dtls_config_default() {
        let config = DtlsConfig::default();
        assert_eq!(config.mtu, 1200);
        assert!(!config.verify_cert);
        assert!(!config.cipher_suites.is_empty());
        assert!(!config.srtp_profiles.is_empty());
    }

    #[test]
    fn test_srtp_profile_key_lengths() {
        let profile = SrtpProtectionProfile::Aes128CmHmacSha1_80;
        assert_eq!(profile.master_key_length(), 16);
        assert_eq!(profile.salt_length(), 14);

        let profile256 = SrtpProtectionProfile::AeadAes256Gcm;
        assert_eq!(profile256.master_key_length(), 32);
    }

    #[tokio::test]
    async fn test_dtls_transport_creation() {
        let config = DtlsConfig::default();
        let pair = create_test_candidate_pair();
        
        let transport = DtlsTransport::new(
            "test_dtls", config, pair, DtlsRole::Client
        ).unwrap();

        assert_eq!(transport.transport_id(), "test_dtls");
        assert_eq!(transport.role(), DtlsRole::Client);
        assert_eq!(transport.state().await, DtlsState::New);
    }

    #[tokio::test]
    async fn test_certificate_generation() {
        let config = DtlsConfig::default();
        let pair = create_test_candidate_pair();
        
        let transport = DtlsTransport::new(
            "test_dtls", config, pair, DtlsRole::Client
        ).unwrap();

        let cert = transport.generate_certificate().await.unwrap();
        assert_eq!(cert.fingerprint_algorithm, "sha-256");
        assert!(!cert.fingerprint.is_empty());

        let fingerprint = transport.get_local_fingerprint().await.unwrap();
        assert!(fingerprint.contains("sha-256"));
    }

    #[tokio::test]
    async fn test_handshake() {
        let config = DtlsConfig::default();
        let pair = create_test_candidate_pair();
        
        let transport = DtlsTransport::new(
            "test_dtls", config, pair, DtlsRole::Server
        ).unwrap();

        transport.perform_handshake().await.unwrap();
        assert_eq!(transport.state().await, DtlsState::Connected);
    }

    #[tokio::test]
    async fn test_srtp_key_extraction() {
        let config = DtlsConfig::default();
        let pair = create_test_candidate_pair();
        
        let transport = DtlsTransport::new(
            "test_dtls", config, pair, DtlsRole::Client
        ).unwrap();

        // Should fail before handshake
        let result = transport.extract_srtp_keys().await;
        assert!(result.is_err());

        // Complete handshake
        transport.perform_handshake().await.unwrap();

        // Now should succeed
        let keys = transport.extract_srtp_keys().await.unwrap();
        assert_eq!(keys.client_write_key.len(), 16);
        assert_eq!(keys.client_write_salt.len(), 14);
    }

    #[test]
    fn test_srtp_key_material() {
        let material = SrtpKeyMaterial::from_raw(
            vec![0xAA; 16],
            vec![0xBB; 14],
            vec![0xCC; 16],
            vec![0xDD; 14],
            SrtpProtectionProfile::Aes128CmHmacSha1_80,
        );

        // Test local keys for client
        let (key, salt) = material.local_keys(DtlsRole::Client);
        assert_eq!(key, vec![0xAA; 16]);
        assert_eq!(salt, vec![0xBB; 14]);

        // Test local keys for server
        let (key, salt) = material.local_keys(DtlsRole::Server);
        assert_eq!(key, vec![0xCC; 16]);
        assert_eq!(salt, vec![0xDD; 14]);

        // Test remote keys for client (should be server's keys)
        let (key, salt) = material.remote_keys(DtlsRole::Client);
        assert_eq!(key, vec![0xCC; 16]);
        assert_eq!(salt, vec![0xDD; 14]);
    }

    #[test]
    fn test_dtls_role() {
        assert_eq!(DtlsRole::Client.opposite(), DtlsRole::Server);
        assert_eq!(DtlsRole::Server.opposite(), DtlsRole::Client);
    }
}
