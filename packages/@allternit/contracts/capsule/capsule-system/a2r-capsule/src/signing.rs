//! Cryptographic signing for capsules.
//!
//! Supports multiple signature algorithms with a migration path to post-quantum cryptography.
//!
//! ## Supported Algorithms
//!
//! - `Ed25519` - Current default, fast and well-audited (vulnerable to quantum attacks)
//! - `Ed25519_MlDsa65` - Hybrid scheme for quantum resistance (future)
//! - `MlDsa65` - Pure post-quantum via ML-DSA/Dilithium (future)
//!
//! ## Migration Strategy
//!
//! 1. Current: Ed25519 only
//! 2. Transition: Hybrid Ed25519 + ML-DSA (verify both)
//! 3. Future: Pure PQC when quantum threat is imminent

use crate::content_hash::ContentHash;
use crate::error::{CapsuleError, CapsuleResult};
use chrono::{DateTime, Utc};
use ed25519_dalek::{
    Signature as Ed25519Signature, Signer, SigningKey as Ed25519SigningKey, Verifier,
    VerifyingKey as Ed25519VerifyingKey,
};
use pqcrypto_dilithium::dilithium3;
use pqcrypto_sphincsplus::sphincsshake128ssimple;
use pqcrypto_traits::sign::{
    DetachedSignature as PqDetachedSignature, PublicKey as PqPublicKey, SecretKey as PqSecretKey,
};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};

const ED25519_PUBLIC_KEY_BYTES: usize = 32;
const ED25519_SECRET_KEY_BYTES: usize = 32;
const ED25519_SIGNATURE_BYTES: usize = 64;
const MLDSA65_PUBLIC_KEY_BYTES: usize = 1952;
const MLDSA65_SIGNATURE_BYTES: usize = 3309;
const SLHDSA128S_PUBLIC_KEY_BYTES: usize = sphincsshake128ssimple::public_key_bytes();
const SLHDSA128S_SIGNATURE_BYTES: usize = sphincsshake128ssimple::signature_bytes();

/// Supported signature algorithms.
///
/// Designed for forward compatibility with post-quantum cryptography.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[derive(Default)]
pub enum SignatureAlgorithm {
    /// Ed25519 - Current default
    /// - 32-byte public keys, 64-byte signatures
    /// - Fast, well-audited
    /// - Vulnerable to quantum attacks (Shor's algorithm)
    #[default]
    Ed25519,

    /// Hybrid Ed25519 + ML-DSA-65 (Dilithium)
    /// - Provides quantum resistance while maintaining classical security
    /// - Larger signatures (~3.3KB for ML-DSA-65 + 64B for Ed25519)
    /// - Recommended transition scheme
    #[serde(rename = "ed25519_ml_dsa_65")]
    Ed25519MlDsa65,

    /// Pure ML-DSA-65 (Dilithium) - NIST PQC Standard
    /// - Post-quantum secure
    /// - ~1.9KB public keys, ~3.3KB signatures
    /// - Use when quantum computers are imminent threat
    #[serde(rename = "ml_dsa_65")]
    MlDsa65,

    /// SLH-DSA (SPHINCS+) - Stateless hash-based
    /// - Most conservative PQC choice
    /// - Larger signatures (~8-40KB depending on parameters)
    /// - Backup if lattice-based schemes are broken
    #[serde(rename = "slh_dsa_128s")]
    SlhDsa128s,
}

