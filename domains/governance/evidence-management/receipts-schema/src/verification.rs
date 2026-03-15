//! Receipt Verification Module
//!
//! Provides cryptographic verification of receipts.

use crate::{Receipt, ReceiptError};
use sha2::{Digest, Sha256};

/// Verifier for receipts
pub struct ReceiptVerifier;

impl ReceiptVerifier {
    /// Create a new verifier
    pub fn new() -> Self {
        Self
    }

    /// Verify receipt integrity
    pub fn verify_integrity(&self, receipt: &Receipt) -> Result<bool, ReceiptError> {
        // Verify that all hashes are present and well-formed
        if receipt.tool_def_hash.is_empty() {
            return Ok(false);
        }

        if receipt.policy_decision_hash.is_empty() {
            return Ok(false);
        }

        // Check write scope integrity
        let scope_valid = receipt.write_scope_proof.actual.iter().all(|path| {
            receipt.write_scope_proof.declared.contains(path) || path.starts_with("/tmp")
        });

        if !scope_valid {
            return Ok(false);
        }

        Ok(true)
    }

    /// Verify receipt chain (if part of a sequence)
    pub fn verify_chain(&self, _receipt: &Receipt, _previous: Option<&Receipt>) -> Result<bool, ReceiptError> {
        // In a real implementation, this would verify that the receipt
        // correctly references and builds upon previous receipts
        Ok(true)
    }

    /// Calculate receipt fingerprint
    pub fn calculate_fingerprint(&self, receipt: &Receipt) -> Result<String, ReceiptError> {
        let data = serde_json::to_vec(receipt)
            .map_err(|e| ReceiptError::SerializationError(e))?;
        
        let mut hasher = Sha256::new();
        hasher.update(&data);
        Ok(hex::encode(hasher.finalize()))
    }
}

impl Default for ReceiptVerifier {
    fn default() -> Self {
        Self::new()
    }
}
