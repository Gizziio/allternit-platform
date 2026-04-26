//! Allternit Parity Testing Framework
//!
//! Provides infrastructure for the Strangler Fig migration pattern
//! when absorbing OpenClaw components into allternit.
//!
//! Core concepts:
//! - StranglerComponent: A component being migrated from OpenClaw to native Allternit
//! - ParityHarness: Orchestrates testing and comparison
//! - Receipts: Immutable records of all OpenClaw I/O
//!
//! Architecture Locks:
//! - LOCK 2: Parity corpus is the authority
//! - Nothing graduates without passing parity tests

pub mod capture;
pub mod comparison;
pub mod harness;
pub mod storage;
pub mod strangler;

pub use harness::{
    ComponentStatus, HarnessConfig, ParityHarness, ParityReport, ParityTrends, SuiteResult,
    SuiteSummary, TestResult,
};

pub use strangler::{
    ComponentInfo, ComponentInput, ComponentOutput, ComponentRegistry, Difference, MigrationPhase,
    OutputMetadata, ParityResult, StranglerComponent,
};

pub use capture::{
    normalize_receipt, write_receipt, CaptureConfig, CaptureManager, NormalizedReceipt, Receipt,
    ReceiptMetadata,
};

// Re-export for convenience
pub use capture::Receipt as ParityReceipt;
pub use capture::ReceiptMetadata as ParityReceiptMetadata;