impl SignatureAlgorithm {
    /// Get the algorithm name as a string.
    pub fn as_str(&self) -> &'static str {
        match self {
            SignatureAlgorithm::Ed25519 => "ed25519",
            SignatureAlgorithm::Ed25519MlDsa65 => "ed25519_ml_dsa_65",
            SignatureAlgorithm::MlDsa65 => "ml_dsa_65",
            SignatureAlgorithm::SlhDsa128s => "slh_dsa_128s",
        }
    }

    /// Check if this algorithm is quantum-resistant.
    pub fn is_quantum_resistant(&self) -> bool {
        matches!(
            self,
            SignatureAlgorithm::Ed25519MlDsa65
                | SignatureAlgorithm::MlDsa65
                | SignatureAlgorithm::SlhDsa128s
        )
    }

    /// Check if this algorithm is currently implemented.
    pub fn is_implemented(&self) -> bool {
        matches!(
            self,
            SignatureAlgorithm::Ed25519
                | SignatureAlgorithm::Ed25519MlDsa65
                | SignatureAlgorithm::MlDsa65
                | SignatureAlgorithm::SlhDsa128s
        )
        // Future: Add more as we implement them
    }

    /// Get the expected signature size in bytes.
    pub fn signature_size(&self) -> usize {
        match self {
            SignatureAlgorithm::Ed25519 => ED25519_SIGNATURE_BYTES,
            SignatureAlgorithm::Ed25519MlDsa65 => ED25519_SIGNATURE_BYTES + MLDSA65_SIGNATURE_BYTES,
            SignatureAlgorithm::MlDsa65 => MLDSA65_SIGNATURE_BYTES,
            SignatureAlgorithm::SlhDsa128s => SLHDSA128S_SIGNATURE_BYTES,
        }
    }

    /// Get the expected public key size in bytes.
    pub fn public_key_size(&self) -> usize {
        match self {
            SignatureAlgorithm::Ed25519 => ED25519_PUBLIC_KEY_BYTES,
            SignatureAlgorithm::Ed25519MlDsa65 => {
                ED25519_PUBLIC_KEY_BYTES + MLDSA65_PUBLIC_KEY_BYTES
            }
            SignatureAlgorithm::MlDsa65 => MLDSA65_PUBLIC_KEY_BYTES,
            SignatureAlgorithm::SlhDsa128s => SLHDSA128S_PUBLIC_KEY_BYTES,
        }
    }
}

impl std::fmt::Display for SignatureAlgorithm {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// A signing key for creating capsule signatures.
#[derive(Clone)]
pub struct SigningKey {
    algorithm: SignatureAlgorithm,
    inner: SigningKeyInner,
    publisher_id: String,
}

#[derive(Clone)]
enum SigningKeyInner {
    Ed25519(Ed25519SigningKey),
    MlDsa65 {
        secret: dilithium3::SecretKey,
        public: dilithium3::PublicKey,
    },
    SlhDsa128s {
        secret: sphincsshake128ssimple::SecretKey,
        public: sphincsshake128ssimple::PublicKey,
    },
    Hybrid {
        ed25519: Ed25519SigningKey,
        pqc_secret: dilithium3::SecretKey,
        pqc_public: dilithium3::PublicKey,
    },
}

impl SigningKey {
    /// Generate a new random signing key with the default algorithm (Ed25519).
    pub fn generate(publisher_id: impl Into<String>) -> Self {
        Self::generate_with_algorithm(publisher_id, SignatureAlgorithm::Ed25519)
            .expect("Ed25519 key generation should never fail")
    }

    /// Generate a new random signing key with a specific algorithm.
    pub fn generate_with_algorithm(
        publisher_id: impl Into<String>,
        algorithm: SignatureAlgorithm,
    ) -> CapsuleResult<Self> {
        let inner = match algorithm {
            SignatureAlgorithm::Ed25519 => {
                SigningKeyInner::Ed25519(Ed25519SigningKey::generate(&mut OsRng))
            }
            SignatureAlgorithm::MlDsa65 => {
                let (public, secret) = dilithium3::keypair();
                SigningKeyInner::MlDsa65 { secret, public }
            }
            SignatureAlgorithm::SlhDsa128s => {
                let (public, secret) = sphincsshake128ssimple::keypair();
                SigningKeyInner::SlhDsa128s { secret, public }
            }
            SignatureAlgorithm::Ed25519MlDsa65 => {
                let ed25519 = Ed25519SigningKey::generate(&mut OsRng);
                let (pqc_public, pqc_secret) = dilithium3::keypair();
                SigningKeyInner::Hybrid {
                    ed25519,
                    pqc_secret,
                    pqc_public,
                }
            }
        };

        Ok(Self {
            algorithm,
            inner,
            publisher_id: publisher_id.into(),
        })
    }

    /// Create from raw bytes (Ed25519 only).
    pub fn from_bytes(bytes: &[u8; 32], publisher_id: impl Into<String>) -> CapsuleResult<Self> {
        Self::from_bytes_with_algorithm(bytes, publisher_id, SignatureAlgorithm::Ed25519)
    }

