//! Parity Receipt Storage

use std::path::PathBuf;

use crate::capture::CaptureError;
use crate::capture::Receipt;

/// Write receipt to storage
pub async fn write_receipt(
    receipt: Receipt,
    corpus_dir: &PathBuf,
    compress_threshold: usize,
) -> Result<(), CaptureError> {
    // Implementation in capture.rs
    crate::capture::write_receipt_to_disk(&receipt, corpus_dir, compress_threshold).await
}
