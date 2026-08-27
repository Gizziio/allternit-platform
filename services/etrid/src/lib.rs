//! Allternit Etrid — Native Agent Wallet
//!
//! Etrid provides every autonomous bot with a scoped, vault-backed wallet:
//! - Ed25519 identity key for signing and authentication
//! - Optional secp256k1/EVM key pair for on-chain operations
//! - Message and transaction signing
//! - Invoice creation
//! - Vault-sealed key storage (via AES-256-GCM + external KMS wrappers)
//!
//! This crate is intentionally minimal in phase 1. The HTTP service surface
//! (`src/main.rs`) exposes wallet lifecycle and signing endpoints so the
//! Allternit platform can provision wallets during bot creation.

use base64::prelude::*;
use chrono::{DateTime, Utc};
use ed25519_dalek::{SigningKey, Signature, Signer, VerifyingKey};
use rand::rngs::OsRng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

pub mod vault;

/// Supported wallet kinds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WalletKind {
    /// Ed25519-only identity wallet (signing / ACP / agent identity).
    Identity,
    /// EVM-compatible wallet (secp256k1) for on-chain transactions.
    Evm,
}

/// Payment methods a wallet is allowed to perform.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentMethod {
    Send,
    Receive,
    Swap,
    Stake,
    Invoice,
}

/// A wallet scoped to an agent.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wallet {
    pub id: String,
    pub agent_id: String,
    pub kind: WalletKind,
    pub public_key: String,
    pub address: Option<String>,
    pub chain_id: Option<String>,
    pub allowed_methods: Vec<PaymentMethod>,
    pub created_at: DateTime<Utc>,
    /// Reference to encrypted key material in the Allternit vault.
    pub key_vault_ref: String,
}

/// New-wallet request.
#[derive(Debug, Clone, Deserialize)]
pub struct CreateWalletRequest {
    pub agent_id: String,
    pub kind: WalletKind,
    pub chain_id: Option<String>,
    pub allowed_methods: Vec<PaymentMethod>,
}

/// Signing request.
#[derive(Debug, Clone, Deserialize)]
pub struct SignRequest {
    pub wallet_id: String,
    pub message: String,
}

/// Signing response.
#[derive(Debug, Clone, Serialize)]
pub struct SignResponse {
    pub signature: String,
    pub public_key: String,
}

/// Invoice request.
#[derive(Debug, Clone, Deserialize)]
pub struct InvoiceRequest {
    pub wallet_id: String,
    pub amount: String,
    pub currency: String,
    pub description: Option<String>,
    pub expires_in_seconds: Option<u64>,
}

/// Invoice response.
#[derive(Debug, Clone, Serialize)]
pub struct Invoice {
    pub invoice_id: String,
    pub wallet_id: String,
    pub amount: String,
    pub currency: String,
    pub description: Option<String>,
    pub payment_uri: String,
    pub expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, thiserror::Error)]
pub enum EtridError {
    #[error("wallet not found: {0}")]
    WalletNotFound(String),
    #[error("method not allowed: {0}")]
    MethodNotAllowed(String),
    #[error("invalid key material")]
    InvalidKeyMaterial,
    #[error("vault error: {0}")]
    VaultError(String),
}

/// In-memory wallet store for phase-1 scaffolding.
/// Production should persist encrypted key references in the Allternit vault.
pub struct WalletStore {
    wallets: HashMap<String, Wallet>,
    /// Mapping from wallet id to base64-encoded private key bytes.
    /// In production this map is never held in memory; keys live in the vault.
    keys: HashMap<String, String>,
}

impl Default for WalletStore {
    fn default() -> Self {
        Self::new()
    }
}

impl WalletStore {
    pub fn new() -> Self {
        Self {
            wallets: HashMap::new(),
            keys: HashMap::new(),
        }
    }