    /// Create from raw bytes with explicit algorithm.
    ///
    /// For PQC and hybrid keys, the bytes must contain secret material followed by
    /// the public key bytes (used to reconstruct the verifying key).
    pub fn from_bytes_with_algorithm(
        bytes: &[u8],
        publisher_id: impl Into<String>,
        algorithm: SignatureAlgorithm,
    ) -> CapsuleResult<Self> {
        let publisher_id = publisher_id.into();

        let inner = match algorithm {
            SignatureAlgorithm::Ed25519 => {
                if bytes.len() != ED25519_SECRET_KEY_BYTES {
                    return Err(CapsuleError::CryptoError(format!(
                        "Invalid Ed25519 private key length: expected {}, got {}",
                        ED25519_SECRET_KEY_BYTES,
                        bytes.len()
                    )));
                }
                let mut arr = [0u8; ED25519_SECRET_KEY_BYTES];
                arr.copy_from_slice(bytes);
                SigningKeyInner::Ed25519(Ed25519SigningKey::from_bytes(&arr))
            }
            SignatureAlgorithm::MlDsa65 => {
                let (secret_bytes, public_bytes) =
                    split_key_material(bytes, MLDSA65_PUBLIC_KEY_BYTES)?;
                let secret = dilithium3::SecretKey::from_bytes(secret_bytes).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid ML-DSA secret key: {}", e))
                })?;
                let public = dilithium3::PublicKey::from_bytes(public_bytes).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid ML-DSA public key: {}", e))
                })?;
                SigningKeyInner::MlDsa65 { secret, public }
            }
            SignatureAlgorithm::SlhDsa128s => {
                let (secret_bytes, public_bytes) =
                    split_key_material(bytes, SLHDSA128S_PUBLIC_KEY_BYTES)?;
                let secret =
                    sphincsshake128ssimple::SecretKey::from_bytes(secret_bytes).map_err(|e| {
                        CapsuleError::CryptoError(format!("Invalid SLH-DSA secret key: {}", e))
                    })?;
                let public =
                    sphincsshake128ssimple::PublicKey::from_bytes(public_bytes).map_err(|e| {
                        CapsuleError::CryptoError(format!("Invalid SLH-DSA public key: {}", e))
                    })?;
                SigningKeyInner::SlhDsa128s { secret, public }
            }
            SignatureAlgorithm::Ed25519MlDsa65 => {
                let (secret_bytes, public_bytes) =
                    split_key_material(bytes, ED25519_PUBLIC_KEY_BYTES + MLDSA65_PUBLIC_KEY_BYTES)?;

                if secret_bytes.len() < ED25519_SECRET_KEY_BYTES {
                    return Err(CapsuleError::CryptoError(
                        "Hybrid secret key missing Ed25519 seed".into(),
                    ));
                }

                let (ed_secret_bytes, pqc_secret_bytes) =
                    secret_bytes.split_at(ED25519_SECRET_KEY_BYTES);
                let (ed_public_bytes, pqc_public_bytes) =
                    public_bytes.split_at(ED25519_PUBLIC_KEY_BYTES);

                let mut ed_arr = [0u8; ED25519_SECRET_KEY_BYTES];
                ed_arr.copy_from_slice(ed_secret_bytes);

                let ed25519 = Ed25519SigningKey::from_bytes(&ed_arr);
                let pqc_secret =
                    dilithium3::SecretKey::from_bytes(pqc_secret_bytes).map_err(|e| {
                        CapsuleError::CryptoError(format!("Invalid ML-DSA secret key: {}", e))
                    })?;
                let pqc_public =
                    dilithium3::PublicKey::from_bytes(pqc_public_bytes).map_err(|e| {
                        CapsuleError::CryptoError(format!("Invalid ML-DSA public key: {}", e))
                    })?;

                if ed_public_bytes.len() != ED25519_PUBLIC_KEY_BYTES {
                    return Err(CapsuleError::CryptoError(
                        "Hybrid public key missing Ed25519 bytes".into(),
                    ));
                }

                SigningKeyInner::Hybrid {
                    ed25519,
                    pqc_secret,
                    pqc_public,
                }
            }
        };

        Ok(Self {
            algorithm,
            inner,
            publisher_id,
        })
    }

    /// Get the raw key bytes.
    pub fn to_bytes(&self) -> CapsuleResult<Vec<u8>> {
        match &self.inner {
            SigningKeyInner::Ed25519(key) => Ok(key.to_bytes().to_vec()),
            SigningKeyInner::MlDsa65 { secret, public } => {
                let mut bytes = secret.as_bytes().to_vec();
                bytes.extend_from_slice(public.as_bytes());
                Ok(bytes)
            }
            SigningKeyInner::SlhDsa128s { secret, public } => {
                let mut bytes = secret.as_bytes().to_vec();
                bytes.extend_from_slice(public.as_bytes());
                Ok(bytes)
            }
            SigningKeyInner::Hybrid {
                ed25519,
                pqc_secret,
                pqc_public,
            } => {
                let mut bytes = ed25519.to_bytes().to_vec();
                bytes.extend_from_slice(pqc_secret.as_bytes());
                bytes.extend_from_slice(ed25519.verifying_key().as_bytes());
                bytes.extend_from_slice(pqc_public.as_bytes());
                Ok(bytes)
            }
        }
    }

    /// Get the algorithm used by this key.
    pub fn algorithm(&self) -> SignatureAlgorithm {
        self.algorithm
    }

    /// Get the corresponding verifying key.
    pub fn verifying_key(&self) -> VerifyingKey {
        let inner = match &self.inner {
            SigningKeyInner::Ed25519(key) => VerifyingKeyInner::Ed25519(key.verifying_key()),
            SigningKeyInner::MlDsa65 { public, .. } => VerifyingKeyInner::MlDsa65(*public),
            SigningKeyInner::SlhDsa128s { public, .. } => VerifyingKeyInner::SlhDsa128s(*public),
            SigningKeyInner::Hybrid {
                ed25519,
                pqc_public,
                ..
            } => VerifyingKeyInner::Hybrid {
                ed25519: ed25519.verifying_key(),
                pqc: *pqc_public,
            },
        };

        VerifyingKey {
            algorithm: self.algorithm,
            inner,
            publisher_id: self.publisher_id.clone(),
        }
    }

    /// Sign a message.
    pub fn sign(&self, message: &[u8]) -> Vec<u8> {
        match &self.inner {
            SigningKeyInner::Ed25519(key) => key.sign(message).to_bytes().to_vec(),
            SigningKeyInner::MlDsa65 { secret, .. } => dilithium3::detached_sign(message, secret)
                .as_bytes()
                .to_vec(),
            SigningKeyInner::SlhDsa128s { secret, .. } => {
                sphincsshake128ssimple::detached_sign(message, secret)
                    .as_bytes()
                    .to_vec()
            }
            SigningKeyInner::Hybrid {
                ed25519,
                pqc_secret,
                ..
            } => {
                let mut signature = ed25519.sign(message).to_bytes().to_vec();
                let pqc_sig = dilithium3::detached_sign(message, pqc_secret);
                signature.extend_from_slice(pqc_sig.as_bytes());
                signature
            }
        }
    }

    /// Sign a content hash and create a capsule signature.
    pub fn sign_capsule(&self, content_hash: &ContentHash) -> CapsuleSignature {
        let signature_bytes = self.sign(content_hash.as_bytes());
        let public_key = self.verifying_key().to_base64();

        CapsuleSignature {
            algorithm: self.algorithm,
            publisher_id: self.publisher_id.clone(),
            public_key,
            signature: base64::encode(&signature_bytes),
            timestamp: Utc::now(),
        }
    }

    /// Get the publisher ID.
    pub fn publisher_id(&self) -> &str {
        &self.publisher_id
    }
}

