//! Parity Testing System
//!
//! Captures all OpenClaw I/O for deterministic replay and comparison.
//!
//! ARCHITECTURE LOCK 2: Parity corpus is the authority.
//! Nothing graduates without passing parity tests.

pub mod capture;
pub mod comparison;
pub mod harness;
pub mod storage;
pub mod strangler;

pub use capture::{
    CaptureConfig, CaptureManager, NormalizedReceipt, Receipt, ReceiptMetadata, normalize_receipt,
    write_receipt,
};

pub use harness::{
    ComponentStatus, HarnessConfig, ParityHarness, ParityReport, ParityTrends, SuiteResult,
    SuiteSummary, TestResult,
};

pub use strangler::{
    ComponentInfo, ComponentInput, ComponentOutput, ComponentRegistry, Difference, MigrationPhase,
    OutputMetadata, ParityResult, StranglerComponent,
};

// Re-export for use in launcher.rs
pub use capture::Receipt as ParityReceipt;
pub use capture::ReceiptMetadata as ParityReceiptMetadata;
