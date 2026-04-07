pub mod gate;
#[cfg(test)]
pub mod tests;

pub use gate::{
    AutolandImpact, AutolandResult, DagMutation, Gate, GateOptions, GateResult, MutationProvenance,
    WihPickupOptions,
};

// Re-export visual verification types for convenience
pub use crate::verification::types::{Evidence, ProviderError, VerificationProvider, VisualConfig};