impl std::fmt::Debug for SigningKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SigningKey")
            .field("algorithm", &self.algorithm)
            .field("publisher_id", &self.publisher_id)
            .field("private_key", &"[REDACTED]")
            .finish()
    }
}

/// A verifying key for checking capsule signatures.
#[derive(Clone)]
pub struct VerifyingKey {
    algorithm: SignatureAlgorithm,
    inner: VerifyingKeyInner,
    publisher_id: String,
}

#[derive(Clone)]
enum VerifyingKeyInner {
    Ed25519(Ed25519VerifyingKey),
    MlDsa65(dilithium3::PublicKey),
    SlhDsa128s(sphincsshake128ssimple::PublicKey),
    Hybrid {
        ed25519: Ed25519VerifyingKey,
        pqc: dilithium3::PublicKey,
    },
}

impl VerifyingKey {
    /// Create from raw bytes (Ed25519).
    pub fn from_bytes(bytes: &[u8; 32], publisher_id: impl Into<String>) -> CapsuleResult<Self> {
        Self::from_bytes_with_algorithm(bytes, publisher_id, SignatureAlgorithm::Ed25519)
    }

    /// Create from raw bytes with explicit algorithm.
    pub fn from_bytes_with_algorithm(
        bytes: &[u8],
        publisher_id: impl Into<String>,
        algorithm: SignatureAlgorithm,
    ) -> CapsuleResult<Self> {
        let inner = match algorithm {
            SignatureAlgorithm::Ed25519 => {
                if bytes.len() != ED25519_PUBLIC_KEY_BYTES {
                    return Err(CapsuleError::CryptoError(format!(
                        "Invalid Ed25519 public key length: expected {}, got {}",
                        ED25519_PUBLIC_KEY_BYTES,
                        bytes.len()
                    )));
                }

                let mut arr = [0u8; ED25519_PUBLIC_KEY_BYTES];
                arr.copy_from_slice(bytes);
                let inner = Ed25519VerifyingKey::from_bytes(&arr).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid Ed25519 public key: {}", e))
                })?;
                VerifyingKeyInner::Ed25519(inner)
            }
            SignatureAlgorithm::MlDsa65 => {
                let key = dilithium3::PublicKey::from_bytes(bytes).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid ML-DSA public key: {}", e))
                })?;
                VerifyingKeyInner::MlDsa65(key)
            }
            SignatureAlgorithm::SlhDsa128s => {
                let key = sphincsshake128ssimple::PublicKey::from_bytes(bytes).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid SLH-DSA public key: {}", e))
                })?;
                VerifyingKeyInner::SlhDsa128s(key)
            }
            SignatureAlgorithm::Ed25519MlDsa65 => {
                if bytes.len() <= ED25519_PUBLIC_KEY_BYTES {
                    return Err(CapsuleError::CryptoError(
                        "Hybrid public key missing PQC bytes".into(),
                    ));
                }
                let (ed_bytes, pqc_bytes) = bytes.split_at(ED25519_PUBLIC_KEY_BYTES);
                let mut arr = [0u8; ED25519_PUBLIC_KEY_BYTES];
                arr.copy_from_slice(ed_bytes);
                let ed25519 = Ed25519VerifyingKey::from_bytes(&arr).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid Ed25519 public key: {}", e))
                })?;
                let pqc = dilithium3::PublicKey::from_bytes(pqc_bytes).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid ML-DSA public key: {}", e))
                })?;
                VerifyingKeyInner::Hybrid { ed25519, pqc }
            }
        };

        Ok(Self {
            algorithm,
            inner,
            publisher_id: publisher_id.into(),
        })
    }

    /// Create from base64-encoded string with algorithm detection.
    pub fn from_base64(
        b64: &str,
        publisher_id: impl Into<String>,
        algorithm: SignatureAlgorithm,
    ) -> CapsuleResult<Self> {
        let bytes = base64::decode(b64)
            .map_err(|e| CapsuleError::CryptoError(format!("Invalid base64: {}", e)))?;

        Self::from_bytes_with_algorithm(&bytes, publisher_id, algorithm)
    }

    /// Get the algorithm.
    pub fn algorithm(&self) -> SignatureAlgorithm {
        self.algorithm
    }

    /// Verify a signature.
    pub fn verify(&self, message: &[u8], signature: &[u8]) -> CapsuleResult<()> {
        match &self.inner {
            VerifyingKeyInner::Ed25519(key) => {
                if signature.len() != ED25519_SIGNATURE_BYTES {
                    return Err(CapsuleError::CryptoError(format!(
                        "Invalid Ed25519 signature length: expected 64, got {}",
                        signature.len()
                    )));
                }
                let mut sig_bytes = [0u8; ED25519_SIGNATURE_BYTES];
                sig_bytes.copy_from_slice(signature);
                let sig = Ed25519Signature::from_bytes(&sig_bytes);

                key.verify(message, &sig)
                    .map_err(|e| CapsuleError::SignatureVerificationFailed(e.to_string()))
            }
            VerifyingKeyInner::MlDsa65(key) => {
                let sig = dilithium3::DetachedSignature::from_bytes(signature).map_err(|e| {
                    CapsuleError::CryptoError(format!("Invalid ML-DSA signature: {}", e))
                })?;
                dilithium3::verify_detached_signature(&sig, message, key)
                    .map_err(|e| CapsuleError::SignatureVerificationFailed(e.to_string()))
            }
            VerifyingKeyInner::SlhDsa128s(key) => {
                let sig = sphincsshake128ssimple::DetachedSignature::from_bytes(signature)
                    .map_err(|e| {
                        CapsuleError::CryptoError(format!("Invalid SLH-DSA signature: {}", e))
                    })?;
                sphincsshake128ssimple::verify_detached_signature(&sig, message, key)
                    .map_err(|e| CapsuleError::SignatureVerificationFailed(e.to_string()))
            }
            VerifyingKeyInner::Hybrid { ed25519, pqc } => {
                if signature.len() <= ED25519_SIGNATURE_BYTES {
                    return Err(CapsuleError::CryptoError(
                        "Hybrid signature missing PQC bytes".into(),
                    ));
                }
                let (ed_sig_bytes, pqc_sig_bytes) = signature.split_at(ED25519_SIGNATURE_BYTES);
                let mut sig_bytes = [0u8; ED25519_SIGNATURE_BYTES];
                sig_bytes.copy_from_slice(ed_sig_bytes);
                let sig = Ed25519Signature::from_bytes(&sig_bytes);
                ed25519
                    .verify(message, &sig)
                    .map_err(|e| CapsuleError::SignatureVerificationFailed(e.to_string()))?;

                let pqc_sig =
                    dilithium3::DetachedSignature::from_bytes(pqc_sig_bytes).map_err(|e| {
                        CapsuleError::CryptoError(format!("Invalid ML-DSA signature: {}", e))
                    })?;
                dilithium3::verify_detached_signature(&pqc_sig, message, pqc)
                    .map_err(|e| CapsuleError::SignatureVerificationFailed(e.to_string()))
            }
        }
    }

    /// Verify a capsule signature.
    pub fn verify_capsule(
        &self,
        content_hash: &ContentHash,
        signature: &CapsuleSignature,
    ) -> CapsuleResult<()> {
        // Verify algorithm matches
        if signature.algorithm != self.algorithm {
            return Err(CapsuleError::SignatureVerificationFailed(format!(
                "Algorithm mismatch: expected {}, got {}",
                self.algorithm, signature.algorithm
            )));
        }

        // Verify publisher matches
        if signature.publisher_id != self.publisher_id {
            return Err(CapsuleError::SignatureVerificationFailed(format!(
                "Publisher mismatch: expected {}, got {}",
                self.publisher_id, signature.publisher_id
            )));
        }

        // Decode and verify signature
        let sig_bytes = base64::decode(&signature.signature)
            .map_err(|e| CapsuleError::CryptoError(format!("Invalid signature encoding: {}", e)))?;

        self.verify(content_hash.as_bytes(), &sig_bytes)
    }

    /// Get the publisher ID.
    pub fn publisher_id(&self) -> &str {
        &self.publisher_id
    }

    /// Get as base64 string.
    pub fn to_base64(&self) -> String {
        match &self.inner {
            VerifyingKeyInner::Ed25519(key) => base64::encode(key.as_bytes()),
            VerifyingKeyInner::MlDsa65(key) => base64::encode(key.as_bytes()),
            VerifyingKeyInner::SlhDsa128s(key) => base64::encode(key.as_bytes()),
            VerifyingKeyInner::Hybrid { ed25519, pqc } => {
                let mut bytes = ed25519.as_bytes().to_vec();
                bytes.extend_from_slice(pqc.as_bytes());
                base64::encode(bytes)
            }
        }
    }
}