    pub fn create(&mut self, req: CreateWalletRequest) -> Result<Wallet, EtridError> {
        let signing_key = SigningKey::generate(&mut OsRng);
        let verifying_key = signing_key.verifying_key();
        let public_key = BASE64_STANDARD.encode(verifying_key.to_bytes());

        // Derive a stable address-like identifier from the public key.
        let address = derive_address(&verifying_key);

        let wallet_id = format!("etrid-{}-{}-{}-{}-{}-{}",
            &req.agent_id[..req.agent_id.len().min(8)],
            uuid_part(),
            uuid_part(),
            uuid_part(),
            uuid_part(),
            uuid_part()
        );

        // Vault reference placeholder. In production this is returned by the
        // vault after sealing the private key.
        let key_vault_ref = format!("vault://etrid/keys/{}", wallet_id);

        let wallet = Wallet {
            id: wallet_id.clone(),
            agent_id: req.agent_id,
            kind: req.kind,
            public_key: public_key.clone(),
            address: Some(address),
            chain_id: req.chain_id,
            allowed_methods: if req.allowed_methods.is_empty() {
                vec![PaymentMethod::Receive, PaymentMethod::Invoice]
            } else {
                req.allowed_methods
            },
            created_at: Utc::now(),
            key_vault_ref,
        };

        // Phase 1: store the raw private key bytes in memory. Production must
        // seal this in the vault and never retain it here.
        self.keys.insert(
            wallet_id.clone(),
            BASE64_STANDARD.encode(signing_key.to_bytes()),
        );
        self.wallets.insert(wallet_id, wallet.clone());

        Ok(wallet)
    }

    pub fn get(&self, wallet_id: &str) -> Result<&Wallet, EtridError> {
        self.wallets
            .get(wallet_id)
            .ok_or_else(|| EtridError::WalletNotFound(wallet_id.to_string()))
    }

    pub fn list_by_agent(&self, agent_id: &str) -> Vec<&Wallet> {
        self.wallets
            .values()
            .filter(|w| w.agent_id == agent_id)
            .collect()
    }

    pub fn sign(&self, req: SignRequest) -> Result<SignResponse, EtridError> {
        let wallet = self.get(&req.wallet_id)?.clone();
        let key_bytes = self
            .keys
            .get(&req.wallet_id)
            .ok_or(EtridError::InvalidKeyMaterial)?;
        let key_arr = BASE64_STANDARD.decode(key_bytes).map_err(|_| EtridError::InvalidKeyMaterial)?;
        let key_arr: [u8; 32] = key_arr
            .try_into()
            .map_err(|_| EtridError::InvalidKeyMaterial)?;
        let signing_key = SigningKey::from_bytes(&key_arr);
        let signature: Signature = signing_key.sign(req.message.as_bytes());

        Ok(SignResponse {
            signature: BASE64_STANDARD.encode(signature.to_bytes()),
            public_key: wallet.public_key,
        })
    }

    pub fn create_invoice(&self, req: InvoiceRequest) -> Result<Invoice, EtridError> {
        let wallet = self.get(&req.wallet_id)?.clone();
        if !wallet.allowed_methods.contains(&PaymentMethod::Invoice)
            && !wallet.allowed_methods.contains(&PaymentMethod::Receive)
        {
            return Err(EtridError::MethodNotAllowed("invoice".to_string()));
        }

        let invoice_id = format!("inv-{}", uuid_part());
        let expires_at = req.expires_in_seconds.map(|s| Utc::now() + chrono::Duration::seconds(s as i64));
        let payment_uri = format!(
            "etrid://{}/pay?invoice={}&amount={}&currency={}",
            wallet.address.as_deref().unwrap_or(&wallet.id),
            invoice_id,
            urlencoding::encode(&req.amount),
            urlencoding::encode(&req.currency)
        );

        Ok(Invoice {
            invoice_id,
            wallet_id: req.wallet_id,
            amount: req.amount,
            currency: req.currency,
            description: req.description,
            payment_uri,
            expires_at,
        })
    }
}

fn derive_address(verifying_key: &VerifyingKey) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifying_key.to_bytes());
    let result = hasher.finalize();
    format!("0x{}", hex::encode(&result[..20]))
}

fn uuid_part() -> String {
    use rand::RngCore;
    let mut bytes = [0u8; 4];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}
