//! Agent registry types and persistence.
//!
//! This module re-exports the canonical agent definitions from `agents.rs` so
//! there is a single source of truth for the registry contract.

pub use super::RegistryError;

pub use super::agents::{
    AgentDefinition,
    AgentRegistry,
    AvatarConfig,
    CharacterLayer,
    HarnessByokConfig,
    HarnessByokProviderConfig,
    HarnessCloudConfig,
    HarnessConfig,
    HarnessLocalConfig,
    HarnessSubprocessConfig,
    ModelConfig,
    RoleCard,
    VoiceConfig,
};