impl std::fmt::Debug for VerifyingKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("VerifyingKey")
            .field("algorithm", &self.algorithm)
            .field("publisher_id", &self.publisher_id)
            .field("public_key", &self.to_base64())
            .finish()
    }
}

/// A key pair (signing + verifying).
pub struct KeyPair {
    pub signing: SigningKey,
    pub verifying: VerifyingKey,
}

impl KeyPair {
    /// Generate a new key pair with the default algorithm (Ed25519).
    pub fn generate(publisher_id: impl Into<String>) -> Self {
        Self::generate_with_algorithm(publisher_id, SignatureAlgorithm::Ed25519)
            .expect("Ed25519 key generation should never fail")
    }

    /// Generate a new key pair with a specific algorithm.
    pub fn generate_with_algorithm(
        publisher_id: impl Into<String>,
        algorithm: SignatureAlgorithm,
    ) -> CapsuleResult<Self> {
        let publisher_id = publisher_id.into();
        let signing = SigningKey::generate_with_algorithm(&publisher_id, algorithm)?;
        let verifying = signing.verifying_key();
        Ok(Self { signing, verifying })
    }

    /// Get the algorithm used by this key pair.
    pub fn algorithm(&self) -> SignatureAlgorithm {
        self.signing.algorithm()
    }
}

/// A capsule signature with algorithm metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapsuleSignature {
    /// The signature algorithm used
    #[serde(default)]
    pub algorithm: SignatureAlgorithm,

    /// Publisher identifier
    pub publisher_id: String,

    /// Base64-encoded public key
    pub public_key: String,

    /// Base64-encoded signature
    pub signature: String,

    /// When the signature was created
    pub timestamp: DateTime<Utc>,
}

impl CapsuleSignature {
    /// Create a placeholder signature (for testing).
    pub fn placeholder() -> Self {
        Self {
            algorithm: SignatureAlgorithm::Ed25519,
            publisher_id: "placeholder".into(),
            public_key: base64::encode([0u8; 32]),
            signature: base64::encode([0u8; 64]),
            timestamp: Utc::now(),
        }
    }

    /// Get the verifying key from this signature.
    pub fn verifying_key(&self) -> CapsuleResult<VerifyingKey> {
        VerifyingKey::from_base64(&self.public_key, &self.publisher_id, self.algorithm)
    }

    /// Verify this signature against a content hash.
    pub fn verify(&self, content_hash: &ContentHash) -> CapsuleResult<()> {
        let verifying_key = self.verifying_key()?;
        verifying_key.verify_capsule(content_hash, self)
    }

    /// Check if this signature uses a quantum-resistant algorithm.
    pub fn is_quantum_resistant(&self) -> bool {
        self.algorithm.is_quantum_resistant()
    }
}

/// Policy for signature verification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignaturePolicy {
    /// Minimum required algorithm (for quantum resistance requirements)
    pub minimum_algorithm: Option<SignatureAlgorithm>,

    /// Require quantum-resistant signatures
    pub require_quantum_resistant: bool,

    /// Allowed algorithms (empty = all implemented algorithms allowed)
    pub allowed_algorithms: Vec<SignatureAlgorithm>,

    /// Maximum signature age (for freshness requirements)
    pub max_signature_age_seconds: Option<u64>,
}

impl Default for SignaturePolicy {
    fn default() -> Self {
        Self {
            minimum_algorithm: None,
            require_quantum_resistant: false,
            allowed_algorithms: vec![SignatureAlgorithm::Ed25519],
            max_signature_age_seconds: None,
        }
    }
}

impl SignaturePolicy {
    /// Create a policy requiring quantum-resistant signatures.
    pub fn quantum_resistant() -> Self {
        Self {
            minimum_algorithm: None,
            require_quantum_resistant: true,
            allowed_algorithms: vec![
                SignatureAlgorithm::Ed25519MlDsa65,
                SignatureAlgorithm::MlDsa65,
                SignatureAlgorithm::SlhDsa128s,
            ],
            max_signature_age_seconds: None,
        }
    }

    /// Check if a signature satisfies this policy.
    pub fn check(&self, signature: &CapsuleSignature) -> CapsuleResult<()> {
        // Check quantum resistance requirement
        if self.require_quantum_resistant && !signature.is_quantum_resistant() {
            return Err(CapsuleError::SignatureVerificationFailed(
                "Policy requires quantum-resistant signature".into(),
            ));
        }

        // Check allowed algorithms
        if !self.allowed_algorithms.is_empty()
            && !self.allowed_algorithms.contains(&signature.algorithm)
        {
            return Err(CapsuleError::SignatureVerificationFailed(format!(
                "Algorithm {} is not allowed by policy",
                signature.algorithm
            )));
        }

        // Check signature age
        if let Some(max_age) = self.max_signature_age_seconds {
            let age = (Utc::now() - signature.timestamp).num_seconds();
            if age < 0 || age as u64 > max_age {
                return Err(CapsuleError::SignatureVerificationFailed(format!(
                    "Signature age ({} seconds) exceeds policy maximum ({} seconds)",
                    age, max_age
                )));
            }
        }

        Ok(())
    }
}

fn split_key_material(bytes: &[u8], public_key_len: usize) -> CapsuleResult<(&[u8], &[u8])> {
    if bytes.len() <= public_key_len {
        return Err(CapsuleError::CryptoError(format!(
            "Key material too short: expected secret+public bytes, got {}",
            bytes.len()
        )));
    }

    let split_at = bytes.len() - public_key_len;
    Ok(bytes.split_at(split_at))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_generation() {
        let keypair = KeyPair::generate("test-publisher");
        assert_eq!(keypair.signing.publisher_id(), "test-publisher");
        assert_eq!(keypair.verifying.publisher_id(), "test-publisher");
        assert_eq!(keypair.algorithm(), SignatureAlgorithm::Ed25519);
    }

    #[test]
    fn test_sign_and_verify() {
        let keypair = KeyPair::generate("test-publisher");
        let content_hash = ContentHash::hash(b"test capsule content");

        let signature = keypair.signing.sign_capsule(&content_hash);
        assert_eq!(signature.algorithm, SignatureAlgorithm::Ed25519);
        assert!(signature.verify(&content_hash).is_ok());
    }

    #[test]
    fn test_sign_and_verify_mldsa() {
        let keypair =
            KeyPair::generate_with_algorithm("pqc-publisher", SignatureAlgorithm::MlDsa65).unwrap();
        let content_hash = ContentHash::hash(b"pqc capsule content");

        let signature = keypair.signing.sign_capsule(&content_hash);
        assert_eq!(signature.algorithm, SignatureAlgorithm::MlDsa65);
        assert!(signature.verify(&content_hash).is_ok());
    }

    #[test]
    fn test_sign_and_verify_slh_dsa() {
        let keypair =
            KeyPair::generate_with_algorithm("pqc-publisher", SignatureAlgorithm::SlhDsa128s)
                .unwrap();
        let content_hash = ContentHash::hash(b"pqc capsule content");

        let signature = keypair.signing.sign_capsule(&content_hash);
        assert_eq!(signature.algorithm, SignatureAlgorithm::SlhDsa128s);
        assert!(signature.verify(&content_hash).is_ok());
    }

    #[test]
    fn test_sign_and_verify_hybrid() {
        let keypair =
            KeyPair::generate_with_algorithm("pqc-publisher", SignatureAlgorithm::Ed25519MlDsa65)
                .unwrap();
        let content_hash = ContentHash::hash(b"hybrid capsule content");

        let signature = keypair.signing.sign_capsule(&content_hash);
        assert_eq!(signature.algorithm, SignatureAlgorithm::Ed25519MlDsa65);
        assert!(signature.verify(&content_hash).is_ok());
    }

    #[test]
    fn test_verify_wrong_content() {
        let keypair = KeyPair::generate("test-publisher");
        let content_hash = ContentHash::hash(b"test capsule content");
        let wrong_hash = ContentHash::hash(b"wrong content");

        let signature = keypair.signing.sign_capsule(&content_hash);
        assert!(signature.verify(&wrong_hash).is_err());
    }

    #[test]
    fn test_verify_wrong_publisher() {
        let keypair1 = KeyPair::generate("publisher-1");
        let keypair2 = KeyPair::generate("publisher-2");
        let content_hash = ContentHash::hash(b"test");

        let signature = keypair1.signing.sign_capsule(&content_hash);

        // Try to verify with wrong publisher's key
        let result = keypair2.verifying.verify_capsule(&content_hash, &signature);
        assert!(result.is_err());
    }

    #[test]
    fn test_algorithm_properties() {
        assert!(!SignatureAlgorithm::Ed25519.is_quantum_resistant());
        assert!(SignatureAlgorithm::Ed25519MlDsa65.is_quantum_resistant());
        assert!(SignatureAlgorithm::MlDsa65.is_quantum_resistant());
        assert!(SignatureAlgorithm::SlhDsa128s.is_quantum_resistant());

        assert!(SignatureAlgorithm::Ed25519.is_implemented());
        assert!(SignatureAlgorithm::MlDsa65.is_implemented());
        assert!(SignatureAlgorithm::SlhDsa128s.is_implemented());
    }

    #[test]
    fn test_signature_policy() {
        let keypair = KeyPair::generate("test");
        let content_hash = ContentHash::hash(b"test");
        let signature = keypair.signing.sign_capsule(&content_hash);

        // Default policy should pass
        let default_policy = SignaturePolicy::default();
        assert!(default_policy.check(&signature).is_ok());

        // Quantum-resistant policy should fail for Ed25519
        let pqc_policy = SignaturePolicy::quantum_resistant();
        assert!(pqc_policy.check(&signature).is_err());

        let pqc_keypair =
            KeyPair::generate_with_algorithm("pqc", SignatureAlgorithm::MlDsa65).unwrap();
        let pqc_signature = pqc_keypair.signing.sign_capsule(&content_hash);
        assert!(pqc_policy.check(&pqc_signature).is_ok());
    }

    #[test]
    fn test_signature_serialization() {
        let keypair = KeyPair::generate("test");
        let content_hash = ContentHash::hash(b"test");
        let signature = keypair.signing.sign_capsule(&content_hash);

        // Serialize and deserialize
        let json = serde_json::to_string(&signature).unwrap();
        let deserialized: CapsuleSignature = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.algorithm, SignatureAlgorithm::Ed25519);
        assert_eq!(deserialized.publisher_id, "test");
        assert!(deserialized.verify(&content_hash).is_ok());
    }
}
